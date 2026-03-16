import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Platform, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Colaborador", moderator: "Moderador",
  admin: "Admin", master_admin: "Master",
};

const ROLE_COLORS: Record<string, string> = {
  user: "#6B7280", moderator: "#3B82F6",
  admin: "#8B5CF6", master_admin: "#EF4444",
};

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-users", search],
    queryFn: () => api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  async function updateRole(userId: number, role: string) {
    try {
      await api.patch(`/users/${userId}`, { role });
      await refetch();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function updateTag(userId: number, tag: string) {
    try {
      await api.patch(`/users/${userId}`, { tag });
      await refetch();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  function showRoleMenu(u: any) {
    if (u.role === "master_admin") return;
    Alert.alert("Alterar papel", u.name, [
      { text: "Colaborador", onPress: () => updateRole(u.id, "user") },
      { text: "Moderador", onPress: () => updateRole(u.id, "moderator") },
      { text: "Administrador", onPress: () => updateRole(u.id, "admin") },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function showTagMenu(u: any) {
    Alert.alert("Alterar tag", u.name, [
      ...Object.entries(TAG_LABELS).map(([key, label]) => ({
        text: label, onPress: () => updateTag(u.id, key),
      })),
      { text: "Sem tag", onPress: () => updateTag(u.id, "") },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

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
          placeholder="Buscar usuário..."
          placeholderTextColor={C.placeholder}
        />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item: u }) => {
          const tagStyle = u.tag ? (C.tagColors as any)[u.tag] : null;
          return (
            <View style={styles.userCard}>
              <View style={styles.avatarWrap}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{u.name?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                <View style={styles.badgeRow}>
                  <TouchableOpacity
                    style={[styles.roleBadge, { backgroundColor: "#f0f0ff" }]}
                    onPress={() => showRoleMenu(u)}
                  >
                    <Text style={[styles.roleText, { color: ROLE_COLORS[u.role] || "#6B7280" }]}>{ROLE_LABELS[u.role]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tagBadge, { backgroundColor: tagStyle?.bg || C.surfaceAlt }]}
                    onPress={() => showTagMenu(u)}
                  >
                    <Text style={[styles.tagText, { color: tagStyle?.text || C.textSecondary }]}>
                      {u.tag ? TAG_LABELS[u.tag] : "+ Tag"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={C.tint} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={!isLoading ? <View style={styles.empty}><Text style={styles.emptyText}>Nenhum usuário encontrado</Text></View> : null}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
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
    flexDirection: "row", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  avatarWrap: {},
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  userEmail: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
