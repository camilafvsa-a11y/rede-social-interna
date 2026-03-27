import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const C = Colors.light;

const PREVIEW_OPTIONS = [
  {
    icon: "play-circle" as const,
    color: "#2563EB",
    bg: "#EFF6FF",
    title: "Fluxo Completo de Primeiro Acesso",
    desc: "Simula toda a jornada do novo colaborador: foto de perfil → manual → termo de imagem",
    route: "/admin/preview-onboarding?step=0",
  },
  {
    icon: "camera" as const,
    color: "#7C3AED",
    bg: "#F5F3FF",
    title: "Passo 1 — Foto de Perfil",
    desc: "Tela de escolha de foto de perfil (sem upload real)",
    route: "/admin/preview-onboarding?step=0",
  },
  {
    icon: "book" as const,
    color: "#D97706",
    bg: "#FFFBEB",
    title: "Passo 2 — Manual do Colaborador",
    desc: "Tela de leitura do manual com checkbox de confirmação",
    route: "/admin/preview-onboarding?step=1",
  },
  {
    icon: "file-text" as const,
    color: "#059669",
    bg: "#F0FDF4",
    title: "Passo 3 — Termo de Imagem",
    desc: "Tela de aceitação do Termo de Uso de Imagem e Voz",
    route: "/admin/preview-onboarding?step=2",
  },
];

export default function TestLabScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laboratório de Testes</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
      >
        {/* Banner info */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={18} color="#1D4ED8" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Modo de visualização</Text>
            <Text style={styles.infoDesc}>
              Aqui você pode simular as telas que novos colaboradores veem no primeiro acesso.
              {"\n"}Nenhum dado é salvo ou alterado durante o teste.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Telas disponíveis para teste</Text>

        {PREVIEW_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={styles.optionCard}
            onPress={() => router.push(opt.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.optionIcon, { backgroundColor: opt.bg }]}>
              <Feather name={opt.icon} size={22} color={opt.color} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{opt.title}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.textMuted} />
          </TouchableOpacity>
        ))}

        <View style={styles.warningBox}>
          <Feather name="alert-triangle" size={14} color="#B45309" />
          <Text style={styles.warningText}>
            As telas de preview são idênticas às reais, mas os botões "Concluir" e "Continuar"
            não chamam a API e não alteram nenhum dado do banco.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },

  content: { padding: 14, gap: 12 },

  infoBanner: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: "#EFF6FF", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1D4ED8", marginBottom: 3 },
  infoDesc: { fontSize: 13, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 19 },

  sectionLabel: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4,
  },

  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 17 },

  warningBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  warningText: {
    flex: 1, fontSize: 12, color: "#92400E",
    fontFamily: "Inter_400Regular", lineHeight: 18,
  },
});
