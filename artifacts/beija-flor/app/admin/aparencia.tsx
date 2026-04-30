import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAppearance, FONT_OPTIONS, FontOption } from "@/context/AppearanceContext";

const C = Colors.light;

const PREVIEW_SENTENCES: Record<string, string> = {
  Inter: "O Grupo Beija-flor cuida de cada detalhe para oferecer a melhor experiência.",
  Poppins: "O Grupo Beija-flor cuida de cada detalhe para oferecer a melhor experiência.",
};

const FONT_PREVIEW_MAP: Record<string, { regular: string; bold: string }> = {
  Inter: { regular: "Inter_400Regular", bold: "Inter_700Bold" },
  Poppins: { regular: "Poppins_400Regular", bold: "Poppins_700Bold" },
};

export default function AparenciaScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom;

  const { fontOption, setFontOption } = useAppearance();
  const [selected, setSelected] = useState<FontOption>(fontOption);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await setFontOption(selected);
      Alert.alert("Fonte atualizada!", `A fonte "${selected}" foi aplicada ao app.`);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = selected !== fontOption;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aparência</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* ── Banner ── */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Feather name="type" size={22} color={C.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Fonte global do app</Text>
            <Text style={styles.bannerDesc}>
              Escolha a família de fonte que será aplicada em todas as telas do aplicativo para todos os usuários.
            </Text>
          </View>
        </View>

        {/* ── Font selection ── */}
        <Text style={styles.sectionTitle}>Escolher fonte</Text>

        {FONT_OPTIONS.map((opt) => {
          const isActive = selected === opt.key;
          const preview = FONT_PREVIEW_MAP[opt.key];
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.fontCard, isActive && styles.fontCardActive]}
              onPress={() => setSelected(opt.key)}
              activeOpacity={0.8}
            >
              <View style={styles.fontCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fontName, { fontFamily: preview.bold }]}>{opt.label}</Text>
                  <Text style={styles.fontDesc}>{opt.description}</Text>
                </View>
                <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                  {isActive && <View style={styles.radioInner} />}
                </View>
              </View>

              {/* Preview */}
              <View style={styles.previewBox}>
                <Text style={[styles.previewLabel]}>Visualização</Text>
                <Text style={[styles.previewTitle, { fontFamily: preview.bold }]}>
                  Comunicação Interna
                </Text>
                <Text style={[styles.previewBody, { fontFamily: preview.regular }]}>
                  {PREVIEW_SENTENCES[opt.key]}
                </Text>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewSmall, { fontFamily: preview.regular }]}>Aa Bb Cc</Text>
                  <Text style={[styles.previewSmall, { fontFamily: preview.bold }]}>1 2 3</Text>
                </View>
              </View>

              {opt.key === fontOption && (
                <View style={styles.currentBadge}>
                  <Feather name="check" size={11} color="#059669" />
                  <Text style={styles.currentBadgeText}>Fonte atual</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.8}
        >
          <Feather name="save" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? "Salvando..." : "Aplicar fonte"}</Text>
        </TouchableOpacity>

        {/* ── Note ── */}
        <View style={styles.noteBox}>
          <Feather name="info" size={13} color={C.tint} />
          <Text style={styles.noteText}>
            A mudança de fonte afeta os principais textos do app. Após salvar, a nova fonte será aplicada automaticamente.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  content: { padding: 16, gap: 16 },
  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  bannerIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: "#DBEAFE",
    alignItems: "center", justifyContent: "center",
  },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  bannerDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  fontCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 12,
  },
  fontCardActive: { borderColor: C.tint, backgroundColor: "#F8FBFF" },
  fontCardHeader: { flexDirection: "row", alignItems: "center" },
  fontName: { fontSize: 18, color: C.text, marginBottom: 2 },
  fontDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  radioOuterActive: { borderColor: C.tint },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.tint },
  previewBox: {
    backgroundColor: C.background, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.border, gap: 6,
  },
  previewLabel: {
    fontSize: 10, fontFamily: "Inter_500Medium", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
  },
  previewTitle: { fontSize: 16, color: C.text, marginBottom: 4 },
  previewBody: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  previewRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  previewSmall: { fontSize: 13, color: C.textSecondary },
  currentBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  currentBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 16,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: C.border, shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  noteText: { flex: 1, fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_400Regular", lineHeight: 18 },
});
