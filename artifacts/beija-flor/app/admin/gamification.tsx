import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Switch, Platform, FlatList, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import DatePickerModal from "@/components/DatePickerModal";

const C = Colors.light;

// ─── Types ────────────────────────────────────────────────────────────────────
type Rule = {
  id: number; actionType: string; label: string; isActive: boolean;
  pointsPerAction: number; dailyLimit: number; cooldownSeconds: number;
  minChars: number; blockedTerms: string[]; maxCommentsPerPost: number;
  useDecreasingPoints: boolean; decreaseValues: number[];
};

type Leaderboard = {
  id: number; name: string; description: string | null;
  startDate: string; endDate: string; status: string;
  validActions: string[]; isVisible: boolean; tiebreakRule: string;
  showsProfileAchievement: boolean; createdBy: number; createdAt: string;
};

type UserGamif = {
  id: number; name: string; email: string; avatarUrl: string | null;
  tag: string | null; role: string; totalPoints: number;
  leaderboardPoints: number | null; isBlocked: boolean; block: any;
};

type GamifEvent = {
  id: number; userId: number; actionType: string; entityType: string | null;
  entityId: number | null; pointsAwarded: number; pointsBlocked: number;
  status: string; blockReason: string | null; createdAt: string;
  user: { id: number; name: string; avatarUrl: string | null };
};

type AdminLog = {
  id: number; action: string; details: any; oldValue: string | null;
  newValue: string | null; createdAt: string;
  admin: { id: number; name: string };
};

type Dashboard = {
  totalPoints: number; todayActions: number; blockedToday: number;
  activeCompetitions: number; blockedUsers: number; usersAtDailyLimit: number;
  actionBreakdown: { actionType: string; total: number; points: number }[];
};

type SubView = "dashboard" | "rules" | "leaderboards" | "users" | "events" | "logs";

const ACTION_LABELS: Record<string, string> = {
  like: "Curtir", comment: "Comentar",
  doc_read: "Ler documento", doc_sign: "Assinar documento",
  manual_adjustment: "Ajuste manual",
};

const STATUS_COLORS: Record<string, string> = {
  valid: "#10B981", blocked: "#EF4444", cancelled: "#6B7280",
  manual: "#7C3AED", error: "#F59E0B",
};

const LB_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", active: "Ativa", paused: "Pausada",
  ended: "Encerrada", archived: "Arquivada",
};
const LB_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", active: "#10B981", paused: "#F59E0B",
  ended: "#3B82F6", archived: "#9CA3AF",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return s; }
}
function fmtDateTime(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}
function toInputDate(s: string) {
  try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number | string; color?: string }) {
  return (
    <View style={st.statCard}>
      <View style={[st.statIcon, { backgroundColor: color ? `${color}22` : "#EFF6FF" }]}>
        <Feather name={icon} size={18} color={color ?? C.tint} />
      </View>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({ leaderboards }: { leaderboards: Leaderboard[] }) {
  const { data: dash, isLoading } = useQuery<Dashboard>({
    queryKey: ["admin-gamif-dashboard"],
    queryFn: () => api.get("/gamification/admin/dashboard"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />;

  const d = dash!;
  const actives = leaderboards.filter((lb) => lb.status === "active");

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
      <View style={st.dashGrid}>
        <StatCard icon="zap" label="Pts gerados" value={d.totalPoints} color="#7C3AED" />
        <StatCard icon="activity" label="Ações hoje" value={d.todayActions} color="#2563EB" />
        <StatCard icon="shield" label="Bloqueadas hoje" value={d.blockedToday} color="#EF4444" />
        <StatCard icon="trophy" label="Competições ativas" value={d.activeCompetitions} color="#F59E0B" />
        <StatCard icon="user-x" label="Usuários bloqueados" value={d.blockedUsers} color="#EF4444" />
        <StatCard icon="alert-circle" label="No limite hoje" value={d.usersAtDailyLimit} color="#F97316" />
      </View>

      {actives.length > 0 && (
        <View style={st.sectionBox}>
          <Text style={st.sectionTitle}>Competições Ativas</Text>
          {actives.map((lb) => (
            <View key={lb.id} style={st.activeLbCard}>
              <View style={[st.lbStatusDot, { backgroundColor: LB_STATUS_COLORS[lb.status] ?? "#9CA3AF" }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.activeLbName}>{lb.name}</Text>
                <Text style={st.activeLbDate}>{fmtDate(lb.startDate)} → {fmtDate(lb.endDate)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {d.actionBreakdown.length > 0 && (
        <View style={st.sectionBox}>
          <Text style={st.sectionTitle}>Ações Hoje por Tipo</Text>
          {d.actionBreakdown.map((a) => (
            <View key={a.actionType} style={st.breakdownRow}>
              <Text style={st.breakdownLabel}>{ACTION_LABELS[a.actionType] ?? a.actionType}</Text>
              <Text style={st.breakdownCount}>{a.total}x</Text>
              <Text style={st.breakdownPts}>+{a.points} pts</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Rules ────────────────────────────────────────────────────────────────────
function RulesView() {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery<Rule[]>({
    queryKey: ["admin-gamif-rules"],
    queryFn: () => api.get("/gamification/admin/rules"),
  });
  const [editing, setEditing] = useState<Rule | null>(null);

  const saveMut = useMutation({
    mutationFn: (data: { id: number; payload: any }) =>
      api.patch(`/gamification/admin/rules/${data.id}`, data.payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gamif-rules"] }); setEditing(null); },
    onError: () => Alert.alert("Erro", "Não foi possível salvar."),
  });

  if (isLoading) return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        {rules.map((r) => (
          <View key={r.id} style={[st.ruleCard, !r.isActive && st.ruleCardInactive]}>
            <View style={st.ruleCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={st.ruleLabel}>{r.label}</Text>
                <Text style={st.ruleType}>{r.actionType}</Text>
              </View>
              <View style={[st.ruleStatusBadge, { backgroundColor: r.isActive ? "#DCFCE7" : "#F3F4F6" }]}>
                <Text style={[st.ruleStatusText, { color: r.isActive ? "#15803D" : "#9CA3AF" }]}>
                  {r.isActive ? "Ativo" : "Inativo"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditing(r)} style={st.editIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="edit-2" size={15} color={C.tint} />
              </TouchableOpacity>
            </View>
            <View style={st.ruleMetaRow}>
              <View style={st.ruleMetaItem}>
                <Feather name="zap" size={11} color="#F59E0B" />
                <Text style={st.ruleMetaText}>{r.pointsPerAction} pts</Text>
              </View>
              <View style={st.ruleMetaItem}>
                <Feather name="calendar" size={11} color="#6B7280" />
                <Text style={st.ruleMetaText}>Limite: {r.dailyLimit}/dia</Text>
              </View>
              {r.cooldownSeconds > 0 && (
                <View style={st.ruleMetaItem}>
                  <Feather name="clock" size={11} color="#6B7280" />
                  <Text style={st.ruleMetaText}>{r.cooldownSeconds}s cooldown</Text>
                </View>
              )}
              {r.minChars > 0 && (
                <View style={st.ruleMetaItem}>
                  <Feather name="type" size={11} color="#6B7280" />
                  <Text style={st.ruleMetaText}>Min {r.minChars} chars</Text>
                </View>
              )}
            </View>
            {r.useDecreasingPoints && r.decreaseValues.length > 0 && (
              <Text style={st.ruleDecLabel}>
                Decrescente: {r.decreaseValues.join(" → ")} pts
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      {editing && (
        <RuleEditor rule={editing} onClose={() => setEditing(null)}
          onSave={(payload) => saveMut.mutate({ id: editing.id, payload })}
          saving={saveMut.isPending}
        />
      )}
    </>
  );
}

function RuleEditor({ rule, onClose, onSave, saving }: {
  rule: Rule; onClose: () => void;
  onSave: (p: any) => void; saving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [pts, setPts] = useState(String(rule.pointsPerAction));
  const [limit, setLimit] = useState(String(rule.dailyLimit));
  const [cooldown, setCooldown] = useState(String(rule.cooldownSeconds));
  const [minChars, setMinChars] = useState(String(rule.minChars));
  const [maxPP, setMaxPP] = useState(String(rule.maxCommentsPerPost));
  const [active, setActive] = useState(rule.isActive);
  const [useDec, setUseDec] = useState(rule.useDecreasingPoints);
  const [decVals, setDecVals] = useState(rule.decreaseValues.join(", "));
  const [terms, setTerms] = useState((rule.blockedTerms ?? []).join("\n"));

  function handleSave() {
    const decreaseValues = decVals.split(",").map((v) => parseInt(v.trim())).filter((v) => !isNaN(v));
    const blockedTerms = terms.split("\n").map((t) => t.trim()).filter(Boolean);
    onSave({
      isActive: active,
      pointsPerAction: parseInt(pts) || 0,
      dailyLimit: parseInt(limit) || 0,
      cooldownSeconds: parseInt(cooldown) || 0,
      minChars: parseInt(minChars) || 0,
      maxCommentsPerPost: parseInt(maxPP) || 0,
      useDecreasingPoints: useDec,
      decreaseValues,
      blockedTerms,
    });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={st.modalContainer}>
        <View style={[st.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={st.modalTitle}>Editar Regra: {rule.label}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[st.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }} keyboardShouldPersistTaps="handled">
          <SwitchRow label="Ação Ativa" value={active} onValueChange={setActive} desc="Desativar impede que esta ação gere pontos" />
          <NumberRow label="Pontos por ação" value={pts} onChange={setPts} />
          <NumberRow label="Limite diário (0 = ilimitado)" value={limit} onChange={setLimit} />
          <NumberRow label="Cooldown (segundos)" value={cooldown} onChange={setCooldown} />
          {rule.actionType === "comment" && (
            <>
              <NumberRow label="Mínimo de caracteres" value={minChars} onChange={setMinChars} />
              <NumberRow label="Máx. comentários pontuáveis por post" value={maxPP} onChange={setMaxPP} />
              <View style={st.fieldRow}>
                <Text style={st.fieldLabel}>Termos bloqueados (um por linha)</Text>
                <TextInput
                  style={[st.input, { height: 120, textAlignVertical: "top" }]}
                  value={terms}
                  onChangeText={setTerms}
                  placeholder={"ok\ntop\nshow\nbom dia\n👍"}
                  placeholderTextColor={C.textMuted}
                  multiline
                />
              </View>
            </>
          )}
          <SwitchRow
            label="Pontuação decrescente"
            value={useDec}
            onValueChange={setUseDec}
            desc="Ações repetidas no dia valem menos pontos"
          />
          {useDec && (
            <View style={st.fieldRow}>
              <Text style={st.fieldLabel}>Valores decrescentes (separados por vírgula)</Text>
              <TextInput
                style={st.input}
                value={decVals}
                onChangeText={setDecVals}
                placeholder="5, 4, 3, 2, 1"
                placeholderTextColor={C.textMuted}
              />
              <Text style={st.fieldHint}>Ex: 5, 4, 3 = 1ª ação vale 5pts, 2ª vale 4pts, 3ª vale 3pts</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Leaderboards ─────────────────────────────────────────────────────────────
function LeaderboardsView() {
  const qc = useQueryClient();
  const { data: lbs = [], isLoading } = useQuery<Leaderboard[]>({
    queryKey: ["admin-gamif-leaderboards"],
    queryFn: () => api.get("/gamification/admin/leaderboards"),
  });
  const [showForm, setShowForm] = useState(false);
  const [editLb, setEditLb] = useState<Leaderboard | null>(null);
  const [showRankings, setShowRankings] = useState<number | null>(null);

  const createMut = useMutation({
    mutationFn: (data: any) => api.post("/gamification/admin/leaderboards", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gamif-leaderboards"] }); setShowForm(false); },
    onError: () => Alert.alert("Erro", "Não foi possível criar."),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: number; payload: any }) =>
      api.patch(`/gamification/admin/leaderboards/${data.id}`, data.payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gamif-leaderboards"] }); setEditLb(null); },
    onError: () => Alert.alert("Erro", "Não foi possível salvar."),
  });

  const dupMut = useMutation({
    mutationFn: (id: number) => api.post(`/gamification/admin/leaderboards/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-gamif-leaderboards"] }),
    onError: () => Alert.alert("Erro", "Não foi possível duplicar."),
  });

  if (isLoading) return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        <TouchableOpacity style={st.createBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
          <Feather name="plus-circle" size={16} color={C.tint} />
          <Text style={st.createBtnText}>Nova Competição</Text>
        </TouchableOpacity>

        {lbs.length === 0 && (
          <View style={st.emptyState}>
            <Feather name="award" size={36} color={C.textMuted} />
            <Text style={st.emptyTitle}>Nenhuma competição criada</Text>
          </View>
        )}

        {lbs.map((lb) => (
          <View key={lb.id} style={st.lbCard}>
            <View style={st.lbCardHeader}>
              <View style={[st.lbStatusBadge, { backgroundColor: `${LB_STATUS_COLORS[lb.status]}22` }]}>
                <Text style={[st.lbStatusText, { color: LB_STATUS_COLORS[lb.status] ?? "#6B7280" }]}>
                  {LB_STATUS_LABELS[lb.status] ?? lb.status}
                </Text>
              </View>
              <Text style={st.lbName} numberOfLines={1}>{lb.name}</Text>
            </View>
            {lb.description ? <Text style={st.lbDesc} numberOfLines={2}>{lb.description}</Text> : null}
            <Text style={st.lbDates}>{fmtDate(lb.startDate)} → {fmtDate(lb.endDate)}</Text>
            <View style={st.lbActions}>
              <TouchableOpacity style={st.lbActionBtn} onPress={() => setEditLb(lb)} activeOpacity={0.8}>
                <Feather name="edit-2" size={13} color={C.tint} />
                <Text style={st.lbActionText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.lbActionBtn} onPress={() => setShowRankings(lb.id)} activeOpacity={0.8}>
                <Feather name="list" size={13} color={C.textSecondary} />
                <Text style={[st.lbActionText, { color: C.textSecondary }]}>Ranking</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.lbActionBtn} onPress={() => dupMut.mutate(lb.id)} activeOpacity={0.8} disabled={dupMut.isPending}>
                <Feather name="copy" size={13} color={C.textSecondary} />
                <Text style={[st.lbActionText, { color: C.textSecondary }]}>Duplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {(showForm || editLb) && (
        <LeaderboardForm
          initial={editLb}
          onClose={() => { setShowForm(false); setEditLb(null); }}
          onSave={(data) => editLb ? updateMut.mutate({ id: editLb.id, payload: data }) : createMut.mutate(data)}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      {showRankings !== null && (
        <RankingsModal lbId={showRankings} onClose={() => setShowRankings(null)} />
      )}
    </>
  );
}

function LeaderboardForm({ initial, onClose, onSave, saving }: {
  initial: Leaderboard | null; onClose: () => void;
  onSave: (data: any) => void; saving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [start, setStart] = useState(initial ? toInputDate(initial.startDate) : "");
  const [end, setEnd] = useState(initial ? toInputDate(initial.endDate) : "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [validActions, setValidActions] = useState<string[]>(initial?.validActions ?? []);
  const [visible, setVisible] = useState(initial?.isVisible ?? true);
  const [tiebreak, setTiebreak] = useState(initial?.tiebreakRule ?? "first_to_score");
  const [showsAchiev, setShowsAchiev] = useState(initial?.showsProfileAchievement ?? true);

  const ALL_ACTIONS = ["like", "comment", "doc_read", "doc_sign"];
  const STATUSES = ["draft", "active", "paused", "ended", "archived"];
  const TIEBREAKS = [
    { value: "first_to_score", label: "Quem pontuou primeiro" },
    { value: "most_actions", label: "Mais ações válidas" },
    { value: "fewest_blocked", label: "Menos ações bloqueadas" },
  ];

  function toggleAction(a: string) {
    setValidActions((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Atenção", "O nome é obrigatório."); return; }
    if (!start || !end) { Alert.alert("Atenção", "Informe as datas de início e fim."); return; }
    onSave({ name: name.trim(), description: desc.trim() || null, startDate: start, endDate: end, status, validActions, isVisible: visible, tiebreakRule: tiebreak, showsProfileAchievement: showsAchiev });
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={st.modalContainer}>
        <View style={[st.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={st.modalTitle}>{initial ? "Editar Competição" : "Nova Competição"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[st.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }} keyboardShouldPersistTaps="handled">
          <FieldRow label="Nome *">
            <TextInput style={st.input} value={name} onChangeText={setName} placeholder="Ex: Ranking de Abril 2026" placeholderTextColor={C.textMuted} />
          </FieldRow>
          <FieldRow label="Descrição">
            <TextInput style={[st.input, { height: 80, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} multiline placeholder="Opcional" placeholderTextColor={C.textMuted} />
          </FieldRow>
          <FieldRow label="Data de início *">
            <DatePickerModal
              value={start}
              onChange={setStart}
              label="Data de início"
              maxDate={end || undefined}
            />
          </FieldRow>
          <FieldRow label="Data de fim *">
            <DatePickerModal
              value={end}
              onChange={setEnd}
              label="Data de fim"
              minDate={start || undefined}
            />
          </FieldRow>
          <FieldRow label="Status">
            <View style={st.chipRow}>
              {STATUSES.map((s) => (
                <TouchableOpacity key={s} style={[st.chip, status === s && st.chipActive]} onPress={() => setStatus(s)} activeOpacity={0.8}>
                  <Text style={[st.chipText, status === s && st.chipTextActive]}>{LB_STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FieldRow>
          <FieldRow label="Ações válidas (vazio = todas)">
            <View style={st.chipRow}>
              {ALL_ACTIONS.map((a) => (
                <TouchableOpacity key={a} style={[st.chip, validActions.includes(a) && st.chipActive]} onPress={() => toggleAction(a)} activeOpacity={0.8}>
                  <Text style={[st.chipText, validActions.includes(a) && st.chipTextActive]}>{ACTION_LABELS[a]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FieldRow>
          <FieldRow label="Critério de desempate">
            <View style={{ gap: 6 }}>
              {TIEBREAKS.map((tb) => (
                <TouchableOpacity key={tb.value} style={[st.radioRow, tiebreak === tb.value && st.radioRowActive]} onPress={() => setTiebreak(tb.value)} activeOpacity={0.8}>
                  <View style={[st.radio, tiebreak === tb.value && st.radioActive]} />
                  <Text style={st.radioText}>{tb.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FieldRow>
          <SwitchRow label="Visível no app" value={visible} onValueChange={setVisible} desc="Usuários veem esta competição" />
          <SwitchRow label="Conquista no perfil" value={showsAchiev} onValueChange={setShowsAchiev} desc="Top 3 recebe conquista no perfil" />
        </ScrollView>
      </View>
    </Modal>
  );
}

function RankingsModal({ lbId, onClose }: { lbId: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { data: rankings = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-lb-rankings", lbId],
    queryFn: () => api.get(`/gamification/admin/leaderboards/${lbId}/rankings`),
  });

  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={st.modalContainer}>
        <View style={[st.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={st.modalTitle}>Ranking</Text>
          <View style={{ width: 60 }} />
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
        ) : rankings.length === 0 ? (
          <View style={st.emptyState}>
            <Feather name="award" size={36} color={C.textMuted} />
            <Text style={st.emptyTitle}>Nenhum participante ainda</Text>
          </View>
        ) : (
          <FlatList
            data={rankings}
            keyExtractor={(item) => String(item.rank)}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => (
              <View style={st.rankRow}>
                <Text style={st.rankPos}>{item.rank <= 3 ? MEDALS[item.rank - 1] : `#${item.rank}`}</Text>
                <View style={st.rankAvatar}>
                  {item.user?.avatarUrl
                    ? <Image source={{ uri: item.user.avatarUrl }} style={st.rankAvatarImg} />
                    : <View style={st.rankAvatarFallback}><Text style={st.rankAvatarInitial}>{item.user?.name?.[0]?.toUpperCase()}</Text></View>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.rankName}>{item.user?.name ?? "Usuário"}</Text>
                  <Text style={st.rankActions}>{item.totalActions} ações válidas</Text>
                </View>
                <Text style={st.rankPts}>{item.totalPoints} pts</Text>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersView({ leaderboards }: { leaderboards: Leaderboard[] }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [lbFilter, setLbFilter] = useState<string>("");
  const [adjustTarget, setAdjustTarget] = useState<UserGamif | null>(null);
  const [blockTarget, setBlockTarget] = useState<UserGamif | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data: users = [], isLoading } = useQuery<UserGamif[]>({
    queryKey: ["admin-gamif-users", lbFilter],
    queryFn: () => api.get(`/gamification/admin/users${lbFilter ? `?leaderboardId=${lbFilter}` : ""}`),
  });

  const blockMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      api.post(`/gamification/admin/users/${userId}/block`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-gamif-users"] }); setBlockTarget(null); setBlockReason(""); },
    onError: () => Alert.alert("Erro", "Não foi possível bloquear."),
  });

  const unblockMut = useMutation({
    mutationFn: (userId: number) => api.post(`/gamification/admin/users/${userId}/unblock`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-gamif-users"] }),
    onError: () => Alert.alert("Erro", "Não foi possível desbloquear."),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <>
      <View style={{ padding: 12, gap: 8 }}>
        <View style={st.searchBar}>
          <Feather name="search" size={15} color={C.textMuted} />
          <TextInput style={st.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar usuário..." placeholderTextColor={C.textMuted} />
          {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={15} color={C.textMuted} /></TouchableOpacity> : null}
        </View>
        {leaderboards.filter((lb) => lb.status === "active").length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity style={[st.chip, !lbFilter && st.chipActive]} onPress={() => setLbFilter("")} activeOpacity={0.8}>
                <Text style={[st.chipText, !lbFilter && st.chipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {leaderboards.filter((lb) => lb.status === "active").map((lb) => (
                <TouchableOpacity key={lb.id} style={[st.chip, lbFilter === String(lb.id) && st.chipActive]} onPress={() => setLbFilter(String(lb.id))} activeOpacity={0.8}>
                  <Text style={[st.chipText, lbFilter === String(lb.id) && st.chipTextActive]} numberOfLines={1}>{lb.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
      {isLoading ? (
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 8 }}
          renderItem={({ item }) => (
            <View style={[st.userCard, item.isBlocked && st.userCardBlocked]}>
              <View style={st.userCardLeft}>
                {item.avatarUrl
                  ? <Image source={{ uri: item.avatarUrl }} style={st.userAvatar} />
                  : <View style={st.userAvatarFallback}><Text style={st.userAvatarInitial}>{item.name?.[0]?.toUpperCase()}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={st.userName} numberOfLines={1}>{item.name}</Text>
                    {item.isBlocked && (
                      <View style={st.blockedBadge}><Text style={st.blockedBadgeText}>Bloqueado</Text></View>
                    )}
                  </View>
                  <Text style={st.userEmail} numberOfLines={1}>{item.email}</Text>
                </View>
              </View>
              <View style={st.userPoints}>
                <Text style={st.userPtsValue}>{lbFilter && item.leaderboardPoints !== null ? item.leaderboardPoints : item.totalPoints}</Text>
                <Text style={st.userPtsLabel}>pts</Text>
              </View>
              <View style={st.userActions}>
                <TouchableOpacity style={st.userActionBtn} onPress={() => setAdjustTarget(item)} activeOpacity={0.8}>
                  <Feather name="edit" size={13} color={C.tint} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.userActionBtn, { backgroundColor: item.isBlocked ? "#DCFCE7" : "#FEF2F2" }]}
                  onPress={() => item.isBlocked ? unblockMut.mutate(item.id) : setBlockTarget(item)}
                  activeOpacity={0.8}
                  disabled={blockMut.isPending || unblockMut.isPending}
                >
                  <Feather name={item.isBlocked ? "user-check" : "user-x"} size={13} color={item.isBlocked ? "#10B981" : "#EF4444"} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {adjustTarget && (
        <AdjustModal
          user={adjustTarget}
          leaderboards={leaderboards.filter((lb) => lb.status === "active")}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-gamif-users"] }); setAdjustTarget(null); }}
        />
      )}

      {/* Block reason modal */}
      {blockTarget && (
        <BlockModal
          user={blockTarget}
          reason={blockReason}
          onReasonChange={setBlockReason}
          saving={blockMut.isPending}
          onClose={() => { setBlockTarget(null); setBlockReason(""); }}
          onConfirm={() => {
            if (!blockReason.trim()) { Alert.alert("Atenção", "Informe o motivo."); return; }
            blockMut.mutate({ userId: blockTarget.id, reason: blockReason.trim() });
          }}
        />
      )}
    </>
  );
}

function BlockModal({ user, reason, onReasonChange, saving, onClose, onConfirm }: {
  user: UserGamif; reason: string; onReasonChange: (r: string) => void;
  saving: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={st.modalContainer}>
        <View style={[st.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={st.modalTitle}>Bloquear Usuário</Text>
          <TouchableOpacity onPress={onConfirm} disabled={saving} style={[st.saveBtn, { backgroundColor: "#EF4444" }, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnText}>Bloquear</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary }}>
            Bloquear <Text style={{ fontFamily: "Inter_700Bold", color: C.text }}>{user.name}</Text> de ganhar pontos.
          </Text>
          <View style={st.fieldRow}>
            <Text style={st.fieldLabel}>Motivo (para auditoria)</Text>
            <TextInput
              style={[st.input, { height: 100, textAlignVertical: "top" }]}
              value={reason}
              onChangeText={onReasonChange}
              multiline
              placeholder="Explique o motivo do bloqueio..."
              placeholderTextColor={C.textMuted}
              autoFocus
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AdjustModal({ user, leaderboards, onClose, onSaved }: {
  user: UserGamif; leaderboards: Leaderboard[];
  onClose: () => void; onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const [lbId, setLbId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const points = parseInt(pts);
    if (isNaN(points)) { Alert.alert("Atenção", "Informe um número de pontos válido."); return; }
    if (!reason.trim()) { Alert.alert("Atenção", "O motivo é obrigatório."); return; }
    setSaving(true);
    try {
      await api.post(`/gamification/admin/users/${user.id}/adjust`, {
        points,
        reason: reason.trim(),
        leaderboardId: lbId ? parseInt(lbId) : undefined,
      });
      onSaved();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível ajustar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={st.modalContainer}>
        <View style={[st.modalHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={st.modalTitle}>Ajuste de Pontos</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[st.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.saveBtnText}>Aplicar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
          <Text style={st.adjustUserName}>{user.name}</Text>
          <FieldRow label="Pontos (use negativo para remover)">
            <TextInput style={st.input} value={pts} onChangeText={setPts} placeholder="+50 ou -20" keyboardType="numbers-and-punctuation" placeholderTextColor={C.textMuted} />
          </FieldRow>
          <FieldRow label="Motivo (para auditoria)">
            <TextInput style={[st.input, { height: 80, textAlignVertical: "top" }]} value={reason} onChangeText={setReason} multiline placeholder="Descreva o motivo do ajuste..." placeholderTextColor={C.textMuted} />
          </FieldRow>
          {leaderboards.length > 0 && (
            <FieldRow label="Aplicar à competição">
              <View style={st.chipRow}>
                <TouchableOpacity style={[st.chip, !lbId && st.chipActive]} onPress={() => setLbId("")} activeOpacity={0.8}>
                  <Text style={[st.chipText, !lbId && st.chipTextActive]}>Nenhuma</Text>
                </TouchableOpacity>
                {leaderboards.map((lb) => (
                  <TouchableOpacity key={lb.id} style={[st.chip, lbId === String(lb.id) && st.chipActive]} onPress={() => setLbId(String(lb.id))} activeOpacity={0.8}>
                    <Text style={[st.chipText, lbId === String(lb.id) && st.chipTextActive]} numberOfLines={1}>{lb.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldRow>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Events ───────────────────────────────────────────────────────────────────
function EventsView({ leaderboards }: { leaderboards: Leaderboard[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { data: events = [], isLoading, refetch } = useQuery<GamifEvent[]>({
    queryKey: ["admin-gamif-events", statusFilter, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (actionFilter) params.set("actionType", actionFilter);
      return api.get(`/gamification/admin/events?${params}`);
    },
  });

  const STATUSES = ["", "valid", "blocked", "manual", "cancelled"];
  const ACTIONS = ["", "like", "comment", "doc_read", "doc_sign", "manual_adjustment"];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ padding: 8, gap: 6, flexDirection: "row", alignItems: "center" }}>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s || "all"} style={[st.chip, statusFilter === s && st.chipActive]} onPress={() => setStatusFilter(s)} activeOpacity={0.8}>
            <Text style={[st.chipText, statusFilter === s && st.chipTextActive]}>{s || "Todos status"}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ padding: 8, gap: 6, flexDirection: "row", alignItems: "center" }}>
        {ACTIONS.map((a) => (
          <TouchableOpacity key={a || "all"} style={[st.chip, actionFilter === a && st.chipActive]} onPress={() => setActionFilter(a)} activeOpacity={0.8}>
            <Text style={[st.chipText, actionFilter === a && st.chipTextActive]}>{a ? ACTION_LABELS[a] ?? a : "Todas ações"}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={st.eventCard}>
              <View style={st.eventCardTop}>
                <View style={[st.eventStatusDot, { backgroundColor: STATUS_COLORS[item.status] ?? "#9CA3AF" }]} />
                <Text style={st.eventUser} numberOfLines={1}>{item.user?.name ?? `#${item.userId}`}</Text>
                <Text style={st.eventTime}>{fmtDateTime(item.createdAt)}</Text>
              </View>
              <View style={st.eventCardBottom}>
                <Text style={st.eventAction}>{ACTION_LABELS[item.actionType] ?? item.actionType}</Text>
                <Text style={[st.eventPts, { color: item.pointsAwarded > 0 ? "#10B981" : "#EF4444" }]}>
                  {item.pointsAwarded > 0 ? `+${item.pointsAwarded}` : item.status === "blocked" ? `bloqueado` : "0"} pts
                </Text>
              </View>
              {item.blockReason && (
                <Text style={st.eventBlockReason}>Motivo: {item.blockReason}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────
function LogsView() {
  const { data: logs = [], isLoading } = useQuery<AdminLog[]>({
    queryKey: ["admin-gamif-logs"],
    queryFn: () => api.get("/gamification/admin/logs"),
    refetchInterval: 30_000,
  });

  const ACTION_LOG_LABELS: Record<string, string> = {
    changed_rule: "Alterou regra",
    created_leaderboard: "Criou competição",
    updated_leaderboard: "Atualizou competição",
    finalized_leaderboard: "Encerrou competição",
    blocked_user: "Bloqueou usuário",
    unblocked_user: "Desbloqueou usuário",
    adjusted_points: "Ajustou pontos",
  };

  if (isLoading) return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
      ListEmptyComponent={
        <View style={st.emptyState}>
          <Feather name="terminal" size={36} color={C.textMuted} />
          <Text style={st.emptyTitle}>Nenhum log registrado</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={st.logCard}>
          <View style={st.logCardTop}>
            <Text style={st.logAction}>{ACTION_LOG_LABELS[item.action] ?? item.action}</Text>
            <Text style={st.logTime}>{fmtDateTime(item.createdAt)}</Text>
          </View>
          <Text style={st.logAdmin}>por {item.admin?.name ?? `Admin #${item.adminId}`}</Text>
          {(item.oldValue || item.newValue) && (
            <Text style={st.logValues}>
              {item.oldValue ? `Antes: ${item.oldValue}` : ""}
              {item.oldValue && item.newValue ? " → " : ""}
              {item.newValue ? `Depois: ${item.newValue}` : ""}
            </Text>
          )}
        </View>
      )}
    />
  );
}

// ─── Sub-component helpers ─────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={st.fieldRow}>
      <Text style={st.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumberRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FieldRow label={label}>
      <TextInput style={st.input} value={value} onChangeText={onChange} keyboardType="number-pad" placeholderTextColor={C.textMuted} />
    </FieldRow>
  );
}

function SwitchRow({ label, value, onValueChange, desc }: { label: string; value: boolean; onValueChange: (v: boolean) => void; desc?: string }) {
  return (
    <TouchableOpacity style={st.switchRow} onPress={() => onValueChange(!value)} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={st.switchLabel}>{label}</Text>
        {desc && <Text style={st.switchDesc}>{desc}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: C.tint, false: C.borderLight }} thumbColor="#fff" />
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
const SUBVIEWS: { key: SubView; icon: any; label: string }[] = [
  { key: "dashboard", icon: "activity", label: "Dashboard" },
  { key: "rules", icon: "sliders", label: "Regras" },
  { key: "leaderboards", icon: "award", label: "Competições" },
  { key: "users", icon: "users", label: "Usuários" },
  { key: "events", icon: "list", label: "Histórico" },
  { key: "logs", icon: "terminal", label: "Log Admin" },
];

export default function AdminGamificationScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom + 20;

  const [subView, setSubView] = useState<SubView>("dashboard");

  const { data: leaderboards = [] } = useQuery<Leaderboard[]>({
    queryKey: ["admin-gamif-leaderboards"],
    queryFn: () => api.get("/gamification/admin/leaderboards"),
  });

  return (
    <View style={[st.container, { paddingTop: topPad }]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={st.title}>Gamificação</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Sub-navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.subNavScroll}
        contentContainerStyle={st.subNavContent}
      >
        {SUBVIEWS.map((sv) => (
          <TouchableOpacity
            key={sv.key}
            style={[st.subNavBtn, subView === sv.key && st.subNavBtnActive]}
            onPress={() => setSubView(sv.key)}
            activeOpacity={0.8}
          >
            <Feather name={sv.icon} size={14} color={subView === sv.key ? C.tint : C.textMuted} />
            <Text style={[st.subNavText, subView === sv.key && st.subNavTextActive]}>{sv.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {subView === "dashboard" && <DashboardView leaderboards={leaderboards} />}
        {subView === "rules" && <RulesView />}
        {subView === "leaderboards" && <LeaderboardsView />}
        {subView === "users" && <UsersView leaderboards={leaderboards} />}
        {subView === "events" && <EventsView leaderboards={leaderboards} />}
        {subView === "logs" && <LogsView />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },

  subNavScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  subNavContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 4, flexDirection: "row" },
  subNavBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "transparent" },
  subNavBtnActive: { backgroundColor: "#EFF6FF" },
  subNavText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted },
  subNavTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },

  // Stats
  dashGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, flex: 1, minWidth: 90, borderWidth: 1, borderColor: C.border },
  statIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" },

  sectionBox: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },

  activeLbCard: { flexDirection: "row", alignItems: "center", gap: 10 },
  lbStatusDot: { width: 8, height: 8, borderRadius: 4 },
  activeLbName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  activeLbDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },

  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  breakdownCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  breakdownPts: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981", width: 60, textAlign: "right" },

  // Rules
  ruleCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 8 },
  ruleCardInactive: { opacity: 0.6 },
  ruleCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  ruleType: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted },
  ruleStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  ruleStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  editIconBtn: { padding: 4 },
  ruleMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ruleMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  ruleMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  ruleDecLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#7C3AED" },

  // Leaderboards
  lbCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 6 },
  lbCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  lbStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  lbStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  lbName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  lbDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  lbDates: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  lbActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  lbActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: C.background, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  lbActionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.tint },

  // Rankings
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  rankPos: { fontSize: 18, width: 36, textAlign: "center" },
  rankAvatar: { width: 36, height: 36 },
  rankAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  rankAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  rankAvatarInitial: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.tint },
  rankName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  rankActions: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  rankPts: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.tint },

  // Users
  userCard: { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 8 },
  userCardBlocked: { borderColor: "#FECACA", backgroundColor: "#FFF5F5" },
  userCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 36, height: 36, borderRadius: 18 },
  userAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  userAvatarInitial: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.tint },
  userName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  userEmail: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  blockedBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  blockedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#EF4444" },
  userPoints: { alignItems: "center", minWidth: 50 },
  userPtsValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.tint },
  userPtsLabel: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" },
  userActions: { flexDirection: "row", gap: 6 },
  userActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },

  // Adjust
  adjustUserName: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },

  // Events
  eventCard: { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, gap: 4 },
  eventCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventStatusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventUser: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  eventTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  eventCardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventAction: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  eventPts: { fontSize: 13, fontFamily: "Inter_700Bold" },
  eventBlockReason: { fontSize: 11, color: "#EF4444", fontFamily: "Inter_400Regular" },

  // Logs
  logCard: { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, gap: 4 },
  logCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logAction: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  logTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  logAdmin: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  logValues: { fontSize: 11, color: "#7C3AED", fontFamily: "Inter_400Regular" },

  // Form
  modalContainer: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text, flex: 1, textAlign: "center" },
  saveBtn: { backgroundColor: C.tint, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  fieldHint: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  input: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  switchLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  switchDesc: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.background, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: "#EFF6FF", borderColor: C.tint },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  chipTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  radioRowActive: { borderColor: C.tint, backgroundColor: "#EFF6FF" },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.border },
  radioActive: { borderColor: C.tint, backgroundColor: C.tint },
  radioText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.text },

  // Utils
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  emptyState: { alignItems: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#EFF6FF", borderRadius: 12, borderWidth: 1, borderColor: C.tint, borderStyle: "dashed" },
  createBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },
});
