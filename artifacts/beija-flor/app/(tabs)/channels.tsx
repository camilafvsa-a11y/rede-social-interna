import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const ICON_MAP: Record<string, string> = {
  globe: "globe", megaphone: "volume-2", "trending-up": "trending-up",
  briefcase: "briefcase", droplet: "droplet", coffee: "coffee", award: "award",
  hash: "hash", users: "users", default: "hash",
};

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: channels = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Canais</Text>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.channelItem}
            onPress={() => router.push(`/channel/${item.id}`)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, item.isInternalComm && styles.iconContainerComm]}>
              <Feather
                name={(ICON_MAP[item.icon] as any) || "hash"}
                size={20}
                color={item.isInternalComm ? "#fff" : C.tint}
              />
            </View>
            <View style={styles.channelInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.channelName}>{item.name}</Text>
                {item.isInternalComm && (
                  <View style={styles.commBadge}>
                    <Text style={styles.commBadgeText}>Oficial</Text>
                  </View>
                )}
              </View>
              {item.description && (
                <Text style={styles.channelDesc} numberOfLines={1}>{item.description}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={C.tint} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="hash" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum canal disponível</Text>
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
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  listContent: { padding: 16, gap: 8 },
  channelItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  iconContainer: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
  },
  iconContainerComm: { backgroundColor: C.tint },
  channelInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  channelName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  channelDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  commBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  commBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: C.textSecondary },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
