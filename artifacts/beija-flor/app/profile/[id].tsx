import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList, Image, TouchableOpacity,
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Não informado";
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day} de ${months[month - 1]} de ${year}`;
}

export default function ProfileViewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get(`/users/${id}`),
    enabled: !!id,
  });

  const { data: timelineData, isLoading: postsLoading, refetch } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.get(`/posts/timeline/${id}`),
    enabled: !!id,
  });

  const posts = timelineData?.posts ?? [];

  const isOwnProfile = me?.id === parseInt(id ?? "0");
  const tagStyle = profile?.tag ? (C.tagColors as any)[profile.tag] : null;

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["user", id] }),
      qc.invalidateQueries({ queryKey: ["timeline", id] }),
    ]);
    setRefreshing(false);
  }

  const ListHeader = (
    <View>
      {/* Profile card */}
      {profileLoading ? (
        <View style={styles.cardLoading}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : profile ? (
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={40} color="#9CA3AF" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{ROLE_LABELS[profile.role] || profile.role}</Text>
            </View>
            {tagStyle && profile.tag && (
              <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
                <Text style={[styles.tagText, { color: tagStyle.text }]}>{TAG_LABELS[profile.tag]}</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.dmBtn}
                onPress={() => router.push(`/messages/with/${id}` as any)}
                activeOpacity={0.85}
              >
                <Feather name="send" size={15} color="#fff" />
                <Text style={styles.dmBtnText}>Enviar Mensagem</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info rows */}
          <View style={styles.infoCard}>
            <InfoRow icon="calendar" label="Aniversário" value={formatDate(profile.birthDate)} />
            <InfoRow icon="briefcase" label="Admissão" value={formatDate(profile.admissionDate)} last />
          </View>
        </View>
      ) : (
        <View style={styles.cardLoading}>
          <Text style={styles.errorText}>Usuário não encontrado</Text>
        </View>
      )}

      {/* Timeline header */}
      <View style={styles.sectionHeader}>
        <Feather name="grid" size={14} color={C.textSecondary} />
        <Text style={styles.sectionTitle}>Publicações</Text>
      </View>

      {postsLoading && (
        <View style={styles.cardLoading}>
          <ActivityIndicator size="small" color={C.tint} />
        </View>
      )}

      {!postsLoading && posts.length === 0 && (
        <View style={styles.emptyPosts}>
          <Feather name="edit-3" size={28} color={C.textMuted} />
          <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{profile?.name || "Perfil"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <View style={{ marginBottom: 1 }}>
            <PostCard post={item} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: botPad + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.tint} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Feather name={icon as any} size={16} color={C.tint} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, flex: 1, textAlign: "center" },
  cardLoading: { alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  profileCard: {
    backgroundColor: C.surface, margin: 12, borderRadius: 16,
    alignItems: "center", padding: 20, gap: 8,
    borderWidth: 1, borderColor: C.border,
  },
  avatarWrap: {},
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: C.tint },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, marginTop: 4 },
  email: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  roleBadge: { backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  dmBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.tint, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20,
  },
  dmBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  infoCard: {
    width: "100%", borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: C.border, marginTop: 8,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  infoLabel: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, color: C.text, fontFamily: "Inter_500Medium" },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase" },
  emptyPosts: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
});
