import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Platform, TextInput, Modal, Pressable, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Type config (mirrors frontend notifications.tsx) ────────────────────────
const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  comunicacao_interna: { icon: "megaphone",         color: "#2563EB", bg: "#EFF6FF",  label: "Comunicação Interna" },
  broadcast:           { icon: "bell",              color: "#2563EB", bg: "#EFF6FF",  label: "Comunicado Oficial" },
  doc_sign_required:   { icon: "edit-3",            color: "#DC2626", bg: "#FEF2F2",  label: "Assinatura pendente" },
  doc_read_required:   { icon: "book-open",         color: "#D97706", bg: "#FFFBEB",  label: "Leitura obrigatória" },
  doc_new:             { icon: "file-text",         color: "#059669", bg: "#F0FDF4",  label: "Novo documento" },
  dm:                  { icon: "mail",              color: "#7C3AED", bg: "#F5F3FF",  label: "Mensagem privada" },
  comment:             { icon: "message-circle",    color: "#0891B2", bg: "#ECFEFF",  label: "Comentário" },
  comment_reply:       { icon: "corner-down-right", color: "#0891B2", bg: "#ECFEFF",  label: "Resposta" },
  mention:             { icon: "at-sign",           color: "#7C3AED", bg: "#F5F3FF",  label: "Menção" },
  post_new:            { icon: "file-plus",         color: "#059669", bg: "#F0FDF4",  label: "Nova publicação" },
  onboarding_pending:  { icon: "alert-circle",      color: "#D97706", bg: "#FFFBEB",  label: "Pendência onboarding" },
  generic:             { icon: "bell",              color: "#D97706", bg: "#FFFBEB",  label: "Notificação" },
};

const DEFAULT_CFG = TYPE_CONFIG.generic;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────
function BroadcastModal({ visible, onClose, onSent }: {
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [routePath, setRoutePath] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Atenção", "Título e mensagem são obrigatórios."); return;
    }
    setSending(true);
    try {
      await api.post("/notifications/admin/broadcast", { title: title.trim(), body: body.trim(), routePath: routePath.trim() || undefined });
      Alert.alert("Enviado!", "Comunicado enviado para todos os usuários.");
      setTitle(""); setBody(""); setRoutePath("");
      onSent();
      onClose();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📢 Enviar comunicado</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalDesc}>
            O comunicado será enviado como notificação para <Text style={{ fontFamily: "Inter_700Bold" }}>todos os usuários</Text> do app.
          </Text>
          <Text style={styles.fieldLabel}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Novo aviso da diretoria"
            placeholderTextColor={C.placeholder}
            maxLength={100}
          />
          <Text style={styles.fieldLabel}>Mensagem *</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={body}
            onChangeText={setBody}
            placeholder="Escreva o conteúdo do comunicado..."
            placeholderTextColor={C.placeholder}
            multiline
            maxLength={300}
          />
          <Text style={styles.fieldLabel}>Link opcional (ex: /post/123)</Text>
          <TextInput
            style={styles.input}
            value={routePath}
            onChangeText={setRoutePath}
            placeholder="/post/123 ou /integra"
            placeholderTextColor={C.placeholder}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!title.trim() || !body.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!title.trim() || !body.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Feather name="send" size={16} color="#fff" /><Text style={styles.sendBtnText}>Enviar para todos</Text></>
            }
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [filterType, setFilterType] = useState("");
  const [filterRead, setFilterRead] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [tab, setTab] = useState<"list" | "stats">("list");

  const { data: notifs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-notifications", filterType, filterRead, filterPeriod],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterRead) params.set("read", filterRead);
      if (filterPeriod) params.set("period", filterPeriod);
      return api.get(`/notifications/admin?${params.toString()}`);
    },
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["admin-notifications-stats"],
    queryFn: () => api.get("/notifications/admin/stats"),
    staleTime: 30_000,
  });

  const byTypeEntries: [string, number][] = stats?.byType
    ? Object.entries(stats.byType).sort((a: any, b: any) => b[1] - a[1])
    : [];

  const filterChips = [
    { key: "comunicacao_interna", label: "Com. Interna" },
    { key: "dm", label: "DM" },
    { key: "comment", label: "Comentários" },
    { key: "doc_sign_required", label: "Assinaturas" },
    { key: "broadcast", label: "Comunicados" },
    { key: "onboarding_pending", label: "Onboarding" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        <TouchableOpacity
          style={styles.broadcastBtn}
          onPress={() => setBroadcastVisible(true)}
          activeOpacity={0.8}
        >
          <Feather name="send" size={14} color="#fff" />
          <Text style={styles.broadcastBtnText}>Comunicado</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "list" && styles.tabActive]} onPress={() => setTab("list")}>
          <Text style={[styles.tabText, tab === "list" && styles.tabTextActive]}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "stats" && styles.tabActive]} onPress={() => setTab("stats")}>
          <Text style={[styles.tabText, tab === "stats" && styles.tabTextActive]}>Estatísticas</Text>
        </TouchableOpacity>
      </View>

      {tab === "stats" ? (
        <ScrollView contentContainerStyle={[styles.statsContent, { paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 20 }]}>
          {/* Summary stats */}
          <View style={styles.statsGrid}>
            <StatCard icon="bell" label="Total" value={stats?.total ?? 0} color={C.tint} />
            <StatCard icon="eye-off" label="Não lidas" value={stats?.unread ?? 0} color="#DC2626" />
            <StatCard icon="clock" label="Hoje" value={stats?.today ?? 0} color="#059669" />
          </View>

          {/* By type */}
          <Text style={styles.statsSection}>Notificações por tipo</Text>
          {byTypeEntries.map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] ?? DEFAULT_CFG;
            return (
              <View key={type} style={styles.typeRow}>
                <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
                  <Feather name={cfg.icon} size={15} color={cfg.color} />
                </View>
                <Text style={styles.typeLabel}>{cfg.label}</Text>
                <Text style={styles.typeCount}>{count as number}</Text>
                <View style={styles.typeBar}>
                  <View style={[styles.typeBarFill, { width: `${Math.min(100, ((count as number) / (stats?.total || 1)) * 100)}%`, backgroundColor: cfg.color }]} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <>
          {/* Filters */}
          <View style={styles.filterBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {filterChips.map((fc) => {
                const active = filterType === fc.key;
                const cfg = TYPE_CONFIG[fc.key] ?? DEFAULT_CFG;
                return (
                  <TouchableOpacity
                    key={fc.key}
                    style={[styles.filterChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                    onPress={() => setFilterType(active ? "" : fc.key)}
                  >
                    <Feather name={cfg.icon} size={10} color={active ? "#fff" : cfg.color} />
                    <Text style={[styles.filterChipText, active && { color: "#fff" }]}>{fc.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.filterRow2}>
              {/* Read filter */}
              {(["", "false", "true"] as string[]).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.smallChip, filterRead === v && styles.smallChipActive]}
                  onPress={() => setFilterRead(v)}
                >
                  <Text style={[styles.smallChipText, filterRead === v && { color: "#fff" }]}>
                    {v === "" ? "Todas" : v === "false" ? "Não lidas" : "Lidas"}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.divider} />
              {/* Period filter */}
              {(["", "today", "week"] as string[]).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.smallChip, filterPeriod === v && styles.smallChipActive]}
                  onPress={() => setFilterPeriod(v)}
                >
                  <Text style={[styles.smallChipText, filterPeriod === v && { color: "#fff" }]}>
                    {v === "" ? "Período" : v === "today" ? "Hoje" : "7 dias"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Results count */}
          <View style={styles.resultsRow}>
            <Text style={styles.resultsText}>{notifs.length} notificação{notifs.length !== 1 ? "ões" : ""}</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Feather name="refresh-cw" size={14} color={C.tint} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={C.tint} />
            </View>
          ) : notifs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="bell-off" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhuma notificação encontrada</Text>
            </View>
          ) : (
            <FlatList
              data={notifs}
              keyExtractor={(n: any) => String(n.id)}
              contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 20 }]}
              refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={C.tint} />}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const cfg = TYPE_CONFIG[item.type] ?? DEFAULT_CFG;
                return (
                  <View style={[styles.notifCard, !item.read && styles.notifCardUnread]}>
                    <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
                      <Feather name={cfg.icon} size={15} color={cfg.color} />
                    </View>
                    <View style={styles.notifBody}>
                      <View style={styles.notifTop}>
                        <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.typePillText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {!item.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
                        <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.notifBodyText} numberOfLines={2}>{item.body}</Text>
                      <View style={styles.notifMeta}>
                        <Feather name="user" size={11} color={C.textMuted} />
                        <Text style={styles.metaText}>{item.userName}</Text>
                        {item.routePath && (
                          <>
                            <Text style={styles.metaSep}>·</Text>
                            <Feather name="link" size={11} color={C.textMuted} />
                            <Text style={styles.metaText} numberOfLines={1}>{item.routePath}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      <BroadcastModal
        visible={broadcastVisible}
        onClose={() => setBroadcastVisible(false)}
        onSent={() => { qc.invalidateQueries({ queryKey: ["admin-notifications"] }); qc.invalidateQueries({ queryKey: ["admin-notifications-stats"] }); }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  broadcastBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.tint, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
  },
  broadcastBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  tabs: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: C.tint },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary },
  tabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },

  filterBox: {
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingVertical: 10,
  },
  filterScroll: { paddingHorizontal: 12, marginBottom: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt, marginRight: 6,
  },
  filterChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterRow2: { flexDirection: "row", paddingHorizontal: 12, gap: 6, alignItems: "center" },
  smallChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  smallChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  smallChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },
  divider: { width: 1, height: 16, backgroundColor: C.border, marginHorizontal: 4 },

  resultsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  resultsText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.textSecondary },

  list: { paddingTop: 8, paddingHorizontal: 10, gap: 6 },

  notifCard: {
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderLight,
  },
  notifCardUnread: { backgroundColor: "#F8FBFF", borderColor: "#BFDBFE" },
  notifIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typePillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },
  notifTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  notifTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  notifBodyText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 16, marginBottom: 6 },
  notifMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", maxWidth: 120 },
  metaSep: { color: C.textMuted },

  // Stats tab
  statsContent: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.borderLight, borderLeftWidth: 4, alignItems: "center", gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  statsSection: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginTop: 4 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  typeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  typeLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  typeCount: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, minWidth: 30, textAlign: "right" },
  typeBar: { width: 60, height: 4, borderRadius: 2, backgroundColor: C.borderLight, overflow: "hidden" },
  typeBarFill: { height: "100%", borderRadius: 2 },

  // Broadcast modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: C.inputBorder, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
    backgroundColor: C.inputBg,
  },
  inputMulti: { minHeight: 90, textAlignVertical: "top", paddingTop: 12 },
  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, marginTop: 4,
  },
  sendBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
