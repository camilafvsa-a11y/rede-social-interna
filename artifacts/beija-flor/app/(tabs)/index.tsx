import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";
import { Platform } from "react-native";

const C = Colors.light;
const isWeb = Platform.OS === "web";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feed"],
    queryFn: () => api.get("/posts?limit=30"),
  });

  const posts = data?.posts || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        <TouchableOpacity
          style={styles.newPostBtn}
          onPress={() => router.push("/channel/create")}
          activeOpacity={0.8}
        >
          <Feather name="edit-3" size={20} color={C.tint} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard post={item} onLikeChange={refetch} onDelete={refetch} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.createPostCard}
            onPress={() => router.push("/channel/create-post")}
            activeOpacity={0.8}
          >
            <View style={styles.createPostAvatar}>
              <Text style={styles.createPostAvatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.createPostPlaceholder}>O que você está pensando?</Text>
            <Feather name="image" size={20} color={C.textSecondary} />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum post ainda</Text>
              <Text style={styles.emptySubText}>Seja o primeiro a postar!</Text>
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
  greeting: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  newPostBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  createPostCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 16,
    marginHorizontal: 16, marginVertical: 10,
    padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  createPostAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  createPostAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  createPostPlaceholder: { flex: 1, color: C.placeholder, fontFamily: "Inter_400Regular", fontSize: 14 },
  listContent: { paddingTop: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySubText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
