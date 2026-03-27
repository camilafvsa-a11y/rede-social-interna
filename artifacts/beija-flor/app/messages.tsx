import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString("pt-BR");
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["dms"],
    queryFn: () => api.get("/dms"),
    refetchInterval: 15_000,
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mensagens</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Feather name="send" size={40} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptyText}>Toque no nome de um colega para iniciar uma conversa</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.convRow}
              onPress={() => router.push(`/messages/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.avatarWrap}>
                {item.otherUser?.avatarUrl ? (
                  <Image source={{ uri: item.otherUser.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Feather name="user" size={20} color="#9CA3AF" />
                  </View>
                )}
                {item.unreadCount > 0 && <View style={styles.unreadDot} />}
              </View>

              <View style={styles.convInfo}>
                <View style={styles.convTop}>
                  <Text style={[styles.convName, item.unreadCount > 0 && styles.convNameBold]}>
                    {item.otherUser?.name || "Usuário"}
                  </Text>
                  {item.lastMessage && (
                    <Text style={styles.convTime}>{timeAgo(item.lastMessage.createdAt)}</Text>
                  )}
                </View>
                {item.lastMessage && (
                  <Text style={[styles.convLast, item.unreadCount > 0 && styles.convLastBold]} numberOfLines={1}>
                    {item.lastMessage.content}
                  </Text>
                )}
              </View>

              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center" },
  separator: { height: 1, backgroundColor: C.borderLight, marginLeft: 76 },
  convRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.border },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  unreadDot: {
    position: "absolute", bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.tint, borderWidth: 2, borderColor: C.surface,
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  convNameBold: { fontFamily: "Inter_700Bold" },
  convTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  convLast: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },
  convLastBold: { fontFamily: "Inter_600SemiBold", color: C.text },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
