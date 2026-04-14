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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", active: "Ativo", inactive: "Inativo", expired: "Expirado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706", active: "#059669", inactive: "#6B7280", expired: "#DC2626",
};
const STATUS_BG: Record<string, string> = {
  pending: "#FFFBEB", active: "#F0FDF4", inactive: "#F9FAFB", expired: "#FEF2F2",
};

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

// ── Usuários tab ──────────────────────────────────────────────────────────────
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
                {u.onboardingCompleted && (
                  <View style={styles.onboardingDot}>
                    <Feather name="check" size={7} color="#fff" />
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
                {(u.position || u.sector || u.unit) && (
                  <Text style={styles.userMeta} numberOfLines={1}>
                    {[u.position, u.sector, u.unit].filter(Boolean).join(" · ")}
                  </Text>
                )}
                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: "#f0f0ff" }]}>
                    <Text style={[styles.roleText, { color: ROLE_COLORS[u.role] || "#6B7280" }]}>
                      {ROLE_LABELS[u.role]}
                    </Text>
                  </View>
                  {!u.onboardingCompleted && (
                    <View style={styles.onboardingBadge}>
                      <Feather name="clock" size={8} color="#D97706" />
                      <Text style={styles.onboardingBadgeText}>Onboarding</Text>
                    </View>
                  )}
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

// ── E-mails Autorizados / Convites tab ────────────────────────────────────────
const EMPTY_FORM = {
  email: "", name: "", tag: "", role: "user", temporaryPassword: "",
  phone: "", sector: "", unit: "", position: "",
};

function EmailsTab() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const { data: emails = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["allowed-emails"],
    queryFn: () => api.get("/users/admin/allowed-emails"),
  });

  const filtered = emails.filter((e: any) => {
    const q = search.toLowerCase();
    return !q || e.name?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
  });

  function openModal() {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  async function addEmail() {
    if (!form.email.trim() || !form.name.trim() || !form.temporaryPassword.trim()) {
      Alert.alert("Atenção", "Preencha nome, e-mail e senha temporária.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users/admin/allowed-emails", form);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setShowModal(false);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resendInvite(id: number, email: string) {
    Alert.alert("Reenviar convite", `Reenviar convite para ${email}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Reenviar", onPress: async () => {
          setActionLoadingId(id);
          try {
            await api.post(`/users/admin/allowed-emails/${id}/resend`, {});
            await refetch();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          } finally {
            setActionLoadingId(null);
          }
        }
      }
    ]);
  }

  async function cancelInvite(id: number, email: string) {
    Alert.alert("Cancelar convite", `Cancelar o convite de ${email}? O colaborador não poderá criar conta com este e-mail.`, [
      { text: "Manter", style: "cancel" },
      {
        text: "Cancelar convite", style: "destructive", onPress: async () => {
          setActionLoadingId(id);
          try {
            await api.put(`/users/admin/allowed-emails/${id}`, { status: "inactive" });
            await refetch();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          } finally {
            setActionLoadingId(null);
          }
        }
      }
    ]);
  }

  async function removeEmail(id: number, email: string) {
    Alert.alert("Remover e-mail", `Remover ${email} completamente?`, [
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

  function InviteCard({ item }: { item: any }) {
    const status = item.status || "pending";
    const isActive = !!item.accountCreatedAt;
    const resolvedStatus = isActive ? "active" : status;
    const isLoading = actionLoadingId === item.id;

    return (
      <View style={styles.inviteCard}>
        <View style={styles.inviteTop}>
          <View style={styles.emailIcon}>
            <Feather name={resolvedStatus === "active" ? "user-check" : "mail"} size={18} color={resolvedStatus === "active" ? "#059669" : C.tint} />
          </View>
          <View style={styles.emailInfo}>
            <Text style={styles.emailName}>{item.name}</Text>
            <Text style={styles.emailAddr}>{item.email}</Text>
            {(item.position || item.sector || item.unit) && (
              <Text style={styles.emailMeta}>{[item.position, item.sector, item.unit].filter(Boolean).join(" · ")}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[resolvedStatus] }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[resolvedStatus] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[resolvedStatus] }]}>
              {resolvedStatus === "active" ? "Cadastrado" : STATUS_LABELS[resolvedStatus]}
            </Text>
          </View>
        </View>

        {item.invitedAt && (
          <Text style={styles.inviteMeta}>
            Convidado {new Date(item.invitedAt).toLocaleDateString("pt-BR")}
            {item.accountCreatedAt ? ` · Conta criada ${new Date(item.accountCreatedAt).toLocaleDateString("pt-BR")}` : ""}
          </Text>
        )}

        {resolvedStatus !== "active" && (
          <View style={styles.inviteActions}>
            {isLoading ? (
              <ActivityIndicator size="small" color={C.tint} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => resendInvite(item.id, item.email)}
                  activeOpacity={0.8}
                >
                  <Feather name="send" size={13} color={C.tint} />
                  <Text style={styles.resendBtnText}>Reenviar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelInviteBtn}
                  onPress={() => cancelInvite(item.id, item.email)}
                  activeOpacity={0.8}
                >
                  <Feather name="x-circle" size={13} color={C.danger} />
                  <Text style={styles.cancelInviteBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeEmail(item.id, item.email)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: "auto" }}
                >
                  <Feather name="trash-2" size={16} color={C.danger} />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {resolvedStatus === "active" && (
          <TouchableOpacity
            onPress={() => removeEmail(item.id, item.email)}
            style={styles.removeActiveBtn}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={14} color={C.danger} />
            <Text style={styles.removeActiveBtnText}>Remover acesso</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => <InviteCard item={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 100 }]}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <TouchableOpacity style={styles.addEmailBtn} onPress={openModal} activeOpacity={0.8}>
              <Feather name="plus-circle" size={18} color={C.tint} />
              <Text style={styles.addEmailBtnText}>Convidar novo colaborador</Text>
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Feather name="search" size={14} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome ou e-mail..."
                placeholderTextColor={C.placeholder}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Feather name="x" size={14} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="mail" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum convite encontrado</Text>
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
              <Text style={styles.modalTitle}>Convidar Colaborador</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Informações de acesso *</Text>

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
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Dados de contato (opcional)</Text>

                <Text style={styles.fieldLabel}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(v) => setForm({ ...form, phone: v })}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={C.placeholder}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Dados de trabalho (opcional)</Text>

                <Text style={styles.fieldLabel}>Cargo / Função</Text>
                <TextInput
                  style={styles.input}
                  value={form.position}
                  onChangeText={(v) => setForm({ ...form, position: v })}
                  placeholder="Ex: Operador de Caixa"
                  placeholderTextColor={C.placeholder}
                />

                <Text style={styles.fieldLabel}>Setor</Text>
                <TextInput
                  style={styles.input}
                  value={form.sector}
                  onChangeText={(v) => setForm({ ...form, sector: v })}
                  placeholder="Ex: Recursos Humanos"
                  placeholderTextColor={C.placeholder}
                />

                <Text style={styles.fieldLabel}>Unidade</Text>
                <TextInput
                  style={styles.input}
                  value={form.unit}
                  onChangeText={(v) => setForm({ ...form, unit: v })}
                  placeholder="Ex: Unidade Centro"
                  placeholderTextColor={C.placeholder}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Perfil no sistema</Text>

                <Text style={styles.fieldLabel}>Setor / Área</Text>
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
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addEmail} disabled={saving} activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.submitText}>Adicionar e convidar</Text>
                  </>
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
            Convites
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

  subTabBar: { flexDirection: "row", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 8 },
  subTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  subTabActive: { borderBottomColor: C.tint },
  subTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textMuted },
  subTabTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, marginBottom: 4, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  listContent: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },

  userCard: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  userCardBanned: { borderColor: "#FECACA", backgroundColor: "#FFFBFB" },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  banDot: { position: "absolute", bottom: -1, right: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", borderColor: C.surface },
  onboardingDot: { position: "absolute", top: -1, right: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: "#059669", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.surface },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  userEmail: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  userMeta: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  badgeRow: { flexDirection: "row", gap: 5, marginTop: 4, flexWrap: "wrap" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  onboardingBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFFBEB", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  onboardingBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  appBanBadge: { backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  appBanText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#EF4444" },
  postBanBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFFBEB", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  postBanText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#D97706" },

  inviteCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 8 },
  inviteTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  emailInfo: { flex: 1, gap: 1 },
  emailName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  emailAddr: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emailMeta: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  emailRole: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  inviteMeta: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  inviteActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  resendBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  resendBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },
  cancelInviteBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  cancelInviteBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.danger },
  removeActiveBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  removeActiveBtnText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.danger },

  addEmailBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EFF6FF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#BFDBFE" },
  addEmailBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "96%", minHeight: 400 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalContent: { padding: 16, gap: 4, paddingBottom: 20 },

  formSection: { marginBottom: 8 },
  formSectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  optionChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  optionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  submitBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 20, flexDirection: "row", justifyContent: "center", gap: 8 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
