import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, TextInput, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Constantes ────────────────────────────────────────────────────────────
const WORK_TAGS = [
  { key: "posto", label: "Posto", color: "#2563EB", bg: "#EFF6FF" },
  { key: "churrascaria", label: "Churrascaria", color: "#DC2626", bg: "#FEF2F2" },
  { key: "marketing", label: "Marketing", color: "#7C3AED", bg: "#F5F3FF" },
  { key: "adm", label: "Adm", color: "#D97706", bg: "#FFFBEB" },
  { key: "socio", label: "Sócio", color: "#059669", bg: "#F0FDF4" },
  { key: "gerente", label: "Gerente", color: "#0891B2", bg: "#F0F9FF" },
];

const FAMILY_TAGS = [
  { key: "mae", label: "Mãe", icon: "heart" as const, color: "#EC4899", bg: "#FDF2F8" },
  { key: "pai", label: "Pai", icon: "star" as const, color: "#6366F1", bg: "#EEF2FF" },
];

const ROLES = [
  { key: "user", label: "Colaborador", color: "#6B7280", icon: "user" as const },
  { key: "moderator", label: "Moderador", color: "#3B82F6", icon: "shield" as const },
  { key: "admin", label: "Administrador", color: "#8B5CF6", icon: "shield" as const },
];

function getInitials(name: string) {
  return name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() ?? "?";
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

// ─── Section header ────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Feather name={icon} size={14} color={C.tint} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

// ─── Tela ──────────────────────────────────────────────────────────────────
export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  // Form state
  const [role, setRole] = useState("user");
  const [tag, setTag] = useState<string | null>(null);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [appBanned, setAppBanned] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [banning, setBanning] = useState(false);

  // Calendar picker state for post ban
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBanDate, setSelectedBanDate] = useState<Date | null>(null);
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  // Current ban info (from user data)
  const banned = user ? isBannedNow(user.bannedUntil) : false;
  const banLabel = user ? formatBanDate(user.bannedUntil) : "";

  useEffect(() => {
    if (user) {
      setRole(user.role === "master_admin" ? "admin" : user.role);
      setTag(user.tag ?? null);
      setExtraTags(Array.isArray(user.extraTags) ? user.extraTags : []);
      setAppBanned(user.appBanned ?? false);
      setBirthDate(user.birthDate ?? "");
      setCpf(user.cpf ?? "");
      setAdmissionDate(user.admissionDate ?? "");
    }
  }, [user]);

  function toggleExtraTag(key: string) {
    setExtraTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, {
        role,
        tag: tag || null,
        extraTags,
        appBanned,
        birthDate: birthDate || null,
        cpf: cpf || null,
        admissionDate: admissionDate || null,
      });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      await qc.invalidateQueries({ queryKey: ["admin-user", id] });
      Alert.alert("Salvo!", "Alterações aplicadas com sucesso.");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function applyBan(until: Date | "permanent") {
    const isPermanent = until === "permanent";
    const dateStr = isPermanent ? "9999-12-31T23:59:59Z" : (until as Date).toISOString();
    const label = isPermanent
      ? "permanentemente"
      : `até ${(until as Date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

    Alert.alert(
      "Confirmar banimento",
      `Banir ${user?.name} de postar ${label}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Banir",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ]
    );
  }

  async function handleUnban() {
    Alert.alert(
      "Revogar banimento",
      `Liberar ${user?.name} para postar novamente?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "default",
          onPress: async () => {
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
          },
        },
      ]
    );
  }

  // Calendar helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }
  function getFirstWeekday(year: number, month: number) {
    return new Date(year, month, 1).getDay(); // 0=Sun
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Editar colaborador
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || isMaster) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving || isMaster}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 60 : 100 }]}
      >
        {/* User profile header */}
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
              <Text style={styles.warningBannerText}>
                Esta conta está banida. O usuário não conseguirá entrar no app.
              </Text>
            </View>
          )}
        </View>

        {/* ── Tags ── */}
        <View style={styles.card}>
          <SectionTitle icon="tag" title="Tags de Trabalho" />
          <Text style={styles.fieldLabel}>Unidade principal</Text>
          <View style={styles.tagGrid}>
            {WORK_TAGS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tagChip, tag === t.key && { backgroundColor: t.bg, borderColor: t.color }]}
                onPress={() => setTag(tag === t.key ? null : t.key)}
                activeOpacity={0.8}
              >
                {tag === t.key && <Feather name="check" size={11} color={t.color} />}
                <Text style={[styles.tagChipText, tag === t.key && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />
          <SectionTitle icon="heart" title="Família" />
          <View style={styles.tagGrid}>
            {FAMILY_TAGS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tagChip, extraTags.includes(t.key) && { backgroundColor: t.bg, borderColor: t.color }]}
                onPress={() => toggleExtraTag(t.key)}
                activeOpacity={0.8}
              >
                {extraTags.includes(t.key) && <Feather name="check" size={11} color={t.color} />}
                <Text style={[styles.tagChipText, extraTags.includes(t.key) && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Banimento de postagem ── */}
        <View style={styles.card}>
          <SectionTitle icon="slash" title="Banimento de Postagem" />

          {/* Status atual */}
          <View style={styles.banStatusRow}>
            <View style={[styles.banDot, { backgroundColor: banned ? "#EF4444" : "#059669" }]} />
            <Text style={[styles.banStatusText, { color: banned ? "#EF4444" : "#059669" }]}>
              {banned ? banLabel : "Ativo — pode postar normalmente"}
            </Text>
          </View>

          {/* Revogar banimento */}
          {banned && (
            <TouchableOpacity
              style={[styles.unbanBtn, banning && { opacity: 0.5 }]}
              onPress={handleUnban}
              disabled={banning}
              activeOpacity={0.8}
            >
              {banning
                ? <ActivityIndicator size="small" color="#059669" />
                : <>
                  <Feather name="check-circle" size={14} color="#059669" />
                  <Text style={styles.unbanBtnText}>Revogar Banimento</Text>
                </>}
            </TouchableOpacity>
          )}

          {/* ── Novo banimento ── */}
          {!isMaster && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Novo banimento:</Text>

              {/* Quick actions row */}
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

              {/* Inline Calendar */}
              {showCalendar && (() => {
                const totalDays = getDaysInMonth(calYear, calMonth);
                const firstDay = getFirstWeekday(calYear, calMonth);
                const cells: (number | null)[] = [
                  ...Array(firstDay).fill(null),
                  ...Array.from({ length: totalDays }, (_, i) => i + 1),
                ];
                return (
                  <View style={styles.calendar}>
                    {/* Month nav */}
                    <View style={styles.calHeader}>
                      <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                        <Feather name="chevron-left" size={18} color={C.text} />
                      </TouchableOpacity>
                      <Text style={styles.calMonthLabel}>{MONTHS_PT[calMonth]} {calYear}</Text>
                      <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                        <Feather name="chevron-right" size={18} color={C.text} />
                      </TouchableOpacity>
                    </View>

                    {/* Day labels */}
                    <View style={styles.calDayRow}>
                      {DAYS_PT.map((d, i) => (
                        <Text key={i} style={styles.calDayLabel}>{d}</Text>
                      ))}
                    </View>

                    {/* Day grid */}
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
                            style={[
                              styles.calCell,
                              isSelected && styles.calCellSelected,
                              isToday && !isSelected && styles.calCellToday,
                              isPast && styles.calCellPast,
                            ]}
                            onPress={() => { if (!isPast) setSelectedBanDate(cellDate); }}
                            disabled={isPast}
                            activeOpacity={0.75}
                          >
                            <Text style={[
                              styles.calCellText,
                              isSelected && styles.calCellTextSelected,
                              isPast && styles.calCellTextPast,
                              isToday && !isSelected && { color: C.tint, fontFamily: "Inter_700Bold" },
                            ]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Apply button */}
                    {selectedBanDate && (
                      <TouchableOpacity
                        style={[styles.banApplyBtn, banning && { opacity: 0.5 }]}
                        onPress={() => applyBan(selectedBanDate)}
                        disabled={banning}
                        activeOpacity={0.8}
                      >
                        {banning
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <>
                            <Feather name="slash" size={14} color="#fff" />
                            <Text style={styles.banApplyBtnText}>
                              Banir até {selectedBanDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                            </Text>
                          </>}
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
          <TextInput
            style={styles.input}
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CPF</Text>
          <TextInput
            style={styles.input}
            value={cpf}
            onChangeText={setCpf}
            placeholder="000.000.000-00"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            maxLength={14}
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Data de contratação</Text>
          <TextInput
            style={styles.input}
            value={admissionDate}
            onChangeText={setAdmissionDate}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
          />
        </View>

        {/* ── Termos Assinados ── */}
        {(() => {
          const imageTerm = (userTerms ?? []).find((t: any) => t.termKey === "image_voice_authorization");
          const hasImage = !!imageTerm;
          const signedDate = hasImage
            ? new Date(imageTerm.acceptedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
            : null;
          const allTerms = (userTerms ?? []).filter((t: any) => t.termKey !== "image_voice_authorization");
          return (
            <View style={styles.card}>
              <SectionTitle icon="file-text" title="Termos Assinados" />

              {/* Termo de imagem destacado */}
              <View style={[styles.termRow, { borderColor: hasImage ? "#BBF7D0" : "#FECACA", backgroundColor: hasImage ? "#F0FDF4" : "#FEF2F2" }]}>
                <View style={[styles.termDot, { backgroundColor: hasImage ? "#059669" : "#EF4444" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.termTitle, { color: hasImage ? "#059669" : "#DC2626" }]}>
                    {hasImage ? "✓ Assinou" : "✗ Não assinou"} — Termo de Uso de Imagem e Voz
                  </Text>
                  {signedDate && (
                    <Text style={styles.termDate}>Assinado em {signedDate}</Text>
                  )}
                </View>
              </View>

              {/* Outros termos */}
              {allTerms.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Outros termos</Text>
                  {allTerms.map((t: any) => (
                    <View key={t.id} style={[styles.termRow, { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }]}>
                      <View style={[styles.termDot, { backgroundColor: "#3B82F6" }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.termTitle, { color: "#1D4ED8" }]}>{t.termTitle}</Text>
                        <Text style={styles.termDate}>
                          {new Date(t.acceptedAt).toLocaleDateString("pt-BR")}
                        </Text>
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

        {/* Save button bottom */}
        <TouchableOpacity
          style={[styles.saveBtnFull, (saving || isMaster) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving || isMaster}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnFullText}>Salvar Alterações</Text>
            </>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  saveBtn: {
    backgroundColor: C.tint, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  content: { padding: 14, gap: 12 },

  /* Profile card */
  profileCard: {
    flexDirection: "row", gap: 14, alignItems: "center",
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  avatarText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  profileEmail: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  profileBadgeRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  rolePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  banPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderColor: "#FECACA",
  },
  banPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  masterWarning: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderColor: "#FDE68A",
  },
  masterWarningText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#B45309", flex: 1 },

  /* Card */
  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    gap: 10,
  },

  /* Section title */
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitleText: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },

  divider: { height: 1, backgroundColor: C.borderLight, marginVertical: 2 },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  /* Role selector */
  roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleOption: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderColor: C.border,
    backgroundColor: C.surfaceAlt,
  },
  roleOptionText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textMuted },

  /* Toggle */
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  toggleDesc: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },

  warningBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF3C7", borderRadius: 8, padding: 10,
    borderColor: "#FDE68A",
  },
  warningBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" },

  /* Tag grid */
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderColor: C.border,
    backgroundColor: C.surfaceAlt,
  },
  tagChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },

  /* Ban */
  banStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  banDot: { width: 8, height: 8, borderRadius: 4 },
  banStatusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  unbanBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10,
    borderColor: "#BBF7D0",
  },
  unbanBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#059669" },
  /* Ban quick actions */
  banQuickRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  banCalBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  banCalBtnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#1D4ED8" },
  banPermanentBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  banPermanentBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  /* Inline calendar */
  calendar: {
    marginTop: 10, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.surface,
    padding: 12, overflow: "hidden",
  },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  calNavBtn: { padding: 6, borderRadius: 8, backgroundColor: C.surfaceAlt },
  calMonthLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  calDayRow: { flexDirection: "row", marginBottom: 4 },
  calDayLabel: {
    flex: 1, textAlign: "center",
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted,
    paddingVertical: 4,
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: "center", alignItems: "center",
    borderRadius: 8,
  },
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

  /* Input */
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: 10,
    borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },

  /* Term acceptance */
  termRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  termDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3, flexShrink: 0 },
  termTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  termDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  termEmpty: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },

  /* Save full button */
  saveBtnFull: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnFullText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
