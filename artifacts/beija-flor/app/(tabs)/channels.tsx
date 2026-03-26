import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Image,
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
        <Text style={styles.subtitle}>{channels.length} canal{channels.length !== 1 ? "is" : ""} disponíve{channels.length !== 1 ? "is" : "l"}</Text>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.channelCard}
            onPress={() => router.push(`/channel/${item.id}`)}
            activeOpacity={0.85}
          >
            {/* Cover image or icon */}
            {item.coverImageUrl ? (
              <View style={styles.coverWrap}>
                <Image source={{ uri: item.coverImageUrl }} style={styles.coverImg} resizeMode="cover" />
                {/* Icon overlay */}
                <View style={[styles.iconOverlay, item.isInternalComm && styles.iconOverlayComm]}>
                  <Feather
                    name={(ICON_MAP[item.icon] as any) || "hash"}
                    size={14}
                    color={item.isInternalComm ? "#fff" : C.tint}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.iconContainer, item.isInternalComm && styles.iconContainerComm]}>
                <Feather
                  name={(ICON_MAP[item.icon] as any) || "hash"}
                  size={22}
                  color={item.isInternalComm ? "#fff" : C.tint}
                />
              </View>
            )}

            {/* Channel info */}
            <View style={styles.channelInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.channelName}>{item.name}</Text>
                {item.isInternalComm && (
                  <View style={styles.commBadge}>
                    <Feather name="shield" size={9} color={C.tint} />
                    <Text style={styles.commBadgeText}>Oficial</Text>
                  </View>
                )}
              </View>
              {item.description ? (
                <Text style={styles.channelDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </View>

            <Feather name="chevron-right" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
            tintColor={C.tint}
          />
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
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },

  listContent: { padding: 14, gap: 10 },

  channelCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
    borderWidth: 1, borderColor: C.borderLight,
    padding: 12,
  },

  /* Cover image variant */
  coverWrap: { position: "relative", width: 56, height: 42, borderRadius: 10, overflow: "hidden" },
  coverImg: { width: "100%", height: "100%" },
  iconOverlay: {
    position: "absolute", bottom: 3, right: 3,
    width: 20, height: 20, borderRadius: 5,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },
  iconOverlayComm: { backgroundColor: C.tint },

  /* Icon-only variant */
  iconContainer: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
  },
  iconContainerComm: { backgroundColor: C.tint },

  channelInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  channelName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  channelDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 3 },
  commBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EFF6FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  commBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.tint },

  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: C.textSecondary },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
