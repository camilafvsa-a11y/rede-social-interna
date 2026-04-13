import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, FlatList, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;
const WEB_TOP = 67;
const WEB_BOT = 118;

const MEDALS = ["🥇", "🥈", "🥉"];
const ACTION_LABELS: Record<string, string> = {
  like: "Curtiu",
  comment: "Comentou",
  doc_read: "Leu documento",
  doc_sign: "Assinou documento",
  manual_adjustment: "Ajuste manual",
};
const LB_STATUS_COLORS: Record<string, string> = {
  active: "#10B981", paused: "#F59E0B", ended: "#3B82F6",
};

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); } catch { return s; }
}
function fmtDateTime(s: string) {
  try { return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
}

export default function RankingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? WEB_TOP : insets.top;
  const botPad = Platform.OS === "web" ? WEB_BOT : insets.bottom + 60;

  const [selectedLbId, setSelectedLbId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Active leaderboards
  const { data: leaderboards = [], isLoading: lbLoading, refetch: lbRefetch } = useQuery<any[]>({
    queryKey: ["active-leaderboards"],
    queryFn: () => api.get("/gamification/leaderboards"),
    refetchInterval: 60_000,
  });

  // My stats
  const { data: myStats, refetch: statsRefetch } = useQuery<any>({
    queryKey: ["my-gamif-stats"],
    queryFn: () => api.get("/gamification/my-stats"),
    refetchInterval: 60_000,
  });

  // My history
  const { data: myHistory = [], refetch: histRefetch } = useQuery<any[]>({
    queryKey: ["my-gamif-history"],
    queryFn: () => api.get("/gamification/my-events?limit=15"),
  });

  const activeLb = useMemo(() => {
    if (leaderboards.length === 0) return null;
    return selectedLbId
      ? leaderboards.find((l) => l.id === selectedLbId) ?? leaderboards[0]
      : leaderboards[0];
  }, [leaderboards, selectedLbId]);

  // Rankings for selected leaderboard
  const { data: rankings = [], isLoading: rankLoading, refetch: rankRefetch } = useQuery<any[]>({
    queryKey: ["lb-rankings", activeLb?.id],
    queryFn: () => api.get(`/gamification/leaderboards/${activeLb!.id}/rankings`),
    enabled: !!activeLb,
    refetchInterval: 60_000,
  });

  const myRank = useMemo(
    () => rankings.find((r) => r.userId === user?.id) ?? null,
    [rankings, user?.id],
  );

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([lbRefetch(), statsRefetch(), histRefetch(), rankRefetch()]);
    setRefreshing(false);
  }

  return (
    <View style={[st.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Text style={st.headerTitle}>🏆 Ranking</Text>
          <Text style={st.headerSub}>Pontuação dos colaboradores</Text>
        </View>
        {myRank && (
          <View style={st.myRankBadge}>
            <Text style={st.myRankBadgeLabel}>Minha posição</Text>
            <Text style={st.myRankBadgePos}>#{myRank.rank}</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[st.scroll, { paddingBottom: botPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.tint} colors={[C.tint]} />
        }
      >
        {/* ── My Stats ── */}
        {myStats && (
          <View style={st.statsCard}>
            <View style={st.statsCardHeader}>
              <Feather name="zap" size={15} color="#F59E0B" />
              <Text style={st.statsCardTitle}>Minha pontuação</Text>
            </View>
            <View style={st.statsRow}>
              <View style={st.statItem}>
                <Text style={st.statVal}>{myStats.totalPoints ?? 0}</Text>
                <Text style={st.statLbl}>pontos totais</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <Text style={[st.statVal, { color: "#10B981" }]}>{myStats.todayPoints ?? 0}</Text>
                <Text style={st.statLbl}>hoje</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <Text style={[st.statVal, { color: "#7C3AED" }]}>{myStats.todayActions ?? 0}</Text>
                <Text style={st.statLbl}>ações hoje</Text>
              </View>
            </View>
            {myStats.isBlocked && (
              <View style={st.blockedBanner}>
                <Feather name="alert-triangle" size={13} color="#EF4444" />
                <Text style={st.blockedText}>Sua pontuação está temporariamente suspensa.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Leaderboard selector ── */}
        {leaderboards.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.lbSelector}>
            {leaderboards.map((lb) => (
              <TouchableOpacity
                key={lb.id}
                style={[st.lbChip, activeLb?.id === lb.id && st.lbChipActive]}
                onPress={() => setSelectedLbId(lb.id)}
                activeOpacity={0.8}
              >
                <Text style={[st.lbChipText, activeLb?.id === lb.id && st.lbChipTextActive]} numberOfLines={1}>
                  {lb.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Leaderboard Card ── */}
        {lbLoading ? (
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
        ) : activeLb ? (
          <View style={st.lbCard}>
            {/* Competition info */}
            <View style={st.lbInfo}>
              <View style={[st.lbStatusDot, { backgroundColor: LB_STATUS_COLORS[activeLb.status] ?? "#9CA3AF" }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.lbName}>{activeLb.name}</Text>
                {activeLb.description ? (
                  <Text style={st.lbDesc} numberOfLines={2}>{activeLb.description}</Text>
                ) : null}
                <Text style={st.lbDates}>
                  <Feather name="calendar" size={11} color={C.textMuted} />
                  {" "}{fmtDate(activeLb.startDate)} → {fmtDate(activeLb.endDate)}
                </Text>
              </View>
            </View>

            {rankLoading ? (
              <ActivityIndicator size="small" color={C.tint} style={{ marginVertical: 24 }} />
            ) : rankings.length === 0 ? (
              <View style={st.empty}>
                <Text style={st.emptyEmoji}>🏆</Text>
                <Text style={st.emptyTitle}>Seja o primeiro!</Text>
                <Text style={st.emptySub}>Curta posts, comente e leia documentos para pontuar.</Text>
              </View>
            ) : (
              <>
                {/* Top 3 Podium */}
                <View style={st.podiumSection}>
                  <Text style={st.sectionLabel}>PÓDIO</Text>
                  {rankings.slice(0, 3).map((r, idx) => (
                    <View key={r.rank} style={[
                      st.podiumRow,
                      r.userId === user?.id && st.podiumRowMe,
                      idx === 0 && { borderLeftWidth: 3, borderLeftColor: "#FFD700" },
                      idx === 1 && { borderLeftWidth: 3, borderLeftColor: "#C0C0C0" },
                      idx === 2 && { borderLeftWidth: 3, borderLeftColor: "#CD7F32" },
                    ]}>
                      <Text style={st.medal}>{MEDALS[idx]}</Text>
                      <View style={st.avatar}>
                        {r.user?.avatarUrl
                          ? <Image source={{ uri: r.user.avatarUrl }} style={st.avatarImg} />
                          : <View style={st.avatarFallback}>
                              <Text style={st.avatarInitial}>{r.user?.name?.[0]?.toUpperCase()}</Text>
                            </View>
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.podiumName} numberOfLines={1}>
                          {r.user?.name ?? "Usuário"}
                          {r.userId === user?.id && <Text style={st.meLabel}> (você)</Text>}
                        </Text>
                        <Text style={st.podiumActions}>{r.totalActions} ação{r.totalActions !== 1 ? "ões" : ""} válida{r.totalActions !== 1 ? "s" : ""}</Text>
                      </View>
                      <View style={[st.ptsBadge, idx === 0 && { backgroundColor: "#FFFBEB" }]}>
                        <Text style={[st.ptsVal, idx === 0 && { color: "#D97706" }]}>{r.totalPoints}</Text>
                        <Text style={st.ptsLbl}>pts</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Rest of ranking */}
                {rankings.length > 3 && (
                  <View style={st.restSection}>
                    <Text style={st.sectionLabel}>DEMAIS COLOCADOS</Text>
                    {rankings.slice(3).map((r) => (
                      <View key={r.rank} style={[st.restRow, r.userId === user?.id && st.podiumRowMe]}>
                        <Text style={st.restPos}>#{r.rank}</Text>
                        <View style={st.avatar}>
                          {r.user?.avatarUrl
                            ? <Image source={{ uri: r.user.avatarUrl }} style={st.avatarImg} />
                            : <View style={st.avatarFallback}>
                                <Text style={st.avatarInitial}>{r.user?.name?.[0]?.toUpperCase()}</Text>
                              </View>
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.restName} numberOfLines={1}>
                            {r.user?.name ?? "Usuário"}
                            {r.userId === user?.id && <Text style={st.meLabel}> (você)</Text>}
                          </Text>
                          <Text style={st.podiumActions}>{r.totalActions} ações válidas</Text>
                        </View>
                        <Text style={st.restPts}>{r.totalPoints} pts</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={st.noLb}>
            <Text style={st.noLbEmoji}>🏆</Text>
            <Text style={st.noLbTitle}>Sem competições ativas</Text>
            <Text style={st.noLbSub}>
              Continue interagindo! Curta posts, comente com qualidade e leia documentos para acumular pontos quando uma competição for criada.
            </Text>
          </View>
        )}

        {/* ── How to earn ── */}
        <View style={st.howCard}>
          <Text style={st.howTitle}>Como ganhar pontos</Text>
          <View style={st.howList}>
            {[
              { icon: "heart", label: "Curtir um post", pts: 5, color: "#EF4444" },
              { icon: "message-square", label: "Comentar (mín. 15 chars)", pts: 10, color: "#7C3AED" },
              { icon: "book-open", label: "Ler documento do Integra", pts: 15, color: "#2563EB" },
              { icon: "file-text", label: "Assinar documento", pts: 20, color: "#10B981" },
            ].map((item, i) => (
              <View key={i} style={st.howRow}>
                <View style={[st.howIcon, { backgroundColor: `${item.color}18` }]}>
                  <Feather name={item.icon as any} size={15} color={item.color} />
                </View>
                <Text style={st.howLabel}>{item.label}</Text>
                <Text style={[st.howPts, { color: item.color }]}>+{item.pts} pts</Text>
              </View>
            ))}
          </View>
          <Text style={st.howNote}>
            * Limites diários aplicados. Comentários com menos de 15 caracteres não pontuam.
          </Text>
        </View>

        {/* ── My recent actions ── */}
        {myHistory.length > 0 && (
          <View style={st.histCard}>
            <Text style={st.histTitle}>Minhas ações recentes</Text>
            {myHistory.map((ev, i) => (
              <View key={ev.id} style={[st.histRow, i > 0 && st.histRowBorder]}>
                <View style={[st.histDot, { backgroundColor: ev.status === "valid" ? "#10B981" : "#EF4444" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.histAction}>{ACTION_LABELS[ev.actionType] ?? ev.actionType}</Text>
                  {ev.blockReason && <Text style={st.histBlocked}>{ev.blockReason}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[st.histPts, { color: ev.pointsAwarded > 0 ? "#10B981" : "#9CA3AF" }]}>
                    {ev.pointsAwarded > 0 ? `+${ev.pointsAwarded}` : "0"} pts
                  </Text>
                  <Text style={st.histTime}>{fmtDateTime(ev.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 14, gap: 14 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  headerSub: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  myRankBadge: {
    alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#BFDBFE",
  },
  myRankBadgeLabel: { fontSize: 10, color: C.tint, fontFamily: "Inter_500Medium" },
  myRankBadgePos: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.tint },

  statsCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statsCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  statsCardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { fontSize: 24, fontFamily: "Inter_700Bold", color: C.text },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" },
  statDivider: { width: 1, height: 36, backgroundColor: C.borderLight },
  blockedBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 },
  blockedText: { fontSize: 12, color: "#EF4444", fontFamily: "Inter_400Regular", flex: 1 },

  lbSelector: { paddingVertical: 2, gap: 8, flexDirection: "row" },
  lbChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  lbChipActive: { backgroundColor: "#EFF6FF", borderColor: C.tint },
  lbChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  lbChipTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },

  lbCard: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  lbInfo: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  lbStatusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  lbName: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  lbDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  lbDates: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 4 },

  sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.textMuted, letterSpacing: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },

  podiumSection: { paddingBottom: 4 },
  podiumRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  podiumRowMe: { backgroundColor: "#EFF6FF" },
  medal: { fontSize: 22, width: 30, textAlign: "center" },
  avatar: { width: 38, height: 38 },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  avatarInitial: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.tint },
  podiumName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  podiumActions: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  meLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.tint },
  ptsBadge: { alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  ptsVal: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.tint },
  ptsLbl: { fontSize: 9, fontFamily: "Inter_400Regular", color: C.textMuted },

  restSection: {},
  restRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  restPos: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.textMuted, width: 30, textAlign: "center" },
  restName: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  restPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.tint },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: "center", fontFamily: "Inter_400Regular", paddingHorizontal: 20 },

  noLb: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    alignItems: "center", padding: 32, gap: 10,
  },
  noLbEmoji: { fontSize: 48, marginBottom: 4 },
  noLbTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  noLbSub: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  howCard: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12,
  },
  howTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  howList: { gap: 10 },
  howRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  howIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  howLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  howPts: { fontSize: 14, fontFamily: "Inter_700Bold" },
  howNote: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", lineHeight: 16 },

  histCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  histTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  histRowBorder: { borderTopWidth: 1, borderTopColor: C.borderLight },
  histDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  histAction: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  histBlocked: { fontSize: 11, color: "#EF4444", fontFamily: "Inter_400Regular", marginTop: 2 },
  histPts: { fontSize: 13, fontFamily: "Inter_700Bold" },
  histTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
});
