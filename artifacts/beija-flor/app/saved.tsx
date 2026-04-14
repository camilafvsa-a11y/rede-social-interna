import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;
const WEB_TOP = 67;

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? WEB_TOP : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 90;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["posts-saved"],
    queryFn: () => api.get("/posts/saved"),
    staleTime: 30 * 1000,
  });

  const posts: any[] = data?.posts || [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["posts-saved"] });
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posts Salvos</Text>
        <View style={styles.headerRight}>
          {posts.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{posts.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Loading */}
      {isLoading && !refreshing && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.tint} />
          <Text style={styles.loadingText}>Carregando posts salvos...</Text>
        </View>
      )}

      {/* List */}
      {!isLoading && (
        <FlatList
          data={posts}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLikeChange={invalidate}
              onDelete={invalidate}
              onSaveChange={invalidate}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.tint}
              colors={[C.tint]}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Feather name="bookmark" size={44} color={C.tint} />
              </View>
              <Text style={styles.emptyTitle}>Nenhum post salvo</Text>
              <Text style={styles.emptySubText}>
                Toque no ícone{" "}
                <Feather name="bookmark" size={13} color={C.textMuted} /> em
                qualquer post para salvá-lo aqui.
              </Text>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Feather name="arrow-left" size={15} color="#fff" />
                <Text style={styles.backBtnText}>Voltar ao Feed</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  headerRight: {
    minWidth: 32,
    alignItems: "flex-end",
  },
  countBadge: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },

  listContent: {
    paddingTop: 8,
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 10,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
