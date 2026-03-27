import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/api";

const C = Colors.light;

function Row({ icon, label, value, color }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Feather name={icon} size={14} color={color ?? C.tint} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

export default function ExportImportScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<any>(null);

  // ─── Export CSV ────────────────────────────────────────────────────────────
  async function handleExport() {
    if (Platform.OS !== "web") {
      Alert.alert("Atenção", "A exportação CSV está disponível apenas no navegador web.");
      return;
    }
    setExporting(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const base = getApiUrl();
      const response = await fetch(`${base}/data/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Erro ao gerar CSV");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `colaboradores_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha na exportação");
    } finally {
      setExporting(false);
    }
  }

  // ─── Import CSV ────────────────────────────────────────────────────────────
  async function handleImportFile(csvText: string) {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const base = getApiUrl();
      const response = await fetch(`${base}/data/import-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro na importação");
      setImportResult(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha na importação");
    } finally {
      setImporting(false);
    }
  }

  function triggerFileInput() {
    if (Platform.OS !== "web") {
      Alert.alert("Atenção", "A importação por arquivo está disponível apenas no navegador web.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        handleImportFile(text);
      };
      reader.readAsText(file, "UTF-8");
    };
    input.click();
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exportar / Importar</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
      >
        {/* ── Export ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="download" size={20} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Exportar Colaboradores</Text>
              <Text style={styles.cardDesc}>Baixa uma planilha CSV com todos os dados dos colaboradores</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>O arquivo inclui:</Text>
          {[
            "Nome, E-mail, Perfil (role)",
            "Tag principal e tags extras (família)",
            "CPF, Data de nascimento, Data de contratação",
            "Status de ban do app e ban de postagem",
            "Assinou Termo de Imagem (Sim/Não) e data",
            "Onboarding concluído e data de cadastro",
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Feather name="check" size={12} color="#059669" />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.primaryBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                <Feather name="download-cloud" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Baixar CSV</Text>
              </>}
          </TouchableOpacity>
        </View>

        {/* ── Import ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="upload" size={20} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Importar Colaboradores</Text>
              <Text style={styles.cardDesc}>Adiciona colaboradores em lote a partir de um arquivo CSV</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Format info */}
          <View style={styles.formatBox}>
            <Text style={styles.formatTitle}>Formato esperado do CSV:</Text>
            <Text style={styles.formatCode}>
              {"nome,email,perfil,tag,senha temporária\nJoão Silva,joao@empresa.com,Colaborador,Posto,senha123\nMaria Souza,maria@empresa.com,Moderador,Marketing,"}
            </Text>
            <Text style={styles.formatNote}>
              • <Text style={{ fontFamily: "Inter_700Bold" }}>nome</Text> e <Text style={{ fontFamily: "Inter_700Bold" }}>email</Text> são obrigatórios{"\n"}
              • perfil: Colaborador, Moderador, Administrador (padrão: Colaborador){"\n"}
              • tag: Posto, Churrascaria, Marketing, Adm, Sócio, Gerente{"\n"}
              • senha temporária: gerada automaticamente se vazia{"\n"}
              • E-mails já cadastrados são ignorados
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.greenBtn, importing && { opacity: 0.6 }]}
            onPress={triggerFileInput}
            disabled={importing}
            activeOpacity={0.8}
          >
            {importing
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <Text style={styles.greenBtnText}>Selecionar arquivo CSV</Text>
              </>}
          </TouchableOpacity>

          {/* Result */}
          {importResult && (
            <View style={styles.resultBox}>
              <View style={styles.resultHeader}>
                <Feather name="check-circle" size={16} color="#059669" />
                <Text style={styles.resultTitle}>Importação concluída</Text>
              </View>
              <Row icon="user-plus" label="Criados" value={importResult.created} color="#059669" />
              <Row icon="minus-circle" label="Ignorados" value={importResult.skipped} color="#D97706" />
              <Row icon="hash" label="Total no CSV" value={importResult.total} />
              {importResult.errors?.length > 0 && (
                <View style={styles.errorsBox}>
                  <Text style={styles.errorsTitle}>Avisos ({importResult.errors.length}):</Text>
                  {importResult.errors.slice(0, 5).map((e: string, i: number) => (
                    <Text key={i} style={styles.errorText}>• {e}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
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

  content: { padding: 14, gap: 14 },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  cardDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  divider: { height: 1, backgroundColor: C.borderLight },

  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulletText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", flex: 1 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.tint, borderRadius: 12, paddingVertical: 13,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  greenBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#059669", borderRadius: 12, paddingVertical: 13,
  },
  greenBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  formatBox: {
    backgroundColor: "#1E293B", borderRadius: 12, padding: 14, gap: 8,
  },
  formatTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  formatCode: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#E2E8F0", lineHeight: 18 },
  formatNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", lineHeight: 18 },

  resultBox: {
    backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14, gap: 8,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#059669" },

  statRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statLabel: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },

  errorsBox: {
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10, gap: 4,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  errorsTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  errorText: { fontSize: 11, color: "#92400E", fontFamily: "Inter_400Regular" },
});
