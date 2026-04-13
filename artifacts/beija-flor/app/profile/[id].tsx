import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";
import PostCard from "@/components/PostCard";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Administrativo", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};
const ROLE_LABELS: Record<string, string> = {
  user: "Colaborador", moderator: "Moderador",
  admin: "Administrador", master_admin: "Administrador Master",
};
const BANNER_COLORS = [
  "#1E3A8A", "#1E40AF", "#1D4ED8", "#2563EB",
  "#7C3AED", "#059669", "#DC2626", "#D97706",
];

function getBannerColor(userId: number) {
  return BANNER_COLORS[userId % BANNER_COLORS.length];
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Não informado";
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day} de ${months[month - 1]} de ${year}`;
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[st.infoRow, !last && st.infoRowBorder]}>
      <View style={st.infoIconWrap}>
        <Feather name={icon as any} size={15} color={C.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.infoLabel}>{label}</Text>
        <Text style={st.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

type ProfileTab = "posts" | "fotos" | "videos";

export default function ProfileViewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("posts");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom + 20;

  const userId = parseInt(id ?? "0");
  const isOwnProfile = me?.id === userId;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get(`/users/${id}`),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats", id],
    queryFn: () => api.get(`/posts/user-stats/${id}`),
    enabled: !!id,
  });

  const { data: timelineData, isLoading: postsLoading, refetch } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.get(`/posts/timeline/${id}`),
    enabled: !!id,
  });

  const { data: fotosData, isLoading: fotosLoading } = useQuery({
    queryKey: ["timeline-fotos", id],
    queryFn: () => api.get(`/posts/timeline/${id}?type=image`),
    enabled: !!id && profileTab === "fotos",
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ["timeline-videos", id],
    queryFn: () => api.get(`/posts/timeline/${id}?type=video`),
    enabled: !!id && profileTab === "videos",
  });

  const allPosts = timelineData?.posts ?? [];
  const fotos = fotosData?.posts ?? [];
  const videos = videosData?.posts ?? [];

  const tagStyle = profile?.tag ? (C.tagColors as any)[profile.tag] : null;
  const bannerColor = getBannerColor(userId);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["user", id] }),
      qc.invalidateQueries({ queryKey: ["user-stats", id] }),
      qc.invalidateQueries({ queryKey: ["timeline", id] }),
    ]);
    setRefreshing(false);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["timeline", id] });
    qc.invalidateQueries({ queryKey: ["timeline-fotos", id] });
    qc.invalidateQueries({ queryKey: ["timeline-videos", id] });
  }

  const currentPosts = profileTab === "fotos" ? fotos : profileTab === "videos" ? videos : allPosts;
  const currentLoading = profileTab === "fotos" ? fotosLoading : profileTab === "videos" ? videosLoading : postsLoading;

  const ListHeader = (
    <View>
      {/* ── Banner ── */}
      <View style={[st.banner, { backgroundColor: bannerColor }]}>
        {/* Gradient overlay */}
        <View style={st.bannerOverlay} />
      </View>

      {/* ── Profile card ── */}
      {profileLoading ? (
        <View style={st.cardLoading}><ActivityIndicator size="large" color={C.tint} /></View>
      ) : profile ? (
        <View style={st.profileSection}>
          <View style={st.avatarContainer}>
            <View style={[st.avatarOuter, { borderColor: bannerColor }]}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={st.avatar} />
              ) : (
                <View style={[st.avatarFallback, { backgroundColor: bannerColor }]}>
                  <Text style={st.avatarInitial}>{profile.name?.[0]?.toUpperCase() || "U"}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={st.profileInfo}>
            <Text style={st.name}>{profile.name}</Text>
            <View style={st.badgeRow}>
              <View style={[st.roleBadge, { backgroundColor: bannerColor + "22" }]}>
                <Text style={[st.roleText, { color: bannerColor }]}>{ROLE_LABELS[profile.role] || profile.role}</Text>
              </View>
              {tagStyle && profile.tag && (
                <View style={[st.tagBadge, { backgroundColor: tagStyle.bg }]}>
                  <Text style={[st.tagText, { color: tagStyle.text }]}>{TAG_LABELS[profile.tag]}</Text>
                </View>
              )}
            </View>
            <Text style={st.email}>{profile.email}</Text>

            {/* Action buttons */}
            {!isOwnProfile && (
              <TouchableOpacity
                style={[st.dmBtn, { backgroundColor: bannerColor }]}
                onPress={() => router.push(`/messages/with/${id}` as any)}
                activeOpacity={0.85}
              >
                <Feather name="send" size={14} color="#fff" />
                <Text style={st.dmBtnText}>Enviar Mensagem</Text>
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              <TouchableOpacity
                style={st.editBtn}
                onPress={() => router.push("/(tabs)/profile")}
                activeOpacity={0.85}
              >
                <Feather name="edit-2" size={14} color={C.tint} />
                <Text style={st.editBtnText}>Editar perfil</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats row */}
          {stats && (
            <View style={st.statsRow}>
              <View style={st.statItem}>
                <Text style={st.statValue}>{stats.postCount ?? 0}</Text>
                <Text style={st.statLabel}>Posts</Text>
              </View>
              <View style={st.statDiv} />
              <View style={st.statItem}>
                <Text style={st.statValue}>{stats.totalLikesReceived ?? 0}</Text>
                <Text style={st.statLabel}>Curtidas</Text>
              </View>
              <View style={st.statDiv} />
              <View style={st.statItem}>
                <Text style={st.statValue}>{stats.totalCommentsReceived ?? 0}</Text>
                <Text style={st.statLabel}>Comentários</Text>
              </View>
            </View>
          )}

          {/* Info details */}
          <View style={st.infoCard}>
            {profile.birthDate && (
              <InfoRow icon="gift" label="Aniversário" value={formatDate(profile.birthDate)} />
            )}
            <InfoRow icon="calendar" label="Admissão" value={formatDate(profile.admissionDate)} last={!profile.extraTags?.length} />
            {profile.extraTags?.length > 0 && (
              <View style={[st.infoRow, { alignItems: "flex-start" }]}>
                <View style={st.infoIconWrap}><Feather name="tag" size={15} color={C.tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.infoLabel}>Setores</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {profile.extraTags.map((t: string, i: number) => (
                      <View key={i} style={st.extraTag}><Text style={st.extraTagText}>{t}</Text></View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={st.cardLoading}>
          <Text style={st.errorText}>Usuário não encontrado</Text>
        </View>
      )}

      {/* ── Profile sub-tabs ── */}
      <View style={st.subTabBar}>
        {([
          { key: "posts", label: "Linha do Tempo", icon: "grid" },
          { key: "fotos", label: "Fotos", icon: "image" },
          { key: "videos", label: "Vídeos", icon: "video" },
        ] as Array<{ key: ProfileTab; label: string; icon: string }>).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[st.subTab, profileTab === tab.key && st.subTabActive]}
            onPress={() => setProfileTab(tab.key)}
            activeOpacity={0.8}
          >
            <Feather name={tab.icon as any} size={14} color={profileTab === tab.key ? C.tint : C.textMuted} />
            <Text style={[st.subTabText, profileTab === tab.key && st.subTabTextActive]}>{tab.label}</Text>
            {profileTab === tab.key && <View style={st.subTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {currentLoading && (
        <View style={st.cardLoading}><ActivityIndicator size="small" color={C.tint} /></View>
      )}
      {!currentLoading && currentPosts.length === 0 && (
        <View style={st.emptyPosts}>
          <Feather name={profileTab === "fotos" ? "image" : profileTab === "videos" ? "video" : "edit-3"} size={32} color={C.textMuted} />
          <Text style={st.emptyText}>
            {profileTab === "fotos" ? "Nenhuma foto publicada" : profileTab === "videos" ? "Nenhum vídeo publicado" : "Nenhuma publicação ainda"}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[st.container, { paddingTop: topPad }]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={st.title} numberOfLines={1}>{profile?.name || "Perfil"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={currentPosts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <PostCard post={item} onLikeChange={invalidate} onDelete={invalidate} onSaveChange={invalidate} />
        )}
        contentContainerStyle={{ paddingBottom: botPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.tint} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, flex: 1, textAlign: "center" },

  banner: { height: 130, width: "100%" },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },

  profileSection: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 16, marginBottom: 4 },

  avatarContainer: { alignItems: "flex-start", marginTop: -44, marginBottom: 8 },
  avatarOuter: { borderWidth: 4, borderColor: "#fff", borderRadius: 50, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold" },

  profileInfo: { gap: 6 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular" },
  dmBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginTop: 4,
  },
  dmBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginTop: 4,
    borderWidth: 1.5, borderColor: C.tint,
  },
  editBtnText: { color: C.tint, fontFamily: "Inter_600SemiBold", fontSize: 14 },

  statsRow: {
    flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 4,
    backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 14,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  statDiv: { width: 1, height: 36, backgroundColor: C.borderLight },

  infoCard: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.border, marginTop: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  infoIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, color: C.text, fontFamily: "Inter_500Medium", marginTop: 1 },
  extraTag: { backgroundColor: "#F3F4F6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  extraTagText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary },

  subTabBar: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 2,
  },
  subTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, position: "relative",
  },
  subTabActive: {},
  subTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textMuted },
  subTabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  subTabIndicator: { position: "absolute", bottom: 0, left: "10%", right: "10%", height: 3, backgroundColor: C.tint, borderRadius: 3 },

  cardLoading: { alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  emptyPosts: { alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
});
