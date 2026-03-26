import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

const ICON_MAP: Record<string, string> = {
  globe: "🌐", megaphone: "📣", "trending-up": "📈",
  briefcase: "💼", droplet: "⛽", coffee: "🍖", award: "🏆",
  hash: "#", users: "👥", default: "#",
};

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [birthdayBannerDismissed, setBirthdayBannerDismissed] = useState(false);

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: birthdays = [] } = useQuery<any[]>({
    queryKey: ["birthdays-today"],
    queryFn: () => api.get("/birthdays?days=1"),
    staleTime: 10 * 60 * 1000,
  });

  const todayBirthdays = (birthdays as any[]).filter((b: any) => b.daysUntil === 0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feed", selectedChannel],
    queryFn: () =>
      api.get(selectedChannel
        ? `/posts?channelId=${selectedChannel}&limit=40`
        : "/posts?limit=40"),
  });

  const posts = data?.posts || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const ListHeader = (
    <View>
      {/* Create post box */}
      <TouchableOpacity
        style={styles.createBox}
        onPress={() => router.push("/channel/create-post")}
        activeOpacity={0.85}
      >
        <View style={styles.createAvatar}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.createAvatarImg} />
          ) : (
            <Text style={styles.createAvatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.createInputFake}>
          <Text style={styles.createPlaceholder}>O que você está pensando?</Text>
        </View>
        <View style={styles.createImageBtn}>
          <Feather name="image" size={18} color={C.tint} />
        </View>
      </TouchableOpacity>

      {/* Channel filter hint */}
      {selectedChannel && (
        <View style={styles.filterBanner}>
          <Feather name="filter" size={13} color={C.tint} />
          <Text style={styles.filterBannerText}>
            Filtrando por: <Text style={{ fontFamily: "Inter_700Bold" }}>
              #{channels.find((c: any) => c.id === selectedChannel)?.name}
            </Text>
          </Text>
          <TouchableOpacity onPress={() => setSelectedChannel(null)}>
            <Feather name="x" size={14} color={C.tint} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        <TouchableOpacity
          style={styles.newPostBtn}
          onPress={() => router.push("/channel/create-post")}
          activeOpacity={0.8}
        >
          <Feather name="edit-3" size={20} color={C.tint} />
        </TouchableOpacity>
      </View>

      {/* Birthday banner — shown only on days with birthdays, dismissible */}
      {todayBirthdays.length > 0 && !birthdayBannerDismissed && (
        <TouchableOpacity
          style={styles.birthdayBanner}
          onPress={() => router.push("/(tabs)/birthdays")}
          activeOpacity={0.88}
        >
          <Text style={styles.birthdayBannerEmoji}>🎂</Text>
          <Text style={styles.birthdayBannerText} numberOfLines={1}>
            {todayBirthdays.length === 1
              ? `${todayBirthdays[0].name} faz aniversário hoje!`
              : `${todayBirthdays.slice(0, 2).map((b: any) => b.name.split(" ")[0]).join(" e ")}${todayBirthdays.length > 2 ? ` +${todayBirthdays.length - 2}` : ""} fazem aniversário hoje!`}
          </Text>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); setBirthdayBannerDismissed(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={15} color="#166534" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Channel filter bar */}
      <View style={styles.channelBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.channelBarContent}
        >
          {/* "Todos" pill */}
          <TouchableOpacity
            style={[styles.channelPill, selectedChannel === null && styles.channelPillActive]}
            onPress={() => setSelectedChannel(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.channelPillText, selectedChannel === null && styles.channelPillTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>

          {channels.map((ch: any) => {
            const active = selectedChannel === ch.id;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[styles.channelPill, active && styles.channelPillActive]}
                onPress={() => setSelectedChannel(active ? null : ch.id)}
                activeOpacity={0.8}
              >
                {ch.isInternalComm && (
                  <Feather name="shield" size={11} color={active ? "#fff" : C.tint} style={{ marginRight: 3 }} />
                )}
                <Text style={[styles.channelPillText, active && styles.channelPillTextActive]}>
                  {ch.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Posts list */}
      <FlatList
        data={posts}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard post={item} onLikeChange={refetch} onDelete={refetch} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} colors={[C.tint]} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="inbox" size={36} color={C.tint} />
              </View>
              <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
              <Text style={styles.emptySubText}>
                {selectedChannel
                  ? "Nenhum post neste canal. Seja o primeiro!"
                  : "Seja o primeiro a publicar algo!"}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/channel/create-post")}
                activeOpacity={0.8}
              >
                <Feather name="edit-3" size={15} color="#fff" />
                <Text style={styles.emptyBtnText}>Criar publicação</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && !refreshing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  greeting: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  newPostBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
  },

  /* Channel bar */
  channelBarWrapper: {
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  channelBarContent: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row",
  },
  channelPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1, borderColor: C.border,
  },
  channelPillActive: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  channelPillText: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary,
  },
  channelPillTextActive: { color: "#fff" },

  /* Create post */
  createBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface,
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
    padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  createAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  createAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  createAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  createInputFake: {
    flex: 1, backgroundColor: C.inputBg,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: C.borderLight,
  },
  createPlaceholder: { color: C.placeholder, fontFamily: "Inter_400Regular", fontSize: 14 },
  createImageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },

  /* Filter banner */
  filterBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 14, marginBottom: 4, marginTop: 2,
    backgroundColor: "#f0fdf4", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  filterBannerText: { flex: 1, fontSize: 12, color: C.tint, fontFamily: "Inter_400Regular" },

  /* List */
  listContent: { paddingTop: 4 },

  /* Empty */
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySubText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.tint, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, marginTop: 4,
  },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  /* Birthday banner */
  birthdayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#BBF7D0",
  },
  birthdayBannerEmoji: { fontSize: 18 },
  birthdayBannerText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#166534",
  },
});
