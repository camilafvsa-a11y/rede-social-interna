import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Aberto", color: "#166534", bg: "#DCFCE7" },
  in_progress: { label: "Em andamento", color: "#92400E", bg: "#FEF3C7" },
  closed: { label: "Encerrado", color: "#6B7280", bg: "#F3F4F6" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return date.toLocaleDateString("pt-BR");
}

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["tickets", filter],
    queryFn: () => api.get(`/tickets${filter ? `?status=${filter}` : ""}`),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
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

      <View style={styles.filters}>
        {[null, "open", "in_progress", "closed"].map((s) => (
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

      <FlatList
        data={tickets}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
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
              <Text style={styles.ticketCategory}>{item.category}</Text>
              <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
              <View style={styles.ticketFooter}>
                <Text style={styles.ticketMeta}>{item.author?.name}</Text>
                <Text style={styles.ticketMeta}>·</Text>
                <Text style={styles.ticketMeta}>{timeAgo(item.createdAt)}</Text>
                <View style={{ flex: 1 }} />
                <Feather name="message-circle" size={14} color={C.textMuted} />
                <Text style={styles.ticketMeta}>{item.messageCount}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={C.tint} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="help-circle" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum chamado</Text>
              <TouchableOpacity onPress={() => router.push("/new-ticket")} style={styles.newBtnEmpty}>
                <Text style={styles.newBtnEmptyText}>Abrir novo chamado</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      )}
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
  newBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  filterTextActive: { color: "#fff" },
  listContent: { padding: 16, gap: 10 },
  ticketCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    gap: 4,
  },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  ticketCategory: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  ticketDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ticketFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  ticketMeta: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: C.textSecondary },
  newBtnEmpty: { backgroundColor: C.tint, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  newBtnEmptyText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
