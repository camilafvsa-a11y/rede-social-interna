import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Platform, Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { TICKET_CATEGORIES } from "@/constants/tickets";

const C = Colors.light;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; nextLabel?: string; next?: string }> = {
  open:        { label: "Aberto",         color: "#166534", bg: "#DCFCE7", next: "in_progress", nextLabel: "Iniciar" },
  in_progress: { label: "Em Atendimento", color: "#92400E", bg: "#FEF3C7", next: "closed",      nextLabel: "Resolver" },
  closed:      { label: "Resolvido",      color: "#6B7280", bg: "#F3F4F6", next: "open",        nextLabel: "Reabrir" },
};

const catInfo = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c.label, c]));

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return date.toLocaleDateString("pt-BR");
}

interface TicketItem {
  id: number;
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  category: string;
  authorId: number;
  author: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
  messageCount: number;
  createdAt: string;
}

interface HandlerEntry {
  id: number;
  category: string;
}

// ── Meus Chamados tab ──────────────────────────────────────────────────────────
function MeusChamadosTab() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<TicketItem[]>({
    queryKey: ["tickets-mine", filter],
    queryFn: () => api.get(`/tickets?mine=true${filter ? `&status=${filter}` : ""}`),
  });

  return (
    <FlatList<TicketItem>
      data={tickets}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          tintColor={C.tint}
        />
      }
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.filters}>
          {([null, "open", "in_progress", "closed"] as const).map((s) => (
            <TouchableOpacity
              key={String(s)}
              style={[styles.filterChip, filter === s && styles.filterChipActive]}
              onPress={() => setFilter(s)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
                {s === null ? "Todos" : STATUS_CONFIG[s]?.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <Feather name="help-circle" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum chamado</Text>
            <Text style={styles.emptyHint}>Abra um chamado para solicitar suporte</Text>
            <TouchableOpacity onPress={() => router.push("/new-ticket")} style={styles.newBtnEmpty}>
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.newBtnEmptyText}>Abrir novo chamado</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
        const cat = catInfo[item.category];
        return (
          <TouchableOpacity
            style={styles.ticketCard}
            onPress={() => router.push(`/ticket/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.ticketTop}>
              <Text style={styles.ticketTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
              </View>
            </View>
            <View style={styles.catRow}>
              {cat && <Feather name={cat.icon} size={11} color={cat.color} />}
              <Text style={[styles.ticketCategory, cat && { color: cat.color }]}>{item.category}</Text>
            </View>
            <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.ticketFooter}>
              <Text style={styles.ticketMeta}>{timeAgo(item.createdAt)}</Text>
              {item.assignedTo && (
                <>
                  <Text style={styles.ticketMeta}>·</Text>
                  <Feather name="user-check" size={11} color="#059669" />
                  <Text style={[styles.ticketMeta, { color: "#059669" }]}>{item.assignedTo.name}</Text>
                </>
              )}
              <View style={{ flex: 1 }} />
              <Feather name="message-circle" size={14} color={C.textMuted} />
              <Text style={styles.ticketMeta}>{item.messageCount}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Atendimento tab ────────────────────────────────────────────────────────────
function AtendimentoTab({ isAdmin }: { isAdmin: boolean }) {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>("open");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: tickets = [], isLoading, refetch } = useQuery<TicketItem[]>({
    queryKey: ["tickets-queue", filter],
    queryFn: () => api.get(`/tickets${filter ? `?status=${filter}` : ""}`),
  });

  async function changeStatus(ticketId: number, newStatus: string) {
    setActionLoading(ticketId);
    try {
      await api.patch(`/tickets/${ticketId}`, { status: newStatus });
      await qc.invalidateQueries({ queryKey: ["tickets-queue"] });
      await qc.invalidateQueries({ queryKey: ["tickets-mine"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setActionLoading(null);
    }
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <FlatList<TicketItem>
      data={tickets}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
          tintColor={C.tint}
        />
      }
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.statValue, { color: "#166534" }]}>{openCount}</Text>
              <Text style={[styles.statLabel, { color: "#166534" }]}>Abertos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.statValue, { color: "#92400E" }]}>{inProgressCount}</Text>
              <Text style={[styles.statLabel, { color: "#92400E" }]}>Em Atendimento</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => router.push("/admin/tickets" as any)}
                activeOpacity={0.8}
              >
                <Feather name="settings" size={14} color={C.tint} />
                <Text style={styles.manageBtnText}>Gerenciar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {([null, "open", "in_progress", "closed"] as const).map((s) => (
              <TouchableOpacity
                key={String(s)}
                style={[styles.filterChip, filter === s && styles.filterChipActive]}
                onPress={() => setFilter(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
                  {s === null ? "Todos" : STATUS_CONFIG[s]?.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>Fila limpa!</Text>
            <Text style={styles.emptyHint}>Nenhum chamado pendente neste filtro</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
        const cat = catInfo[item.category];
        const isActioning = actionLoading === item.id;

        return (
          <TouchableOpacity
            style={styles.queueCard}
            onPress={() => router.push(`/ticket/${item.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.queueCardTop}>
              <View style={[styles.catPill, cat && { backgroundColor: cat.bg }]}>
                {cat && <Feather name={cat.icon} size={10} color={cat.color} />}
                <Text style={[styles.catPillText, cat && { color: cat.color }]}>{item.category}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
              </View>
            </View>

            <Text style={styles.ticketTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.ticketDesc} numberOfLines={1}>{item.description}</Text>

            <View style={styles.queueMeta}>
              <Feather name="user" size={11} color={C.textMuted} />
              <Text style={styles.ticketMeta}>{item.author?.name ?? "—"}</Text>
              <Text style={styles.ticketMeta}>·</Text>
              <Feather name="clock" size={11} color={C.textMuted} />
              <Text style={styles.ticketMeta}>{timeAgo(item.createdAt)}</Text>
              {item.assignedTo && (
                <>
                  <Text style={styles.ticketMeta}>·</Text>
                  <Feather name="user-check" size={11} color="#059669" />
                  <Text style={[styles.ticketMeta, { color: "#059669" }]}>{item.assignedTo.name}</Text>
                </>
              )}
              <View style={{ flex: 1 }} />
              <Feather name="message-circle" size={12} color={C.textMuted} />
              <Text style={styles.ticketMeta}>{item.messageCount}</Text>
            </View>

            {sc.next && sc.nextLabel && (
              <TouchableOpacity
                style={[styles.queueAction, { backgroundColor: STATUS_CONFIG[sc.next].bg }]}
                onPress={(e) => { e.stopPropagation?.(); changeStatus(item.id, sc.next!); }}
                disabled={isActioning}
                activeOpacity={0.8}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color={STATUS_CONFIG[sc.next].color} />
                ) : (
                  <>
                    <Feather name="arrow-right-circle" size={13} color={STATUS_CONFIG[sc.next].color} />
                    <Text style={[styles.queueActionText, { color: STATUS_CONFIG[sc.next].color }]}>{sc.nextLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"meus" | "atendimento">("meus");

  const { data: handlerEntries = [] } = useQuery<HandlerEntry[]>({
    queryKey: ["my-handler-profile"],
    queryFn: () => api.get("/tickets/handler/me"),
    enabled: !!user,
  });

  const isAdmin = user?.role === "admin" || user?.role === "master_admin";
  const isHandler = handlerEntries.length > 0;
  const canAttend = isAdmin || isHandler;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Chamados</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/new-ticket")}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Sub-tabs — only show second tab if user has permission */}
      {canAttend ? (
        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[styles.subTab, activeTab === "meus" && styles.subTabActive]}
            onPress={() => setActiveTab("meus")}
            activeOpacity={0.8}
          >
            <Feather name="inbox" size={14} color={activeTab === "meus" ? C.tint : C.textMuted} />
            <Text style={[styles.subTabText, activeTab === "meus" && styles.subTabTextActive]}>
              Meus Chamados
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, activeTab === "atendimento" && styles.subTabActive]}
            onPress={() => setActiveTab("atendimento")}
            activeOpacity={0.8}
          >
            <Feather name="headphones" size={14} color={activeTab === "atendimento" ? C.tint : C.textMuted} />
            <Text style={[styles.subTabText, activeTab === "atendimento" && styles.subTabTextActive]}>
              Atendimento
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: botPad }}>
        {activeTab === "meus" || !canAttend ? (
          <MeusChamadosTab />
        ) : (
          <AtendimentoTab isAdmin={isAdmin} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  newBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },

  // Sub-tabs
  subTabBar: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16,
  },
  subTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 12, paddingHorizontal: 16, marginRight: 4,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  subTabActive: { borderBottomColor: C.tint },
  subTabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textMuted },
  subTabTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  // Filters
  filters: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterTextActive: { color: "#fff" },

  // Stats row (Atendimento)
  statsRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  statCard: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  manageBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EFF6FF", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  manageBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  // Lists
  listContent: { padding: 16, gap: 10, paddingBottom: 20 },

  // Ticket card (Meus Chamados)
  ticketCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 4,
  },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ticketCategory: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  ticketDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ticketFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  ticketMeta: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  // Queue card (Atendimento)
  queueCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, gap: 6,
    borderLeftWidth: 3, borderLeftColor: C.tint,
  },
  queueCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  catPillText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },
  queueMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  queueAction: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8, borderRadius: 8, marginTop: 2,
  },
  queueActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Empty
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" },
  newBtnEmpty: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.tint, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, marginTop: 6,
  },
  newBtnEmptyText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
