import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { useNotifications } from "@/context/NotificationContext";

const C = Colors.light;

// ─── Type config ──────────────────────────────────────────────────────────────
type TypeCfg = {
  icon: any;
  color: string;
  bg: string;
  label: string;
  priority: "high" | "medium" | "low";
};

const TYPE_CONFIG: Record<string, TypeCfg> = {
  comunicacao_interna: { icon: "star",              color: "#D97706", bg: "#FFFBEB",  label: "Comunicação Interna", priority: "high" },
  broadcast:           { icon: "bell",              color: "#2563EB", bg: "#EFF6FF",  label: "Comunicado Oficial",  priority: "high" },
  doc_sign_required:   { icon: "edit-3",            color: "#DC2626", bg: "#FEF2F2",  label: "Assinatura pendente", priority: "high" },
  doc_read_required:   { icon: "book-open",         color: "#D97706", bg: "#FFFBEB",  label: "Leitura obrigatória", priority: "high" },
  doc_new:             { icon: "file-text",         color: "#059669", bg: "#F0FDF4",  label: "Novo documento",      priority: "medium" },
  doc_signed:          { icon: "check-circle",      color: "#059669", bg: "#F0FDF4",  label: "Doc. assinado",       priority: "low" },
  doc_read:            { icon: "check",             color: "#059669", bg: "#F0FDF4",  label: "Leitura confirmada",  priority: "low" },
  dm:                  { icon: "message-circle",    color: "#7C3AED", bg: "#F5F3FF",  label: "Mensagem privada",    priority: "high" },
  comment:             { icon: "message-circle",    color: "#0891B2", bg: "#ECFEFF",  label: "Comentário",          priority: "medium" },
  comment_reply:       { icon: "corner-down-right", color: "#0891B2", bg: "#ECFEFF",  label: "Resposta",            priority: "medium" },
  mention:             { icon: "at-sign",           color: "#7C3AED", bg: "#F5F3FF",  label: "Menção",              priority: "medium" },
  post_new:            { icon: "file-plus",         color: "#059669", bg: "#F0FDF4",  label: "Nova publicação",     priority: "low" },
  onboarding_pending:  { icon: "alert-circle",      color: "#D97706", bg: "#FFFBEB",  label: "Pendência",           priority: "medium" },
  like:                { icon: "heart",             color: "#E11D48", bg: "#FFF1F2",  label: "Curtida",             priority: "low" },
  share:               { icon: "share-2",           color: "#059669", bg: "#F0FDF4",  label: "Compartilhamento",    priority: "low" },
  generic:             { icon: "bell",              color: "#D97706", bg: "#FFFBEB",  label: "Notificação",         priority: "medium" },
};

const DEFAULT_CFG: TypeCfg = TYPE_CONFIG.generic;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getRoutePath(item: any): string | null {
  if (item.routePath) return item.routePath;
  const d = item.data || {};
  if (d.postId) return `/post/${d.postId}`;
  if (d.convId) return `/messages/${d.convId}`;
  if (d.docKey) return "/integra";
  return null;
}

// ─── Notification card ───────────────────────────────────────────────────────
function NotifCard({ item, onPress, onArchive }: {
  item: any;
  onPress: (item: any) => void;
  onArchive: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? DEFAULT_CFG;
  const isComm = item.type === "comunicacao_interna";
  const isBroadcast = item.type === "broadcast";
  const isHighPriority = cfg.priority === "high";

  return (
    <View style={[
      styles.card,
      !item.read && styles.cardUnread,
      isComm && styles.cardComm,
      !item.read && isHighPriority && { borderLeftWidth: 3, borderLeftColor: cfg.color },
    ]}>
      <TouchableOpacity
        style={styles.cardInner}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: isComm ? "#FEF9C3" : cfg.bg }]}>
          {isComm ? (
            <Text style={{ fontSize: 20 }}>⭐</Text>
          ) : (
            <Feather name={cfg.icon} size={18} color={cfg.color} />
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              {(isComm || isBroadcast) && (
                <View style={[styles.typeBadge, {
                  backgroundColor: isComm ? "#FFFBEB" : cfg.bg,
                  borderWidth: 1,
                  borderColor: isComm ? "#FDE68A" : cfg.color + "40",
                }]}>
                  {isComm && <Text style={{ fontSize: 9 }}>⭐</Text>}
                  {!isComm && <Feather name="bell" size={9} color={cfg.color} />}
                  <Text style={[styles.typeBadgeText, { color: isComm ? "#92400E" : cfg.color }]}>{cfg.label}</Text>
                </View>
              )}
              <Text style={[
                styles.cardTitle,
                isComm && { color: "#92400E", fontFamily: "Inter_700Bold" },
                isBroadcast && { color: cfg.color },
                !item.read && { fontFamily: "Inter_600SemiBold" },
              ]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.cardTime}>{formatRelative(item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardBody, !item.read && { color: C.text }]} numberOfLines={2}>
            {item.body}
          </Text>
        </View>

        {/* Unread dot */}
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: isComm ? "#F59E0B" : cfg.color }]} />}
      </TouchableOpacity>

      {/* Archive button */}
      <TouchableOpacity style={styles.archiveBtn} onPress={() => onArchive(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={14} color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {count > 0 && <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{count}</Text></View>}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { refreshUnread } = useNotifications();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [filterType, setFilterType] = useState<string | null>(null);

  const { data: notifs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
  });

  const readOne = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/read/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); refreshUnread(); },
  });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); refreshUnread(); },
  });

  const archiveOne = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/archive/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); refreshUnread(); },
  });

  const handlePress = useCallback((item: any) => {
    if (!item.read) readOne.mutate(item.id);
    const path = getRoutePath(item);
    if (path) router.push(path as any);
  }, []);

  const handleArchive = useCallback((id: number) => {
    archiveOne.mutate(id);
  }, []);

  const unreadCount = notifs.filter((n: any) => !n.read).length;

  // Separate high-priority (unread) from rest, applying filter if set
  const filtered = filterType ? notifs.filter((n: any) => n.type === filterType) : notifs;
  const highPriority = filtered.filter((n: any) => !n.read && (TYPE_CONFIG[n.type]?.priority === "high" || n.priority === "high"));
  const rest = filtered.filter((n: any) => !highPriority.includes(n));

  // Build flat list data
  type Row =
    | { kind: "section"; label: string; count: number; key: string }
    | { kind: "notif"; item: any; key: string };

  const listData: Row[] = [];
  if (highPriority.length > 0) {
    listData.push({ kind: "section", label: "Importantes", count: highPriority.filter((n: any) => !n.read).length, key: "s-high" });
    highPriority.forEach((n: any) => listData.push({ kind: "notif", item: n, key: `n-${n.id}` }));
  }
  if (rest.length > 0) {
    if (highPriority.length > 0) {
      listData.push({ kind: "section", label: "Outras notificações", count: rest.filter((n: any) => !n.read).length, key: "s-rest" });
    }
    rest.forEach((n: any) => listData.push({ kind: "notif", item: n, key: `n-${n.id}` }));
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notificações</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => readAll.mutate()} disabled={readAll.isPending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {readAll.isPending
              ? <ActivityIndicator size="small" color={C.tint} />
              : <Text style={styles.readAllBtn}>Marcar lidas</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Filter chips */}
      {notifs.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !filterType && styles.filterChipActive]}
            onPress={() => setFilterType(null)}
          >
            <Text style={[styles.filterChipText, !filterType && styles.filterChipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {(["comunicacao_interna", "doc_sign_required", "doc_new", "comment", "dm", "mention"] as string[])
            .filter((t) => notifs.some((n: any) => n.type === t))
            .map((t) => {
              const cfg = TYPE_CONFIG[t] ?? DEFAULT_CFG;
              const active = filterType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                  onPress={() => setFilterType(active ? null : t)}
                >
                  <Feather name={cfg.icon} size={11} color={active ? "#fff" : cfg.color} />
                  <Text style={[styles.filterChipText, active && { color: "#fff" }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="bell-off" size={32} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptyDesc}>
            {filterType ? "Nenhuma notificação desse tipo." : "Você verá aqui novas publicações, mensagens e alertas."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={C.tint} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) => {
            if (row.kind === "section") {
              return <SectionHeader label={row.label} count={row.count} />;
            }
            return (
              <NotifCard
                item={row.item}
                onPress={handlePress}
                onArchive={handleArchive}
              />
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  headerBadge: {
    backgroundColor: C.tint, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center",
  },
  headerBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  readAllBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  filterRow: {
    flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    flexWrap: "nowrap",
  },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterChipTextActive: { color: "#fff" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.7 },
  sectionBadge: { backgroundColor: C.tint, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  sectionBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 19 },

  listContent: { paddingTop: 4, gap: 4 },

  card: {
    flexDirection: "row",
    backgroundColor: C.surface,
    marginHorizontal: 10, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderLight,
    overflow: "hidden",
  },
  cardUnread: { borderColor: "#BFDBFE", backgroundColor: "#F8FBFF" },
  cardComm: { borderColor: "#BFDBFE", borderWidth: 1.5 },
  cardInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  priorityBar: { width: 3, alignSelf: "stretch", borderRadius: 2, marginRight: 2 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 3 },
  cardTopLeft: { flex: 1, marginRight: 6 },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    alignSelf: "flex-start", marginBottom: 3,
  },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  cardTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", flexShrink: 0 },
  cardBody: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 17 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0, marginLeft: 4 },
  archiveBtn: { paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
});
