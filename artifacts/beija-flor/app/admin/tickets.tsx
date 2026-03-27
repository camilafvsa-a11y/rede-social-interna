import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Platform, Modal, Alert, Image, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { TICKET_CATEGORIES } from "@/constants/tickets";

const C = Colors.light;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string | null; nextLabel: string | null }> = {
  open:        { label: "Aberto",          color: "#166534", bg: "#DCFCE7", next: "in_progress", nextLabel: "Iniciar Atendimento" },
  in_progress: { label: "Em Atendimento",  color: "#92400E", bg: "#FEF3C7", next: "closed",      nextLabel: "Marcar Resolvido" },
  closed:      { label: "Resolvido",       color: "#6B7280", bg: "#F3F4F6", next: "open",        nextLabel: "Reabrir" },
};

const CAT_COLORS: Record<string, { color: string; bg: string }> = {};
TICKET_CATEGORIES.forEach((c) => { CAT_COLORS[c.label] = { color: c.color, bg: c.bg }; });

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminTicketsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [assignModalTicket, setAssignModalTicket] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-tickets"],
    queryFn: () => api.get("/tickets"),
  });

  const { data: handlers = [] } = useQuery<any[]>({
    queryKey: ["ticket-handlers"],
    queryFn: () => api.get("/tickets/admin/handlers"),
    enabled: !!assignModalTicket,
  });

  const displayed = tickets.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  const total = tickets.length;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;

  async function changeStatus(ticket: any, newStatus: string) {
    setActionLoading(ticket.id);
    try {
      await api.patch(`/tickets/${ticket.id}`, { status: newStatus });
      await qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function assignTicket(ticketId: number, userId: number) {
    try {
      await api.patch(`/tickets/${ticketId}`, { assignedToId: userId });
      await qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      setAssignModalTicket(null);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function unassignTicket(ticketId: number) {
    try {
      await api.patch(`/tickets/${ticketId}`, { assignedToId: null });
      await qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      setAssignModalTicket(null);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const renderHeader = () => (
    <View>
      <View style={styles.counters}>
        {[
          { label: "Total", value: total, color: "#2563EB", bg: "#EFF6FF" },
          { label: "Abertos", value: openCount, color: "#166534", bg: "#DCFCE7" },
          { label: "Atend.", value: inProgressCount, color: "#92400E", bg: "#FEF3C7" },
          { label: "Resolvidos", value: closedCount, color: "#6B7280", bg: "#F3F4F6" },
        ].map((c) => (
          <View key={c.label} style={[styles.counterCard, { backgroundColor: c.bg }]}>
            <Text style={[styles.counterValue, { color: c.color }]}>{c.value}</Text>
            <Text style={[styles.counterLabel, { color: c.color }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Text style={styles.filterLabel}>Status:</Text>
        {[null, "open", "in_progress", "closed"].map((s) => {
          const cfg = s ? STATUS_CONFIG[s] : null;
          const active = filterStatus === s;
          return (
            <TouchableOpacity
              key={String(s)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilterStatus(s)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {cfg ? cfg.label : "Todos"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Text style={styles.filterLabel}>Categoria:</Text>
        {[null, ...TICKET_CATEGORIES.map((c) => c.label)].map((cat) => {
          const active = filterCategory === cat;
          const cc = cat ? CAT_COLORS[cat] : null;
          return (
            <TouchableOpacity
              key={String(cat)}
              style={[styles.filterChip, active && (cc ? { backgroundColor: cc.color, borderColor: cc.color } : styles.filterChipActive)]}
              onPress={() => setFilterCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {cat ?? "Todas"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {displayed.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <Feather name="inbox" size={40} color={C.textMuted} />
          <Text style={styles.emptyText}>Nenhum chamado encontrado</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Chamados</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item: any) => String(item.id)}
          ListHeaderComponent={renderHeader}
          renderItem={({ item: ticket }) => {
            const sc = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const cc = CAT_COLORS[ticket.category] ?? { color: "#6B7280", bg: "#F3F4F6" };
            const isActioning = actionLoading === ticket.id;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/ticket/${ticket.id}` as any)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.catBadge, { backgroundColor: cc.bg }]}>
                    <Text style={[styles.catBadgeText, { color: cc.color }]} numberOfLines={1}>{ticket.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>{ticket.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{ticket.description}</Text>

                <View style={styles.cardMeta}>
                  <View style={styles.metaRow}>
                    <Feather name="user" size={12} color={C.textMuted} />
                    <Text style={styles.metaText}>{ticket.author?.name ?? "—"}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Feather name="clock" size={12} color={C.textMuted} />
                    <Text style={styles.metaText}>{formatDate(ticket.createdAt)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Feather name="message-square" size={12} color={C.textMuted} />
                    <Text style={styles.metaText}>{ticket.messageCount}</Text>
                  </View>
                </View>

                {ticket.assignedTo && (
                  <View style={styles.assignedRow}>
                    <Feather name="user-check" size={12} color="#059669" />
                    <Text style={styles.assignedText}>Delegado para: {ticket.assignedTo.name}</Text>
                  </View>
                )}

                <View style={styles.cardActions}>
                  {sc.next && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: STATUS_CONFIG[sc.next].bg }]}
                      onPress={() => changeStatus(ticket, sc.next!)}
                      disabled={isActioning}
                      activeOpacity={0.8}
                    >
                      {isActioning ? (
                        <ActivityIndicator size="small" color={STATUS_CONFIG[sc.next].color} />
                      ) : (
                        <Text style={[styles.actionBtnText, { color: STATUS_CONFIG[sc.next].color }]}>{sc.nextLabel}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.delegateBtn]}
                    onPress={() => setAssignModalTicket(ticket)}
                    activeOpacity={0.8}
                  >
                    <Feather name="user-plus" size={13} color={C.tint} />
                    <Text style={styles.delegateBtnText}>Delegar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 20 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      <Modal
        visible={!!assignModalTicket}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignModalTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delegar Chamado</Text>
              <TouchableOpacity onPress={() => setAssignModalTicket(null)}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {assignModalTicket?.assignedTo && (
              <View style={styles.currentAssignee}>
                <Feather name="user-check" size={14} color="#059669" />
                <Text style={styles.currentAssigneeText}>
                  Atualmente delegado para: {assignModalTicket.assignedTo.name}
                </Text>
                <TouchableOpacity onPress={() => unassignTicket(assignModalTicket.id)} style={styles.unassignBtn}>
                  <Text style={styles.unassignText}>Remover</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.modalSubtitle}>Escolha um responsável:</Text>

            <FlatList
              data={handlers}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item: h }) => (
                <TouchableOpacity
                  style={[
                    styles.handlerItem,
                    assignModalTicket?.assignedToId === h.userId && styles.handlerItemActive,
                  ]}
                  onPress={() => assignTicket(assignModalTicket.id, h.userId)}
                  activeOpacity={0.8}
                >
                  <View style={styles.handlerAvatar}>
                    {h.user?.avatarUrl ? (
                      <Image source={{ uri: h.user.avatarUrl }} style={styles.handlerAvatarImg} />
                    ) : (
                      <Feather name="user" size={18} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.handlerName}>{h.user?.name ?? "—"}</Text>
                    <Text style={styles.handlerRole}>{h.user?.role ?? ""}</Text>
                  </View>
                  {assignModalTicket?.assignedToId === h.userId && (
                    <Feather name="check-circle" size={18} color={C.tint} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.noHandlers}>
                  <Text style={styles.noHandlersText}>Nenhum responsável cadastrado ainda.</Text>
                </View>
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  counters: {
    flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8,
  },
  counterCard: {
    flex: 1, borderRadius: 12, padding: 12, alignItems: "center",
  },
  counterValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  counterLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: "row", alignItems: "center" },
  filterLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginRight: 2 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterChipTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  list: { paddingHorizontal: 12, paddingTop: 8, gap: 10 },
  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  catBadge: { flex: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },

  cardMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  assignedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  assignedText: { fontSize: 12, color: "#059669", fontFamily: "Inter_500Medium" },

  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  delegateBtn: {
    flexDirection: "row", gap: 5,
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
  },
  delegateBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: C.textMuted, fontFamily: "Inter_500Medium" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "65%", paddingTop: 8 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, paddingHorizontal: 20, paddingVertical: 10 },

  currentAssignee: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ECFDF5", borderRadius: 10, margin: 12, padding: 10,
  },
  currentAssigneeText: { flex: 1, fontSize: 13, color: "#059669", fontFamily: "Inter_500Medium" },
  unassignBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#FEE2E2", borderRadius: 8 },
  unassignText: { fontSize: 12, color: "#DC2626", fontFamily: "Inter_600SemiBold" },

  handlerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  handlerItemActive: { backgroundColor: "#EFF6FF" },
  handlerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  handlerAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  handlerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  handlerRole: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  noHandlers: { alignItems: "center", paddingTop: 40 },
  noHandlersText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
});
