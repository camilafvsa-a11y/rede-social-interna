import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import { RichText } from "@/components/RichText";

const C = Colors.light;

type IntegraItem = {
  id: number;
  category: string;
  sectionName: string | null;
  sectionIcon: string | null;
  sectionColor: string | null;
  sectionColorBg: string | null;
  title: string;
  subtitle: string | null;
  content: string | null;
  pdfUrl: string | null;
  requiresSign: boolean;
  requiresRead: boolean;
  docKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: boolean;
  docType: string;
  showInIntegra: boolean;
  showInOnboarding: boolean;
  countsForProgress: boolean;
};

// ─── Doc card for preview ─────────────────────────────────────────────────────
function PreviewDocCard({ item, isRead, onToggle }: {
  item: IntegraItem;
  isRead: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = item.sectionColor || C.tint;
  const colorBg = item.sectionColorBg || "#EFF6FF";

  return (
    <View style={[st.docCard, isRead && st.docCardRead]}>
      <TouchableOpacity style={st.docCardHeader} onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
        <View style={[st.docIcon, { backgroundColor: colorBg }]}>
          <Feather name={(item.iconName as any) || "file-text"} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.docTitle} numberOfLines={expanded ? undefined : 1}>{item.title}</Text>
          {!expanded && item.subtitle ? (
            <Text style={st.docSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          ) : null}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-right"} size={15} color={C.textMuted} />
      </TouchableOpacity>

      {expanded && item.content ? (
        <View style={st.docBody}>
          <View style={st.docDivider} />
          <RichText content={item.content} baseSize={13} />
          {item.requiresRead && (
            <TouchableOpacity
              style={[st.readRow, isRead && st.readRowDone]}
              onPress={onToggle}
              activeOpacity={0.8}
            >
              <View style={[st.checkbox, isRead && st.checkboxDone]}>
                {isRead && <Feather name="check" size={11} color="#fff" />}
              </View>
              <Text style={[st.readLabel, isRead && { color: "#059669" }]}>
                {isRead ? "Marcado como lido" : "Marcar como lido (preview)"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PreviewOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const initialStep = parseInt(stepParam ?? "0") || 0;

  const [items, setItems] = useState<IntegraItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [currentStep, setCurrentStep] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const [termChecked, setTermChecked] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // Fetch onboarding items from API
  useEffect(() => {
    api.get("/integra-items/onboarding")
      .then((data: IntegraItem[]) => setItems(data))
      .catch(() => {})
      .finally(() => {
        setLoadingItems(false);
      });
  }, []);

  const policyItems = items.filter(i => !i.requiresSign);
  const termItems = items.filter(i => i.requiresSign);

  // Build steps dynamically
  const STEPS = [
    { id: "photo", title: "Foto de Perfil", description: "Adicione uma foto para que seus colegas possam te reconhecer" },
    ...(policyItems.length > 0 ? [{ id: "docs", title: "Documentos & Políticas", description: "Leia os documentos do Grupo Beija-flor para continuar" }] : []),
    ...(termItems.length > 0 ? [{ id: "terms", title: "Termos & Assinaturas", description: "Leia e confirme os termos necessários" }] : []),
  ];

  const step = STEPS[Math.min(currentStep, STEPS.length - 1)];

  useEffect(() => {
    if (!loadingItems) {
      setCurrentStep(Math.min(initialStep, STEPS.length - 1));
    }
  }, [loadingItems]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  }

  function toggleRead(key: string) {
    setReadKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function canProceed() {
    if (!step) return true;
    if (step.id === "photo") return true;
    if (step.id === "docs") {
      const required = policyItems.filter(i => i.requiresRead);
      return required.every(i => readKeys.has(i.docKey));
    }
    if (step.id === "terms") return termChecked;
    return true;
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowComplete(true);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom;

  if (showComplete) {
    return (
      <View style={[styles.container, styles.completeContainer, { paddingTop: topPad }]}>
        <View style={styles.previewBanner}>
          <Feather name="eye" size={13} color="#92400E" />
          <Text style={styles.previewBannerText}>MODO TESTE — nenhum dado será salvo</Text>
        </View>
        <View style={styles.completeBox}>
          <View style={styles.completeIconCircle}>
            <Feather name="check-circle" size={56} color="#059669" />
          </View>
          <Text style={styles.completeTitle}>Simulação concluída!</Text>
          <Text style={styles.completeDesc}>
            Em um acesso real, o colaborador seria redirecionado para o feed do app.{"\n\n"}
            Nenhum dado foi alterado — este era apenas um teste visual.
          </Text>
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={() => router.replace("/admin/test-lab" as any)}
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={16} color="#fff" />
            <Text style={styles.completeBtnText}>Voltar ao Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => {
              setCurrentStep(0);
              setAvatarUri(null);
              setReadKeys(new Set());
              setTermChecked(false);
              setShowComplete(false);
            }}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={14} color={C.tint} />
            <Text style={styles.restartBtnText}>Reiniciar simulação</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Preview mode banner */}
      <View style={styles.previewBanner}>
        <Feather name="eye" size={13} color="#92400E" />
        <Text style={styles.previewBannerText}>MODO TESTE — nenhum dado será salvo</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color="#B45309" />
        </TouchableOpacity>
      </View>

      {loadingItems ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={C.tint} />
          <Text style={{ fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" }}>
            Carregando documentos da API...
          </Text>
        </View>
      ) : (
        <>
          {/* Progress header */}
          <View style={styles.header}>
            <View style={styles.progressRow}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.progressDot, i <= currentStep && styles.progressDotActive]} />
              ))}
            </View>
            <Text style={styles.stepLabel}>Passo {currentStep + 1} de {STEPS.length}</Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {step && (
              <>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.desc}>{step.description}</Text>
              </>
            )}

            {/* Step: Photo */}
            {step?.id === "photo" && (
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
                <View style={styles.previewNote}>
                  <Feather name="info" size={12} color="#1D4ED8" />
                  <Text style={styles.previewNoteText}>Preview: a foto selecionada não será salva</Text>
                </View>
              </View>
            )}

            {/* Step: Docs */}
            {step?.id === "docs" && (
              <View style={styles.documentSection}>
                {policyItems.length === 0 ? (
                  <View style={styles.emptyDocs}>
                    <Feather name="inbox" size={32} color={C.textMuted} />
                    <Text style={styles.emptyDocsText}>Nenhum documento cadastrado no onboarding</Text>
                    <Text style={styles.emptyDocsHint}>
                      Acesse Central de Documentos no admin para adicionar.
                    </Text>
                  </View>
                ) : (
                  policyItems.map(item => (
                    <PreviewDocCard
                      key={item.id}
                      item={item}
                      isRead={readKeys.has(item.docKey)}
                      onToggle={() => toggleRead(item.docKey)}
                    />
                  ))
                )}
              </View>
            )}

            {/* Step: Terms */}
            {step?.id === "terms" && (
              <View style={styles.documentSection}>
                {termItems.map(item => (
                  <View key={item.id} style={styles.termCard}>
                    <View style={styles.termCardHeader}>
                      <View style={[styles.termIcon, { backgroundColor: item.sectionColorBg || "#F5F3FF" }]}>
                        <Feather name={(item.iconName as any) || "edit-3"} size={15} color={item.sectionColor || "#7C3AED"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.termTitle}>{item.title}</Text>
                        {item.subtitle ? <Text style={styles.termSubtitle}>{item.subtitle}</Text> : null}
                      </View>
                    </View>
                    {item.content ? (
                      <View style={styles.termBody}>
                        <RichText content={item.content} baseSize={13} />
                      </View>
                    ) : null}
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.checkRow, termChecked && styles.checkRowActive]}
                  onPress={() => setTermChecked(!termChecked)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, termChecked && styles.checkboxChecked]}>
                    {termChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkLabel}>Li e aceito os termos acima</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
            <View style={styles.footerRow}>
              {currentStep > 0 && (
                <TouchableOpacity
                  style={styles.prevBtn}
                  onPress={() => setCurrentStep(currentStep - 1)}
                  activeOpacity={0.8}
                >
                  <Feather name="arrow-left" size={16} color={C.tint} />
                  <Text style={styles.prevBtnText}>Anterior</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled, currentStep > 0 && styles.nextBtnFlex]}
                onPress={nextStep}
                disabled={!canProceed()}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>
                  {currentStep === STEPS.length - 1 ? "Concluir e Entrar" : "Continuar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  docCard: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 8, overflow: "hidden",
  },
  docCardRead: { borderColor: "#BBF7D0" },
  docCardHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  docIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  docTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  docSubtitle: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  docBody: { paddingHorizontal: 12, paddingBottom: 12 },
  docDivider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  readRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: C.border, marginTop: 12,
  },
  readRowDone: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxDone: { backgroundColor: "#059669", borderColor: "#059669" },
  readLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  previewBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: "#FDE68A",
  },
  previewBannerText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_700Bold",
    color: "#92400E", letterSpacing: 0.3,
  },

  header: { paddingHorizontal: 24, paddingVertical: 16 },
  progressRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.tint },
  stepLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },

  content: { flex: 1 },
  contentContainer: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  desc: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },

  photoSection: { alignItems: "center", gap: 14, marginTop: 8 },
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
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarEditText: { color: "#fff", fontSize: 14 },
  photoHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  previewNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  previewNoteText: { fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_500Medium" },

  documentSection: { gap: 0 },

  emptyDocs: {
    alignItems: "center", gap: 10, paddingVertical: 32,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  emptyDocsText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textAlign: "center" },
  emptyDocsHint: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },

  termCard: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: "hidden",
  },
  termCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  termIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  termTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  termSubtitle: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  termBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },

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
  footerRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  prevBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.tint,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  prevBtnText: { color: C.tint, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextBtn: {
    flex: 1, backgroundColor: C.tint, borderRadius: 12,
    paddingVertical: 16, alignItems: "center",
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnFlex: { flex: 1 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  completeContainer: { justifyContent: "flex-start" },
  completeBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, gap: 16,
  },
  completeIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  completeTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  completeDesc: {
    fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 22,
  },
  completeBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 28, marginTop: 8,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  completeBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  restartBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: C.tint, backgroundColor: "#EFF6FF",
  },
  restartBtnText: { color: C.tint, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
