import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
  mae: "Mãe", pai: "Pai",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Colaborador", moderator: "Moderador",
  admin: "Admin", master_admin: "Master",
};

const ROLE_COLORS: Record<string, string> = {
  user: "#6B7280", moderator: "#3B82F6",
  admin: "#8B5CF6", master_admin: "#EF4444",
};

function getInitials(name: string) {
  return name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() ?? "?";
}

function isBannedNow(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

function getBanLabel(bannedUntil: string | null): string {
  if (!bannedUntil) return "";
  const d = new Date(bannedUntil);
  if (d.getFullYear() >= 9990) return "Ban permanente";
  return `Banido até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-users", search],
    queryFn: () => api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Usuários</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar colaborador..."
          placeholderTextColor={C.placeholder}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={users}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item: u }) => {
          const tagStyle = u.tag ? (C.tagColors as any)[u.tag] : null;
          const postBanned = isBannedNow(u.bannedUntil);
          const appBanned = u.appBanned;
          const extraTags: string[] = Array.isArray(u.extraTags) ? u.extraTags : [];

          return (
            <TouchableOpacity
              style={[styles.userCard, (appBanned || postBanned) && styles.userCardBanned]}
              onPress={() => router.push({ pathname: "/admin/user-detail", params: { id: u.id } } as any)}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrap}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, appBanned ? { backgroundColor: "#EF4444" } : { backgroundColor: "#fff", borderWidth: 2, borderColor: "#1E3A8A" }]}>
                    <Text style={[styles.avatarInitial, !appBanned && { color: "#1E3A8A" }]}>{getInitials(u.name)}</Text>
                  </View>
                )}
                {(appBanned || postBanned) && (
                  <View style={styles.banDot}>
                    <Feather name="slash" size={8} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                  {appBanned && (
                    <View style={styles.appBanBadge}>
                      <Text style={styles.appBanText}>Banido</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>

                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: "#f0f0ff" }]}>
                    <Text style={[styles.roleText, { color: ROLE_COLORS[u.role] || "#6B7280" }]}>
                      {ROLE_LABELS[u.role]}
                    </Text>
                  </View>
                  {u.tag && (
                    <View style={[styles.tagBadge, { backgroundColor: tagStyle?.bg || C.surfaceAlt }]}>
                      <Text style={[styles.tagText, { color: tagStyle?.text || C.textSecondary }]}>
                        {TAG_LABELS[u.tag] || u.tag}
                      </Text>
                    </View>
                  )}
                  {extraTags.map((et) => (
                    <View key={et} style={[styles.tagBadge, { backgroundColor: et === "mae" ? "#FDF2F8" : "#EEF2FF" }]}>
                      <Text style={[styles.tagText, { color: et === "mae" ? "#EC4899" : "#6366F1" }]}>
                        {TAG_LABELS[et] || et}
                      </Text>
                    </View>
                  ))}
                  {postBanned && !appBanned && (
                    <View style={styles.postBanBadge}>
                      <Feather name="clock" size={9} color="#D97706" />
                      <Text style={styles.postBanText}>{getBanLabel(u.bannedUntil)}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Feather name="chevron-right" size={16} color={C.textMuted} />
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
            tintColor={C.tint}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={
          !isLoading
            ? <View style={styles.empty}><Text style={styles.emptyText}>Nenhum usuário encontrado</Text></View>
            : null
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
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, backgroundColor: C.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 12, gap: 8 },
  userCard: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  userCardBanned: {
    borderColor: "#FECACA", backgroundColor: "#FFFBFB",
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallbackBlue: { backgroundColor: C.tint },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 },
  banDot: {
    position: "absolute", bottom: -1, right: -1,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: C.surface,
  },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  userEmail: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  badgeRow: { flexDirection: "row", gap: 5, marginTop: 4, flexWrap: "wrap" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  appBanBadge: {
    backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: "#FECACA",
  },
  appBanText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#EF4444" },
  postBanBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FFFBEB", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: "#FDE68A",
  },
  postBanText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
