import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, TextInput, Switch, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const C = Colors.light;

const FAMILY_TAGS = [
  { key: "sem_filhos", label: "Sem filhos", icon: "minus-circle" as const, color: "#4B5563", bg: "#E5E7EB" },
  { key: "mae", label: "Mãe", icon: "heart" as const, color: "#EC4899", bg: "#FDF2F8" },
  { key: "pai", label: "Pai", icon: "star" as const, color: "#6366F1", bg: "#EEF2FF" },
];

const FAMILY_KEYS = FAMILY_TAGS.map((t) => t.key);

const ROLES = [
  { key: "user", label: "Colaborador", color: "#6B7280", icon: "user" as const },
  { key: "moderator", label: "Moderador", color: "#3B82F6", icon: "shield" as const },
  { key: "admin", label: "Administrador", color: "#8B5CF6", icon: "shield" as const },
];

const TAG_COLORS = [
  "#2563EB", "#DC2626", "#7C3AED", "#D97706", "#059669",
  "#0891B2", "#EC4899", "#EA580C", "#65A30D", "#0F172A",
];

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function getInitials(name: string) {
  return name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() ?? "?";
}

function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatBanDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const permanent = d.getFullYear() >= 9990;
  if (permanent) return "Banimento permanente";
  return `Banido até ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

function isBannedNow(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

function SectionTitle({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Feather name={icon} size={14} color={C.tint} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function colorBg(hex: string): string {
  return hex + "18";
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user: loggedInUser } = useAuth();
  const isMasterAdmin = loggedInUser?.role === "master_admin";

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["admin-user", id],
    queryFn: () => api.get(`/users/${id}`),
    enabled: !!id,
  });

  const { data: userTerms } = useQuery<any[]>({
    queryKey: ["admin-user-terms", id],
    queryFn: () => api.get(`/terms/admin/user/${id}`),
    enabled: !!id,
    initialData: [],
  });

  const { data: workTagOptions = [], refetch: refetchWorkTags } = useQuery<{id:number;key:string;label:string;color:string;bg:string}[]>({
    queryKey: ["work-tags"],
    queryFn: () => api.get("/work-tags"),
  });

  // Form state
  const [role, setRole] = useState("user");
  const [workTags, setWorkTags] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [appBanned, setAppBanned] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [banning, setBanning] = useState(false);

  // Original values for dirty-check
  const [origData, setOrigData] = useState<{
    role: string; workTags: string[]; extraTags: string[];
    appBanned: boolean; birthDate: string; cpf: string; admissionDate: string;
  } | null>(null);

  const [prevSavedData, setPrevSavedData] = useState<typeof origData | null>(null);

  // Toast / save error
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function triggerToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2800);
  }

  // Tag management modal
  const [addTagModal, setAddTagModal] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563EB");
  const [addingTag, setAddingTag] = useState(false);

  // Edit tag modal
  const [editTagData, setEditTagData] = useState<{id:number; label:string; color:string} | null>(null);
  const [editingTag, setEditingTag] = useState(false);

  // Delete tag 2-step modal
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<{step:1|2; id:number; key:string; label:string} | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);

  // Delete user 2-step modal
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<1|2|null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBanDate, setSelectedBanDate] = useState<Date | null>(null);
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const banned = user ? isBannedNow(user.bannedUntil) : false;
  const banLabel = user ? formatBanDate(user.bannedUntil) : "";

  useEffect(() => {
    if (user) {
      const r = user.role === "master_admin" ? "admin" : user.role;
      const wt = Array.isArray(user.workTags) ? user.workTags : [];
      const et = Array.isArray(user.extraTags) ? user.extraTags : [];
      const ab = user.appBanned ?? false;
      const bd = maskDate(user.birthDate ?? "");
      const cp = maskCpf(user.cpf ?? "");
      const ad = maskDate(user.admissionDate ?? "");
      setRole(r);
      setWorkTags(wt);
      setExtraTags(et);
      setAppBanned(ab);
      setBirthDate(bd);
      setCpf(cp);
      setAdmissionDate(ad);
      setOrigData({ role: r, workTags: wt, extraTags: et, appBanned: ab, birthDate: bd, cpf: cp, admissionDate: ad });
    }
  }, [user]);

  const isDirty = origData !== null && (
    role !== origData.role ||
    appBanned !== origData.appBanned ||
    birthDate !== origData.birthDate ||
    cpf !== origData.cpf ||
    admissionDate !== origData.admissionDate ||
    JSON.stringify([...workTags].sort()) !== JSON.stringify([...origData.workTags].sort()) ||
    JSON.stringify([...extraTags].sort()) !== JSON.stringify([...origData.extraTags].sort())
  );

  function toggleWorkTag(key: string) {
    setWorkTags((prev) => prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]);
  }

  function toggleFamilyTag(key: string) {
    setExtraTags((prev) => {
      const nonFamily = prev.filter((t) => !FAMILY_KEYS.includes(t));
      if (prev.includes(key)) return nonFamily;
      return [...nonFamily, key];
    });
  }

  async function doSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: any = {
        tag: null,
        workTags,
        extraTags,
        appBanned,
        birthDate: birthDate || null,
        cpf: cpf || null,
        admissionDate: admissionDate || null,
      };
      if (!isMaster) payload.role = role;
      await api.patch(`/users/${id}`, payload);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      await qc.invalidateQueries({ queryKey: ["admin-user", id] });
      setPrevSavedData(origData);
      setOrigData({ role, workTags, extraTags, appBanned, birthDate, cpf, admissionDate });
      triggerToast();
    } catch (e: any) {
      setSaveError(e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (!isDirty || saving) return;
    doSave();
  }

  async function doUndo() {
    if (!prevSavedData) return;
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, {
        role: prevSavedData.role,
        tag: null,
        workTags: prevSavedData.workTags,
        extraTags: prevSavedData.extraTags,
        appBanned: prevSavedData.appBanned,
        birthDate: prevSavedData.birthDate || null,
        cpf: prevSavedData.cpf || null,
        admissionDate: prevSavedData.admissionDate || null,
      });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      await qc.invalidateQueries({ queryKey: ["admin-user", id] });
      setRole(prevSavedData.role);
      setWorkTags(prevSavedData.workTags);
      setExtraTags(prevSavedData.extraTags);
      setAppBanned(prevSavedData.appBanned);
      setBirthDate(prevSavedData.birthDate);
      setCpf(prevSavedData.cpf);
      setAdmissionDate(prevSavedData.admissionDate);
      setOrigData(prevSavedData);
      setPrevSavedData(null);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível desfazer.");
    } finally {
      setSaving(false);
    }
  }

  async function applyBan(until: Date | "permanent") {
    const isPermanent = until === "permanent";
    const dateStr = isPermanent ? "9999-12-31T23:59:59Z" : (until as Date).toISOString();
    setBanning(true);
    try {
      await api.patch(`/users/${id}`, { bannedUntil: dateStr });
      await qc.invalidateQueries({ queryKey: ["admin-user", id] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedBanDate(null);
      setShowCalendar(false);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setBanning(false);
    }
  }

  async function handleUnban() {
    setBanning(true);
    try {
      await api.patch(`/users/${id}`, { bannedUntil: null });
      await qc.invalidateQueries({ queryKey: ["admin-user", id] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setBanning(false);
    }
  }

  async function doAddTag() {
    if (!newTagLabel.trim()) return;
    setAddingTag(true);
    try {
      await api.post("/work-tags/admin", { label: newTagLabel.trim(), color: newTagColor, bg: colorBg(newTagColor) });
      await refetchWorkTags();
      await qc.invalidateQueries({ queryKey: ["work-tags"] });
      setAddTagModal(false);
      setNewTagLabel("");
      setNewTagColor("#2563EB");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setAddingTag(false);
    }
  }

  async function doEditTag() {
    if (!editTagData?.label.trim()) return;
    setEditingTag(true);
    try {
      await api.patch(`/work-tags/admin/${editTagData.id}`, {
        label: editTagData.label.trim(),
        color: editTagData.color,
        bg: colorBg(editTagData.color),
      });
      await refetchWorkTags();
      await qc.invalidateQueries({ queryKey: ["work-tags"] });
      setEditTagData(null);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setEditingTag(false);
    }
  }

  async function doDeleteTag() {
    if (!deleteTagConfirm) return;
    setDeletingTag(true);
    try {
      await api.delete(`/work-tags/admin/${deleteTagConfirm.id}`);
      setWorkTags((prev) => prev.filter((t) => t !== deleteTagConfirm.key));
      setOrigData((prev) => prev ? { ...prev, workTags: prev.workTags.filter((t) => t !== deleteTagConfirm.key) } : prev);
      await refetchWorkTags();
      await qc.invalidateQueries({ queryKey: ["work-tags"] });
      setDeleteTagConfirm(null);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
      setDeleteTagConfirm(null);
    } finally {
      setDeletingTag(false);
    }
  }

  async function doDeleteUser() {
    setDeletingUser(true);
    try {
      await api.delete(`/users/${id}`);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteUserConfirm(null);
      router.back();
    } catch (e: any) {
      Alert.alert("Erro ao excluir", e.message);
      setDeleteUserConfirm(null);
    } finally {
      setDeletingUser(false);
    }
  }

  // Calendar helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }
  function getFirstWeekday(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }
  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }
  const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const DAYS_PT = ["D","S","T","Q","Q","S","S"];

  if (isLoading || !user) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carregando...</Text>
        </View>
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const isMaster = user.role === "master_admin";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Editar colaborador</Text>
        {prevSavedData && (
          <TouchableOpacity style={styles.undoBtn} onPress={doUndo} disabled={saving} activeOpacity={0.8}>
            <Feather name="rotate-ccw" size={15} color="#D97706" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, isDirty && !saving && styles.saveBtnActive, (saving || !isDirty) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <View style={styles.saveBtnInner}>
              {isDirty && <View style={styles.saveDot} />}
              <Text style={styles.saveBtnText}>Salvar</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {saveError && (
        <View style={[styles.pendingBanner, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
          <Feather name="alert-circle" size={13} color="#DC2626" />
          <Text style={[styles.pendingBannerText, { color: "#DC2626" }]}>{saveError}</Text>
          <TouchableOpacity onPress={() => setSaveError(null)} style={{ marginLeft: "auto" }}>
            <Feather name="x" size={13} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}
      {isDirty && !saveError && (
        <View style={styles.pendingBanner}>
          <Feather name="edit-2" size={13} color="#92400E" />
          <Text style={styles.pendingBannerText}>Alterações não salvas — toque em Salvar para confirmar</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : 120 }]}>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: appBanned ? "#EF4444" : "#F3F4F6" }]}>
            <Feather name="user" size={32} color={appBanned ? "#fff" : "#9CA3AF"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <View style={styles.profileBadgeRow}>
              <View style={[styles.rolePill, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[styles.rolePillText, { color: C.tint }]}>
                  {user.role === "master_admin" ? "Master Admin" : role === "user" ? "Colaborador" : role === "moderator" ? "Moderador" : "Admin"}
                </Text>
              </View>
              {(banned || appBanned) && (
                <View style={styles.banPill}>
                  <Feather name="slash" size={10} color="#EF4444" />
                  <Text style={styles.banPillText}>{appBanned ? "Banido do app" : "Ban de posts"}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isMaster && (
          <View style={styles.masterWarning}>
            <Feather name="alert-circle" size={16} color="#D97706" />
            <Text style={styles.masterWarningText}>Master Admin — configurações protegidas</Text>
          </View>
        )}

        {/* ── Acesso & Papel ── */}
        <View style={styles.card}>
          <SectionTitle icon="shield" title="Acesso & Papel" />
          <Text style={styles.fieldLabel}>Nível de acesso</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleOption, role === r.key && { borderColor: r.color, backgroundColor: r.color + "18" }]}
                onPress={() => !isMaster && setRole(r.key)}
                disabled={isMaster}
                activeOpacity={0.8}
              >
                <Feather name={r.icon} size={14} color={role === r.key ? r.color : C.textMuted} />
                <Text style={[styles.roleOptionText, role === r.key && { color: r.color }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Banir do aplicativo</Text>
              <Text style={styles.toggleDesc}>Impede o email de fazer login no app</Text>
            </View>
            <Switch
              value={appBanned}
              onValueChange={(v) => !isMaster && setAppBanned(v)}
              trackColor={{ false: C.border, true: "#FCA5A5" }}
              thumbColor={appBanned ? "#EF4444" : C.surface}
              disabled={isMaster}
            />
          </View>
          {appBanned && (
            <View style={styles.warningBanner}>
              <Feather name="alert-triangle" size={13} color="#B45309" />
              <Text style={styles.warningBannerText}>Esta conta está banida. O usuário não conseguirá entrar no app.</Text>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <SectionTitle icon="tag" title="Tags de Trabalho" />
            <TouchableOpacity
              style={styles.addTagBtn}
              onPress={() => setAddTagModal(true)}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={13} color={C.tint} />
              <Text style={styles.addTagBtnText}>Nova Tag</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Unidades (selecione quantas desejar)</Text>
          <View style={styles.tagGrid}>
            {workTagOptions.map((t) => (
              <View key={t.key} style={styles.tagChipWrap}>
                <TouchableOpacity
                  style={[styles.tagChip, workTags.includes(t.key) && { backgroundColor: t.bg, borderColor: t.color }]}
                  onPress={() => toggleWorkTag(t.key)}
                  activeOpacity={0.8}
                >
                  {workTags.includes(t.key) && <Feather name="check" size={11} color={t.color} />}
                  <Text style={[styles.tagChipText, workTags.includes(t.key) && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tagEditBtn}
                  onPress={() => setEditTagData({ id: t.id, label: t.label, color: t.color })}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="edit-2" size={10} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tagDeleteBtn}
                  onPress={() => setDeleteTagConfirm({ step: 1, id: t.id, key: t.key, label: t.label })}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="trash-2" size={10} color="#D1D5DB" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.divider} />
          <SectionTitle icon="heart" title="Família" />
          <Text style={[styles.fieldLabel, { marginTop: 2 }]}>Selecione apenas uma opção</Text>
          <View style={styles.tagGrid}>
            {FAMILY_TAGS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tagChip,
                  { backgroundColor: C.surface },
                  extraTags.includes(t.key) && {
                    backgroundColor: t.color,
                    borderColor: t.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => toggleFamilyTag(t.key)}
                activeOpacity={0.7}
              >
                {extraTags.includes(t.key)
                  ? <Feather name="check" size={12} color="#fff" />
                  : <Feather name={t.icon} size={12} color={C.textMuted} />
                }
                <Text style={[
                  styles.tagChipText,
                  extraTags.includes(t.key) ? { color: "#fff", fontFamily: "Inter_700Bold" } : { color: C.textSecondary },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Banimento de postagem ── */}
        <View style={styles.card}>
          <SectionTitle icon="slash" title="Banimento de Postagem" />

          <View style={styles.banStatusRow}>
            <View style={[styles.banDot, { backgroundColor: banned ? "#EF4444" : "#059669" }]} />
            <Text style={[styles.banStatusText, { color: banned ? "#EF4444" : "#059669" }]}>
              {banned ? banLabel : "Ativo — pode postar normalmente"}
            </Text>
          </View>

          {banned && (
            <TouchableOpacity
              style={[styles.unbanBtn, banning && { opacity: 0.5 }]}
              onPress={handleUnban}
              disabled={banning}
              activeOpacity={0.8}
            >
              {banning ? <ActivityIndicator size="small" color="#059669" /> : (
                <>
                  <Feather name="check-circle" size={14} color="#059669" />
                  <Text style={styles.unbanBtnText}>Revogar Banimento</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {!isMaster && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Novo banimento:</Text>
              <View style={styles.banQuickRow}>
                <TouchableOpacity
                  style={styles.banCalBtn}
                  onPress={() => { setShowCalendar(v => !v); setSelectedBanDate(null); }}
                  activeOpacity={0.8}
                >
                  <Feather name="calendar" size={14} color={C.tint} />
                  <Text style={styles.banCalBtnText}>
                    {selectedBanDate
                      ? selectedBanDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "Selecionar data"}
                  </Text>
                  <Feather name={showCalendar ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.banPermanentBtn}
                  onPress={() => applyBan("permanent")}
                  disabled={banning}
                  activeOpacity={0.8}
                >
                  <Feather name="x-circle" size={14} color="#EF4444" />
                  <Text style={styles.banPermanentBtnText}>Permanente</Text>
                </TouchableOpacity>
              </View>

              {showCalendar && (() => {
                const totalDays = getDaysInMonth(calYear, calMonth);
                const firstDay = getFirstWeekday(calYear, calMonth);
                const cells: (number | null)[] = [
                  ...Array(firstDay).fill(null),
                  ...Array.from({ length: totalDays }, (_, i) => i + 1),
                ];
                return (
                  <View style={styles.calendar}>
                    <View style={styles.calHeader}>
                      <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                        <Feather name="chevron-left" size={18} color={C.text} />
                      </TouchableOpacity>
                      <Text style={styles.calMonthLabel}>{MONTHS_PT[calMonth]} {calYear}</Text>
                      <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                        <Feather name="chevron-right" size={18} color={C.text} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.calDayRow}>
                      {DAYS_PT.map((d, i) => (
                        <Text key={i} style={styles.calDayLabel}>{d}</Text>
                      ))}
                    </View>
                    <View style={styles.calGrid}>
                      {cells.map((day, i) => {
                        if (!day) return <View key={i} style={styles.calCell} />;
                        const cellDate = new Date(calYear, calMonth, day);
                        const isPast = cellDate < today && !(cellDate.toDateString() === today.toDateString());
                        const isSelected = selectedBanDate?.toDateString() === cellDate.toDateString();
                        const isToday = cellDate.toDateString() === today.toDateString();
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday, isPast && styles.calCellPast]}
                            onPress={() => { if (!isPast) setSelectedBanDate(cellDate); }}
                            disabled={isPast}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, isPast && styles.calCellTextPast, isToday && !isSelected && { color: C.tint, fontFamily: "Inter_700Bold" }]}>
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {selectedBanDate && (
                      <TouchableOpacity
                        style={[styles.banApplyBtn, banning && { opacity: 0.5 }]}
                        onPress={() => applyBan(selectedBanDate)}
                        disabled={banning}
                        activeOpacity={0.8}
                      >
                        {banning ? <ActivityIndicator size="small" color="#fff" /> : (
                          <>
                            <Feather name="slash" size={14} color="#fff" />
                            <Text style={styles.banApplyBtnText}>
                              Banir até {selectedBanDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
            </>
          )}
        </View>

        {/* ── Dados Pessoais ── */}
        <View style={styles.card}>
          <SectionTitle icon="user" title="Dados Pessoais" />
          <Text style={styles.fieldLabel}>Data de nascimento (aniversário)</Text>
          <TextInput style={styles.input} value={birthDate} onChangeText={(t) => setBirthDate(maskDate(t))} placeholder="DD/MM/AAAA" placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={10} />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CPF</Text>
          <TextInput style={styles.input} value={cpf} onChangeText={(t) => setCpf(maskCpf(t))} placeholder="000.000.000-00" placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={14} />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Data de contratação</Text>
          <TextInput style={styles.input} value={admissionDate} onChangeText={(t) => setAdmissionDate(maskDate(t))} placeholder="DD/MM/AAAA" placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={10} />
        </View>

        {/* ── Termos Assinados ── */}
        {(() => {
          const imageTerm = (userTerms ?? []).find((t: any) => t.termKey === "image_voice_authorization");
          const hasImage = !!imageTerm;
          const signedDate = hasImage ? new Date(imageTerm.acceptedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
          const allTerms = (userTerms ?? []).filter((t: any) => t.termKey !== "image_voice_authorization");
          return (
            <View style={styles.card}>
              <SectionTitle icon="file-text" title="Termos Assinados" />
              <View style={[styles.termRow, { borderColor: hasImage ? "#BBF7D0" : "#FECACA", backgroundColor: hasImage ? "#F0FDF4" : "#FEF2F2" }]}>
                <View style={[styles.termDot, { backgroundColor: hasImage ? "#059669" : "#EF4444" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.termTitle, { color: hasImage ? "#059669" : "#DC2626" }]}>
                    {hasImage ? "✓ Assinou" : "✗ Não assinou"} — Termo de Uso de Imagem e Voz
                  </Text>
                  {signedDate && <Text style={styles.termDate}>Assinado em {signedDate}</Text>}
                </View>
              </View>
              {allTerms.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Outros termos</Text>
                  {allTerms.map((t: any) => (
                    <View key={t.id} style={[styles.termRow, { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }]}>
                      <View style={[styles.termDot, { backgroundColor: "#3B82F6" }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.termTitle, { color: "#1D4ED8" }]}>{t.termTitle}</Text>
                        <Text style={styles.termDate}>{new Date(t.acceptedAt).toLocaleDateString("pt-BR")}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
              {(userTerms ?? []).length === 0 && (
                <Text style={styles.termEmpty}>Nenhum termo assinado ainda.</Text>
              )}
            </View>
          );
        })()}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtnFull, isDirty && !saving && styles.saveBtnFullActive, (saving || !isDirty) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={saving || !isDirty}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnFullText}>{isDirty ? "Salvar Alterações" : "Sem alterações"}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Delete user button (master_admin only) ── */}
        {isMasterAdmin && !isMaster && (
          <TouchableOpacity
            style={styles.deleteUserBtn}
            onPress={() => setDeleteUserConfirm(1)}
            activeOpacity={0.8}
          >
            <Feather name="trash-2" size={15} color="#EF4444" />
            <Text style={styles.deleteUserBtnText}>Excluir usuário permanentemente</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Toast ── */}
      {showToast && (
        <View style={styles.toast} pointerEvents="none">
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>Alterações salvas</Text>
        </View>
      )}

      {/* ═══════════ ADD TAG MODAL ═══════════ */}
      <Modal visible={addTagModal} transparent animationType="fade" onRequestClose={() => setAddTagModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Tag</Text>
              <TouchableOpacity onPress={() => setAddTagModal(false)}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Nome da tag *</Text>
              <TextInput
                style={styles.modalInput}
                value={newTagLabel}
                onChangeText={setNewTagLabel}
                placeholder="Ex: Depósito, Cozinha…"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              <Text style={[styles.modalLabel, { marginTop: 14 }]}>Cor</Text>
              <View style={styles.colorGrid}>
                {TAG_COLORS.map((hex) => (
                  <View key={hex} style={[styles.swatchRing, newTagColor === hex && { borderColor: hex }]}>
                    <TouchableOpacity
                      style={[styles.colorSwatch, { backgroundColor: hex }]}
                      onPress={() => setNewTagColor(hex)}
                      activeOpacity={0.8}
                    >
                      {newTagColor === hex && (
                        <Feather name="check" size={14} color={isLightColor(hex) ? "#374151" : "#fff"} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {newTagLabel.trim().length > 0 && (
                <View style={[styles.tagPreview, { backgroundColor: colorBg(newTagColor), borderColor: newTagColor }]}>
                  <Text style={[styles.tagPreviewText, { color: newTagColor }]}>{newTagLabel.trim()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, (!newTagLabel.trim() || addingTag) && { opacity: 0.4 }]}
              onPress={doAddTag}
              disabled={!newTagLabel.trim() || addingTag}
            >
              {addingTag ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Criar Tag</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ EDIT TAG MODAL ═══════════ */}
      <Modal visible={!!editTagData} transparent animationType="fade" onRequestClose={() => setEditTagData(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Tag</Text>
              <TouchableOpacity onPress={() => setEditTagData(null)}>
                <Feather name="x" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Nome da tag *</Text>
              <TextInput
                style={styles.modalInput}
                value={editTagData?.label ?? ""}
                onChangeText={(v) => setEditTagData((prev) => prev ? { ...prev, label: v } : null)}
                placeholder="Nome da tag"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              <Text style={[styles.modalLabel, { marginTop: 14 }]}>Cor</Text>
              <View style={styles.colorGrid}>
                {TAG_COLORS.map((hex) => (
                  <View key={hex} style={[styles.swatchRing, editTagData?.color === hex && { borderColor: hex }]}>
                    <TouchableOpacity
                      style={[styles.colorSwatch, { backgroundColor: hex }]}
                      onPress={() => setEditTagData((prev) => prev ? { ...prev, color: hex } : null)}
                      activeOpacity={0.8}
                    >
                      {editTagData?.color === hex && (
                        <Feather name="check" size={14} color={isLightColor(hex) ? "#374151" : "#fff"} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {editTagData && editTagData.label.trim().length > 0 && (
                <View style={[styles.tagPreview, { backgroundColor: colorBg(editTagData.color), borderColor: editTagData.color }]}>
                  <Text style={[styles.tagPreviewText, { color: editTagData.color }]}>{editTagData.label.trim()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, (!editTagData?.label.trim() || editingTag) && { opacity: 0.4 }]}
              onPress={doEditTag}
              disabled={!editTagData?.label.trim() || editingTag}
            >
              {editingTag ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Salvar Tag</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ DELETE TAG — STEP 1 ═══════════ */}
      <Modal visible={deleteTagConfirm?.step === 1} transparent animationType="fade" onRequestClose={() => setDeleteTagConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.confirmIcon}>
              <Feather name="alert-triangle" size={28} color="#D97706" />
            </View>
            <Text style={styles.confirmTitle}>Excluir tag "{deleteTagConfirm?.label}"?</Text>
            <Text style={styles.confirmDesc}>
              Isso removerá a tag de todos os colaboradores e das permissões de todos os canais que a utilizam.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteTagConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmNext}
                onPress={() => setDeleteTagConfirm((prev) => prev ? { ...prev, step: 2 } : null)}
              >
                <Text style={styles.confirmNextText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════ DELETE TAG — STEP 2 ═══════════ */}
      <Modal visible={deleteTagConfirm?.step === 2} transparent animationType="fade" onRequestClose={() => setDeleteTagConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Confirmar exclusão definitiva</Text>
            <Text style={styles.confirmDesc}>
              A tag <Text style={{ fontFamily: "Inter_700Bold" }}>"{deleteTagConfirm?.label}"</Text> será excluída permanentemente. Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteTagConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deletingTag && { opacity: 0.5 }]}
                onPress={doDeleteTag}
                disabled={deletingTag}
              >
                {deletingTag ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmDeleteText}>Excluir permanentemente</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════ DELETE USER — STEP 1 ═══════════ */}
      <Modal visible={deleteUserConfirm === 1} transparent animationType="fade" onRequestClose={() => setDeleteUserConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.confirmIcon}>
              <Feather name="alert-triangle" size={28} color="#D97706" />
            </View>
            <Text style={styles.confirmTitle}>Excluir usuário?</Text>
            <Text style={styles.confirmDesc}>
              Você está prestes a excluir permanentemente a conta de{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{user?.name}</Text>.{"\n\n"}
              Todos os dados do usuário serão removidos. Esta ação é irreversível.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteUserConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmNext} onPress={() => setDeleteUserConfirm(2)}>
                <Text style={styles.confirmNextText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════ DELETE USER — STEP 2 ═══════════ */}
      <Modal visible={deleteUserConfirm === 2} transparent animationType="fade" onRequestClose={() => setDeleteUserConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.confirmIcon}>
              <Feather name="user-x" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Confirmar exclusão permanente</Text>
            <Text style={styles.confirmDesc}>
              Tem certeza absoluta? A conta de{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{user?.name}</Text>{" "}
              (<Text style={{ fontFamily: "Inter_500Medium", color: C.textMuted }}>{user?.email}</Text>)
              {" "}será excluída para sempre.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteUserConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deletingUser && { opacity: 0.5 }]}
                onPress={doDeleteUser}
                disabled={deletingUser}
              >
                {deletingUser ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmDeleteText}>Excluir permanentemente</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  saveBtn: { backgroundColor: C.tint, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnActive: {
    backgroundColor: "#16A34A",
    shadowColor: "#16A34A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45, shadowRadius: 6, elevation: 5,
  },
  saveBtnInner: { flexDirection: "row", alignItems: "center", gap: 5 },
  saveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FDE68A" },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  pendingBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#FDE68A",
  },
  pendingBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" },

  content: { padding: 14, gap: 12 },

  profileCard: {
    flexDirection: "row", gap: 14, alignItems: "center",
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  profileName: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  profileEmail: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  profileBadgeRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rolePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  banPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: "#FECACA",
  },
  banPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  masterWarning: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  masterWarningText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#B45309", flex: 1 },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    gap: 10,
  },

  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitleText: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  addTagBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: C.tint + "40",
    backgroundColor: "#EFF6FF",
  },
  addTagBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },

  divider: { height: 1, backgroundColor: C.borderLight, marginVertical: 2 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleOption: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surfaceAlt,
  },
  roleOptionText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textMuted },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  toggleDesc: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },

  warningBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  warningBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" },

  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChipWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surfaceAlt,
  },
  tagChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  tagEditBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.borderLight,
  },
  tagDeleteBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.borderLight,
  },

  banStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  banDot: { width: 8, height: 8, borderRadius: 4 },
  banStatusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  unbanBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  unbanBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#059669" },
  banQuickRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  banCalBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: "#EFF6FF",
  },
  banCalBtnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#1D4ED8" },
  banPermanentBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2",
  },
  banPermanentBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  calendar: { marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 12, overflow: "hidden" },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  calNavBtn: { padding: 6, borderRadius: 8, backgroundColor: C.surfaceAlt },
  calMonthLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  calDayRow: { flexDirection: "row", marginBottom: 4 },
  calDayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted, paddingVertical: 4 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%` as any, aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  calCellSelected: { backgroundColor: "#2563EB" },
  calCellToday: { backgroundColor: "#EFF6FF" },
  calCellPast: { opacity: 0.3 },
  calCellText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  calCellTextSelected: { color: "#fff", fontFamily: "Inter_700Bold" },
  calCellTextPast: { color: C.textMuted },
  banApplyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#DC2626", borderRadius: 10, padding: 12, marginTop: 10,
  },
  banApplyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  input: {
    backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },

  termRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  termDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  termTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  termDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  termEmpty: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },

  saveBtnFull: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnFullActive: { backgroundColor: "#16A34A", shadowColor: "#16A34A", shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  saveBtnFullText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  deleteUserBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, paddingVertical: 14, marginTop: 4,
    borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2",
  },
  deleteUserBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  undoBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A",
    alignItems: "center", justifyContent: "center", marginRight: 4,
  },

  toast: {
    position: "absolute", bottom: 36, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
  },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: { backgroundColor: C.surface, borderRadius: 20, width: "100%", maxWidth: 400, overflow: "hidden" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  modalBody: { padding: 20 },
  modalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 8 },
  modalInput: {
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatchRing: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: "transparent",
    padding: 3, alignItems: "center", justifyContent: "center",
  },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tagPreview: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 14, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tagPreviewText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  modalBtn: { backgroundColor: C.tint, paddingVertical: 14, alignItems: "center", margin: 20, marginTop: 0, borderRadius: 12 },
  modalBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  confirmIcon: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  confirmTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center", paddingHorizontal: 24, marginBottom: 8 },
  confirmDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", paddingHorizontal: 24, lineHeight: 22, marginBottom: 24 },
  confirmBtns: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  confirmCancel: { flex: 1, paddingVertical: 16, alignItems: "center", borderRightWidth: 1, borderRightColor: C.border },
  confirmCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  confirmNext: { flex: 1, paddingVertical: 16, alignItems: "center" },
  confirmNextText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.tint },
  confirmDelete: { flex: 1, paddingVertical: 16, alignItems: "center", backgroundColor: "#FEF2F2" },
  confirmDeleteText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#EF4444" },
});
