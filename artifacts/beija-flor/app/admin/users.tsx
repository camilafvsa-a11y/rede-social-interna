import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Platform, TextInput,
  Alert, Modal, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ── Shared constants ─────────────────────────────────────────────────────────

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

const TAG_OPTIONS = ["marketing", "adm", "socio", "posto", "churrascaria", "gerente"];
const ROLE_OPTIONS_EMAIL = ["user", "moderator", "admin"];
const ROLE_LABELS_EMAIL: Record<string, string> = { user: "Colaborador", moderator: "Moderador", admin: "Administrador" };

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

// ── Usuários tab ─────────────────────────────────────────────────────────────

function UsuariosTab() {
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-users", search],
    queryFn: () => api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  return (
    <View style={{ flex: 1 }}>
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
                  <View style={[styles.avatarFallback, appBanned ? { backgroundColor: "#EF4444" } : { backgroundColor: "#F3F4F6" }]}>
                    <Feather name="user" size={22} color={appBanned ? "#fff" : "#9CA3AF"} />
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
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
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

// ── E-mails Autorizados tab ──────────────────────────────────────────────────

function EmailsTab() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", tag: "", role: "user", temporaryPassword: "" });
  const [saving, setSaving] = useState(false);

  const { data: emails = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["allowed-emails"],
    queryFn: () => api.get("/users/admin/allowed-emails"),
  });

  async function addEmail() {
    if (!form.email.trim() || !form.name.trim() || !form.temporaryPassword.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users/admin/allowed-emails", form);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowModal(false);
      setForm({ email: "", name: "", tag: "", role: "user", temporaryPassword: "" });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEmail(id: number, email: string) {
    Alert.alert("Remover e-mail", `Remover ${email}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/users/admin/allowed-emails/${id}`);
            await refetch();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        }
      }
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={emails}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.emailCard}>
            <View style={styles.emailIcon}>
              <Feather name="mail" size={18} color={C.tint} />
            </View>
            <View style={styles.emailInfo}>
              <Text style={styles.emailName}>{item.name}</Text>
              <Text style={styles.emailAddr}>{item.email}</Text>
              {item.role && item.role !== "user" && (
                <Text style={[styles.emailRole, { color: ROLE_COLORS[item.role] || C.textMuted }]}>
                  {ROLE_LABELS_EMAIL[item.role] || item.role}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => removeEmail(item.id, item.email)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={18} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addEmailBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Feather name="plus-circle" size={18} color={C.tint} />
            <Text style={styles.addEmailBtnText}>Adicionar novo e-mail autorizado</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="mail" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum e-mail autorizado</Text>
              <Text style={styles.emptyHint}>Apenas e-mails cadastrados aqui podem criar conta no app</Text>
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

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar E-mail Autorizado</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nome completo *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Nome do colaborador"
                placeholderTextColor={C.placeholder}
              />

              <Text style={styles.fieldLabel}>E-mail *</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
                placeholder="email@empresa.com"
                placeholderTextColor={C.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Senha temporária *</Text>
              <TextInput
                style={styles.input}
                value={form.temporaryPassword}
                onChangeText={(v) => setForm({ ...form, temporaryPassword: v })}
                placeholder="Senha inicial de acesso"
                placeholderTextColor={C.placeholder}
              />

              <Text style={styles.fieldLabel}>Setor</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  style={[styles.optionChip, !form.tag && styles.optionChipSelected]}
                  onPress={() => setForm({ ...form, tag: "" })}
                >
                  <Text style={[styles.optionText, !form.tag && { color: "#fff" }]}>Nenhum</Text>
                </TouchableOpacity>
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.optionChip, form.tag === tag && styles.optionChipSelected]}
                    onPress={() => setForm({ ...form, tag })}
                  >
                    <Text style={[styles.optionText, form.tag === tag && { color: "#fff" }]}>{TAG_LABELS[tag]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Papel no sistema</Text>
              <View style={styles.optionRow}>
                {ROLE_OPTIONS_EMAIL.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.optionChip, form.role === role && styles.optionChipSelected]}
                    onPress={() => setForm({ ...form, role })}
                  >
                    <Text style={[styles.optionText, form.role === role && { color: "#fff" }]}>{ROLE_LABELS_EMAIL[role]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addEmail} disabled={saving} activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Adicionar e-mail</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"usuarios" | "emails">("usuarios");
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

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, activeTab === "usuarios" && styles.subTabActive]}
          onPress={() => setActiveTab("usuarios")}
          activeOpacity={0.8}
        >
          <Feather name="users" size={14} color={activeTab === "usuarios" ? C.tint : C.textMuted} />
          <Text style={[styles.subTabText, activeTab === "usuarios" && styles.subTabTextActive]}>
            Colaboradores
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeTab === "emails" && styles.subTabActive]}
          onPress={() => setActiveTab("emails")}
          activeOpacity={0.8}
        >
          <Feather name="mail" size={14} color={activeTab === "emails" ? C.tint : C.textMuted} />
          <Text style={[styles.subTabText, activeTab === "emails" && styles.subTabTextActive]}>
            E-mails Autorizados
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "usuarios" ? <UsuariosTab /> : <EmailsTab />}
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

  // Sub-tabs
  subTabBar: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 8,
  },
  subTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  subTabActive: { borderBottomColor: C.tint },
  subTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textMuted },
  subTabTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  // Shared list
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, backgroundColor: C.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },

  // User cards
  userCard: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  userCardBanned: { borderColor: "#FECACA", backgroundColor: "#FFFBFB" },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  banDot: {
    position: "absolute", bottom: -1, right: -1,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    borderColor: C.surface,
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
  appBanBadge: { backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderColor: "#FECACA" },
  appBanText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#EF4444" },
  postBanBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FFFBEB", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderColor: "#FDE68A",
  },
  postBanText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#D97706" },

  // Email cards
  addEmailBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
    marginBottom: 4,
  },
  addEmailBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },
  emailCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  emailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  emailInfo: { flex: 1, gap: 1 },
  emailName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  emailAddr: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emailRole: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  // Shared empty
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "92%", minHeight: 400,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalContent: { padding: 16, gap: 4, paddingBottom: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: C.text, fontFamily: "Inter_400Regular",
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  optionChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  optionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  submitBtn: {
    backgroundColor: C.tint, borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 20,
  },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
