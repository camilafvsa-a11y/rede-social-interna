import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, Alert, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

type TabId = "signatures" | "image_terms" | "values";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "signatures", label: "Assinaturas", icon: "edit-3" },
  { id: "image_terms", label: "Uso de Imagem", icon: "camera" },
  { id: "values", label: "Valores", icon: "star" },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Signatures tab ────────────────────────────────────────────────────────────
function SignaturesTab() {
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState("");

  const { data: signatures = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-signatures"],
    queryFn: () => api.get("/signatures/admin"),
  });

  const filtered = signatures.filter((s: any) => {
    const q = search.toLowerCase();
    const d = docFilter.toLowerCase();
    const matchSearch = !q || s.user?.name?.toLowerCase().includes(q) || s.user?.email?.toLowerCase().includes(q);
    const matchDoc = !d || s.docTitle?.toLowerCase().includes(d) || s.docKey?.toLowerCase().includes(d);
    return matchSearch && matchDoc;
  });

  // Group by docKey for summary
  const docKeys = Array.from(new Set(signatures.map((s: any) => s.docKey)));

  async function handleExport() {
    try {
      const url = `${process.env.EXPO_PUBLIC_API_URL || "/api"}/signatures/admin/export.csv`;
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        Alert.alert("Exportar", "O arquivo CSV estará disponível em breve.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <View style={[styles.searchWrap, { flex: 1 }]}>
          <Feather name="search" size={14} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar colaborador..."
            placeholderTextColor={C.placeholder}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={13} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
          <Feather name="download" size={14} color={C.tint} />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      {docKeys.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.docChipRow}
        >
          <TouchableOpacity
            style={[styles.docChip, !docFilter && styles.docChipActive]}
            onPress={() => setDocFilter("")}
          >
            <Text style={[styles.docChipText, !docFilter && styles.docChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {docKeys.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.docChip, docFilter === key && styles.docChipActive]}
              onPress={() => setDocFilter(docFilter === key ? "" : key)}
            >
              <Text style={[styles.docChipText, docFilter === key && styles.docChipTextActive]} numberOfLines={1}>
                {signatures.find((s: any) => s.docKey === key)?.docTitle || key}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {filtered.length} {filtered.length === 1 ? "assinatura" : "assinaturas"}
          {search || docFilter ? " (filtrado)" : ""}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 80 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="edit-3" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhuma assinatura encontrada</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.sigCard}>
            <View style={styles.sigTop}>
              <View style={styles.sigIcon}>
                <Feather name="edit-3" size={16} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sigDocTitle} numberOfLines={1}>{item.docTitle || item.docKey}</Text>
                <Text style={styles.sigUserName}>{item.user?.name || "—"}</Text>
                <Text style={styles.sigUserEmail}>{item.user?.email || "—"}</Text>
              </View>
              <View style={[styles.contextBadge, item.context === "onboarding" ? styles.contextBadgeOnboarding : styles.contextBadgeIntegra]}>
                <Text style={[styles.contextText, item.context === "onboarding" ? styles.contextTextOnboarding : styles.contextTextIntegra]}>
                  {item.context === "onboarding" ? "Onboarding" : "Integra"}
                </Text>
              </View>
            </View>
            {item.confirmationTextUsed && (
              <Text style={styles.sigConfText} numberOfLines={2}>{item.confirmationTextUsed}</Text>
            )}
            <Text style={styles.sigDate}>{formatDate(item.signedAt)}</Text>
          </View>
        )}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      )}
    </View>
  );
}

// ── Image terms tab ───────────────────────────────────────────────────────────
function ImageTermsTab() {
  const [search, setSearch] = useState("");

  const { data: terms = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-image-terms"],
    queryFn: () => api.get("/signatures/admin/image-terms"),
  });

  const filtered = terms.filter((t: any) => {
    const q = search.toLowerCase();
    return !q || t.user?.name?.toLowerCase().includes(q) || t.user?.email?.toLowerCase().includes(q);
  });

  const accepted = filtered.filter((t: any) => t.accepted);
  const refused = filtered.filter((t: any) => !t.accepted);

  async function handleExport() {
    try {
      const url = `${process.env.EXPO_PUBLIC_API_URL || "/api"}/signatures/admin/export.csv?type=image_terms`;
      if (Platform.OS === "web") window.open(url, "_blank");
      else Alert.alert("Exportar", "O arquivo CSV estará disponível em breve.");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <View style={[styles.searchWrap, { flex: 1 }]}>
          <Feather name="search" size={14} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar colaborador..."
            placeholderTextColor={C.placeholder}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={13} color={C.textMuted} /></TouchableOpacity>}
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
          <Feather name="download" size={14} color={C.tint} />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Feather name="check-circle" size={18} color="#059669" />
          <Text style={styles.statNum}>{accepted.length}</Text>
          <Text style={styles.statLabel}>Aceitaram</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="x-circle" size={18} color="#DC2626" />
          <Text style={styles.statNum}>{refused.length}</Text>
          <Text style={styles.statLabel}>Recusaram</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="users" size={18} color={C.tint} />
          <Text style={styles.statNum}>{filtered.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 80 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="camera" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhuma resposta de termo de imagem</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.sigCard, item.accepted ? styles.sigCardAccepted : styles.sigCardRefused]}>
            <View style={styles.sigTop}>
              <View style={[styles.sigIcon, { backgroundColor: item.accepted ? "#DCFCE7" : "#FEE2E2" }]}>
                <Feather name={item.accepted ? "check" : "x"} size={16} color={item.accepted ? "#059669" : "#DC2626"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sigUserName}>{item.user?.name || "—"}</Text>
                <Text style={styles.sigUserEmail}>{item.user?.email || "—"}</Text>
                {(item.user?.position || item.user?.sector) && (
                  <Text style={styles.sigMeta}>{[item.user?.position, item.user?.sector].filter(Boolean).join(" · ")}</Text>
                )}
              </View>
              <View style={[styles.contextBadge, item.accepted ? styles.contextBadgeOnboarding : { backgroundColor: "#FEE2E2" }]}>
                <Text style={[styles.contextText, item.accepted ? { color: "#059669" } : { color: "#DC2626" }]}>
                  {item.accepted ? "Aceito" : "Recusado"}
                </Text>
              </View>
            </View>
            <Text style={styles.sigDate}>{formatDate(item.decidedAt)}</Text>
          </View>
        )}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
    </View>
  );
}

// ── Values tab ────────────────────────────────────────────────────────────────
function ValuesTab() {
  const [search, setSearch] = useState("");

  const { data: confirmations = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-values-confirmations"],
    queryFn: () => api.get("/signatures/admin/values-confirmations"),
  });

  const filtered = confirmations.filter((c: any) => {
    const q = search.toLowerCase();
    return !q || c.user?.name?.toLowerCase().includes(q) || c.user?.email?.toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        <View style={[styles.searchWrap, { flex: 1 }]}>
          <Feather name="search" size={14} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar colaborador..."
            placeholderTextColor={C.placeholder}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={13} color={C.textMuted} /></TouchableOpacity>}
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>{filtered.length} confirmações de valores</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 80 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="star" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhuma confirmação de valores</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.sigCard, styles.sigCardAccepted]}>
            <View style={styles.sigTop}>
              <View style={[styles.sigIcon, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="star" size={16} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sigUserName}>{item.user?.name || "—"}</Text>
                <Text style={styles.sigUserEmail}>{item.user?.email || "—"}</Text>
                {item.context && (
                  <Text style={styles.sigMeta}>Contexto: {item.context}</Text>
                )}
              </View>
              <View style={[styles.contextBadge, styles.contextBadgeOnboarding]}>
                <Text style={[styles.contextText, { color: "#059669" }]}>Confirmado</Text>
              </View>
            </View>
            <Text style={styles.sigDate}>{formatDate(item.confirmedAt)}</Text>
          </View>
        )}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminSignaturesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeTab, setActiveTab] = useState<TabId>("signatures");

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Assinaturas & Termos</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Feather name={tab.icon as any} size={13} color={activeTab === tab.id ? C.tint : C.textMuted} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "signatures" && <SignaturesTab />}
      {activeTab === "image_terms" && <ImageTermsTab />}
      {activeTab === "values" && <ValuesTab />}
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
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },

  tabBar: { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: C.tint },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted },
  tabTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  filterBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 13, color: C.text, fontFamily: "Inter_400Regular" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#BFDBFE" },
  exportBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  docChipRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  docChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, maxWidth: 200 },
  docChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  docChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  docChipTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },

  summaryRow: { paddingHorizontal: 12, paddingBottom: 6 },
  summaryText: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  listContent: { paddingHorizontal: 12, gap: 8 },

  sigCard: { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, gap: 6 },
  sigCardAccepted: { borderColor: "#BBF7D0" },
  sigCardRefused: { borderColor: "#FCA5A5" },
  sigTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sigIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sigDocTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 1 },
  sigUserName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  sigUserEmail: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  sigMeta: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  sigConfText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 16 },
  sigDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },

  contextBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  contextBadgeOnboarding: { backgroundColor: "#DCFCE7" },
  contextBadgeIntegra: { backgroundColor: "#EFF6FF" },
  contextText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  contextTextOnboarding: { color: "#059669" },
  contextTextIntegra: { color: C.tint },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
