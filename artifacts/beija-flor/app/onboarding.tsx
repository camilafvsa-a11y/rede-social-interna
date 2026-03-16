import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const STEPS = [
  { id: "photo", title: "Foto de Perfil", description: "Adicione uma foto para que seus colegas possam te reconhecer" },
  { id: "manual", title: "Manual do Colaborador", description: "Leia o manual do colaborador antes de continuar" },
  { id: "terms", title: "Termo de Uso de Imagem", description: "Aceite o termo de uso de imagem para continuar" },
];

const MANUAL_CONTENT = `MANUAL DO COLABORADOR - GRUPO BEIJA-FLOR

Bem-vindo ao Grupo Beija-flor! Este manual contém informações importantes sobre nossa cultura e valores.

1. MISSÃO
Nossa missão é oferecer produtos e serviços de qualidade, com excelência no atendimento.

2. VALORES
• Respeito e ética em todas as relações
• Comprometimento com resultados
• Trabalho em equipe
• Inovação contínua
• Responsabilidade social

3. CÓDIGO DE CONDUTA
• Trate todos os colegas com respeito e dignidade
• Mantenha postura profissional em todas as situações
• Preserve o sigilo das informações da empresa
• Cumpra seus horários e responsabilidades

4. POLÍTICA DE USO DA REDE SOCIAL INTERNA
• Use a plataforma para comunicação profissional
• Não publique conteúdo ofensivo ou inadequado
• Respeite a privacidade dos colegas
• Denuncie comportamentos inadequados

5. BENEFÍCIOS
• Vale-refeição
• Plano de saúde
• Treinamentos e capacitações
• Programa de desenvolvimento profissional

Ao continuar, você confirma que leu e entende este manual.`;

const TERMS_CONTENT = `TERMO DE USO DE IMAGEM - GRUPO BEIJA-FLOR

Ao aceitar este termo, você autoriza o Grupo Beija-flor a:

• Utilizar sua foto de perfil na rede social interna da empresa
• Exibir sua imagem para outros colaboradores autorizados
• Utilizar imagens de eventos corporativos para comunicação interna

Você tem o direito de:
• Atualizar sua foto de perfil a qualquer momento
• Solicitar a remoção de imagens específicas
• Revogar esta autorização a qualquer tempo

Este termo é válido durante o período de vínculo empregatício com o Grupo Beija-flor.`;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);
  const [readManual, setReadManual] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      try {
        await api.post(`/users/${user?.id}/avatar`, { avatarUrl: uri });
      } catch {}
    }
  }

  async function completeOnboarding() {
    if (!acceptedTerms || !readManual) {
      Alert.alert("Atenção", "Você deve ler o manual e aceitar os termos para continuar.");
      return;
    }
    setLoading(true);
    try {
      const updated = await api.post("/auth/complete-onboarding", {
        avatarUrl: avatarUri,
        acceptedTerms: true,
        readDocuments: true,
      });
      updateUser(updated);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  function canProceed() {
    if (currentStep === 0) return true;
    if (currentStep === 1) return readManual;
    if (currentStep === 2) return acceptedTerms;
    return true;
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
    else completeOnboarding();
  }

  const step = STEPS[currentStep];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= currentStep && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Passo {currentStep + 1} de {STEPS.length}</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.description}</Text>

        {currentStep === 0 && (
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                  <Text style={styles.avatarPlaceholderText}>Toque para escolher</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>✎</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Você pode pular esta etapa e adicionar sua foto depois</Text>
          </View>
        )}

        {currentStep === 1 && (
          <View style={styles.documentSection}>
            <View style={styles.documentCard}>
              <ScrollView style={styles.documentScroll} nestedScrollEnabled>
                <Text style={styles.documentText}>{MANUAL_CONTENT}</Text>
              </ScrollView>
            </View>
            <TouchableOpacity
              style={[styles.checkRow, readManual && styles.checkRowActive]}
              onPress={() => setReadManual(!readManual)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, readManual && styles.checkboxChecked]}>
                {readManual && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>Li e entendi o Manual do Colaborador</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 2 && (
          <View style={styles.documentSection}>
            <View style={styles.documentCard}>
              <ScrollView style={styles.documentScroll} nestedScrollEnabled>
                <Text style={styles.documentText}>{TERMS_CONTENT}</Text>
              </ScrollView>
            </View>
            <TouchableOpacity
              style={[styles.checkRow, acceptedTerms && styles.checkRowActive]}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>Aceito o Termo de Uso de Imagem</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
          onPress={nextStep}
          disabled={!canProceed() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {currentStep === STEPS.length - 1 ? "Concluir e Entrar" : "Continuar"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  progressRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.tint },
  stepLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  content: { flex: 1 },
  contentContainer: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text },
  desc: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },
  photoSection: { alignItems: "center", gap: 16, marginTop: 16 },
  avatarContainer: { width: 140, height: 140, borderRadius: 70, position: "relative" },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  avatarPlaceholder: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: C.surfaceAlt,
    borderWidth: 2, borderColor: C.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  avatarPlaceholderIcon: { fontSize: 32 },
  avatarPlaceholderText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  avatarEditBadge: {
    position: "absolute", bottom: 4, right: 4,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarEditText: { color: "#fff", fontSize: 14 },
  photoHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  documentSection: { gap: 16 },
  documentCard: {
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
  },
  documentScroll: { maxHeight: 300, padding: 16 },
  documentText: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  checkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  checkRowActive: { borderColor: C.tint, backgroundColor: "#f0fdf4" },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  checkmark: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  checkLabel: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  footer: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: C.background },
  nextBtn: {
    backgroundColor: C.tint, borderRadius: 12,
    paddingVertical: 16, alignItems: "center",
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
