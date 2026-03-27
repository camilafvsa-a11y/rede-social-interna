import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { useNotifications } from "@/context/NotificationContext";

const C = Colors.light;

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  comunicacao_interna: { icon: "megaphone", color: "#2563EB", bg: "#EFF6FF" },
  mention: { icon: "at-sign", color: "#7C3AED", bg: "#F5F3FF" },
  generic: { icon: "bell", color: "#D97706", bg: "#FFFBEB" },
};

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { refreshUnread } = useNotifications();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  const handlePress = useCallback((item: any) => {
    if (!item.read) readOne.mutate(item.id);
    if (item.data?.postId) {
      router.push(`/post/${item.data.postId}` as any);
    }
  }, []);

  const unreadCount = notifs.filter((n: any) => !n.read).length;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificações</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => readAll.mutate()}
            disabled={readAll.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {readAll.isPending
              ? <ActivityIndicator size="small" color={C.tint} />
              : <Text style={styles.readAllBtn}>Marcar todas</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="bell-off" size={32} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptyDesc}>Você verá aqui novas publicações e menções.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={C.tint} />}
          renderItem={({ item }) => {
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.generic;
            return (
              <TouchableOpacity
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Feather name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.cardTime}>{formatRelative(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.cardBody2} numberOfLines={2}>{item.body}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  readAllBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 19 },

  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === "web" ? 118 : 24, gap: 6 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.borderLight,
  },
  cardUnread: { borderColor: "#BFDBFE", backgroundColor: "#F0F6FF" },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1, marginRight: 6 },
  cardTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", flexShrink: 0 },
  cardBody2: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.tint, flexShrink: 0,
  },
});
