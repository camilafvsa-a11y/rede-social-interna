import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Header helpers ──────────────────────────────────────────────────────────
const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS_HEADER = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}
function getTodayLabel(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS_HEADER[d.getMonth()]}`;
}

// ─── Birthday helpers ────────────────────────────────────────────────────────
const TAG_LABELS_BD: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};
const MONTHS_BD = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_SHORT_BD = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTHS_BD[month - 1]} de ${year}`;
}
function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTHS_SHORT_BD[month - 1]}`;
}
function getAge(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const hadBirthday = today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hadBirthday) age--;
  return age;
}

function BirthdayCard({ item, showFullDate }: { item: any; showFullDate?: boolean }) {
  const tagStyle = (C.tagColors as any)[item.tag] || null;
  const isToday = item.daysUntil === 0;
  const age = item.birthDate ? getAge(item.birthDate) : null;
  return (
    <View style={[styles.bdCard, isToday && styles.bdCardToday]}>
      <View style={styles.bdAvatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.bdAvatar} />
        ) : (
          <View style={[styles.bdAvatarFallback, isToday && styles.bdAvatarFallbackToday]}>
            <Text style={styles.bdAvatarInitial}>{item.name?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        {isToday && <Text style={styles.bdCakeEmoji}>🎂</Text>}
      </View>
      <View style={styles.bdInfo}>
        <Text style={[styles.bdName, isToday && styles.bdNameToday]}>{item.name}</Text>
        <View style={styles.bdMetaRow}>
          {tagStyle && item.tag && (
            <View style={[styles.bdTagBadge, { backgroundColor: tagStyle.bg }]}>
              <Text style={[styles.bdTagText, { color: tagStyle.text }]}>{TAG_LABELS_BD[item.tag]}</Text>
            </View>
          )}
        </View>
        {item.birthDate && (
          <View style={styles.bdDateRow}>
            <Feather name="calendar" size={12} color={isToday ? C.tint : C.textMuted} />
            <Text style={[styles.bdDateText, isToday && { color: C.tint }]}>
              {showFullDate ? formatFullDate(item.birthDate) : formatDayMonth(item.birthDate)}
              {age !== null && !isToday && <Text style={styles.bdAgeSuffix}> · {age} anos</Text>}
              {age !== null && isToday && <Text style={[styles.bdAgeSuffix, { color: C.tint }]}> · {age + 1} anos! 🎉</Text>}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.bdDaysBadge, isToday && styles.bdDaysBadgeToday]}>
        {isToday ? (
          <Text style={styles.bdTodayEmoji}>🎉</Text>
        ) : (
          <>
            <Text style={styles.bdDaysNum}>{item.daysUntil}</Text>
            <Text style={styles.bdDaysLabel}>dias</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type MainTab = "feed" | "interno" | "aniversarios" | "ranking";
type BdSubTab = "today" | "upcoming";

// ─── Gamification Ranking View ────────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  like: "Curtiu", comment: "Comentou",
  doc_read: "Leu documento", doc_sign: "Assinou documento",
  manual_adjustment: "Ajuste manual",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function GamificationView({ currentUserId, botPad }: { currentUserId: number; botPad: number }) {
  const { data: activeLeaderboards = [], isLoading: lbLoading } = useQuery<any[]>({
    queryKey: ["active-leaderboards"],
    queryFn: () => api.get("/gamification/leaderboards"),
    refetchInterval: 60_000,
  });

  const { data: myStats } = useQuery<any>({
    queryKey: ["my-gamif-stats"],
    queryFn: () => api.get("/gamification/my-stats"),
    refetchInterval: 60_000,
  });

  const { data: myHistory = [] } = useQuery<any[]>({
    queryKey: ["my-gamif-history"],
    queryFn: () => api.get("/gamification/my-events?limit=20"),
  });

  const [selectedLbId, setSelectedLbId] = useState<number | null>(null);

  const activeLb = useMemo(() => {
    if (activeLeaderboards.length === 0) return null;
    const lb = selectedLbId
      ? activeLeaderboards.find((l) => l.id === selectedLbId) ?? activeLeaderboards[0]
      : activeLeaderboards[0];
    return lb;
  }, [activeLeaderboards, selectedLbId]);

  const { data: lbRankings = [], isLoading: rankLoading } = useQuery<any[]>({
    queryKey: ["lb-rankings", activeLb?.id],
    queryFn: () => api.get(`/gamification/leaderboards/${activeLb!.id}/rankings`),
    enabled: !!activeLb,
    refetchInterval: 60_000,
  });

  const myRank = useMemo(
    () => lbRankings.find((r) => r.userId === currentUserId) ?? null,
    [lbRankings, currentUserId],
  );

  function fmtDate(s: string) {
    try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return s; }
  }
  function fmtDateTime(s: string) {
    try { return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
  }

  if (lbLoading) {
    return <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 60 }} />;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[gSt.scrollContent, { paddingBottom: botPad }]}
    >
      {/* ── My Stats Card ── */}
      {myStats && (
        <View style={gSt.myStatsCard}>
          <View style={gSt.myStatsHeader}>
            <Feather name="zap" size={16} color="#F59E0B" />
            <Text style={gSt.myStatsTitle}>Minha pontuação</Text>
          </View>
          <View style={gSt.myStatsRow}>
            <View style={gSt.myStatItem}>
              <Text style={gSt.myStatValue}>{myStats.totalPoints ?? 0}</Text>
              <Text style={gSt.myStatLabel}>pontos totais</Text>
            </View>
            <View style={gSt.myStatsDivider} />
            <View style={gSt.myStatItem}>
              <Text style={gSt.myStatValue}>{myStats.todayPoints ?? 0}</Text>
              <Text style={gSt.myStatLabel}>hoje</Text>
            </View>
            <View style={gSt.myStatsDivider} />
            <View style={gSt.myStatItem}>
              <Text style={gSt.myStatValue}>{myStats.todayActions ?? 0}</Text>
              <Text style={gSt.myStatLabel}>ações hoje</Text>
            </View>
            {myRank && (
              <>
                <View style={gSt.myStatsDivider} />
                <View style={gSt.myStatItem}>
                  <Text style={[gSt.myStatValue, { color: C.tint }]}>#{myRank.rank}</Text>
                  <Text style={gSt.myStatLabel}>ranking</Text>
                </View>
              </>
            )}
          </View>
          {myStats.isBlocked && (
            <View style={gSt.blockedWarning}>
              <Feather name="alert-triangle" size={13} color="#EF4444" />
              <Text style={gSt.blockedWarningText}>Sua pontuação está temporariamente suspensa.</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Leaderboard selector ── */}
      {activeLeaderboards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gSt.lbSelector}>
          {activeLeaderboards.map((lb) => (
            <TouchableOpacity
              key={lb.id}
              style={[gSt.lbSelectorChip, (activeLb?.id === lb.id) && gSt.lbSelectorChipActive]}
              onPress={() => setSelectedLbId(lb.id)}
              activeOpacity={0.8}
            >
              <Text style={[gSt.lbSelectorText, (activeLb?.id === lb.id) && gSt.lbSelectorTextActive]} numberOfLines={1}>
                {lb.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Active leaderboard ── */}
      {activeLb ? (
        <>
          <View style={gSt.lbCard}>
            <View style={gSt.lbCardHeader}>
              <Feather name="award" size={16} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={gSt.lbName}>{activeLb.name}</Text>
                {activeLb.description && <Text style={gSt.lbDesc} numberOfLines={2}>{activeLb.description}</Text>}
                <Text style={gSt.lbDates}>
                  {fmtDate(activeLb.startDate)} → {fmtDate(activeLb.endDate)}
                </Text>
              </View>
            </View>

            {rankLoading ? (
              <ActivityIndicator size="small" color={C.tint} style={{ marginVertical: 20 }} />
            ) : lbRankings.length === 0 ? (
              <View style={gSt.rankEmpty}>
                <Text style={gSt.rankEmptyText}>Nenhuma pontuação ainda. Seja o primeiro!</Text>
              </View>
            ) : (
              <View style={gSt.rankList}>
                {/* Top 3 podium */}
                {lbRankings.slice(0, 3).map((r) => (
                  <View
                    key={r.rank}
                    style={[
                      gSt.rankTopRow,
                      r.userId === currentUserId && gSt.rankTopRowMe,
                      r.rank === 1 && { borderLeftColor: "#FFD700" },
                    ]}
                  >
                    <Text style={gSt.rankMedal}>{MEDALS[r.rank - 1]}</Text>
                    <View style={gSt.rankAvatarWrap}>
                      {r.user?.avatarUrl
                        ? <Image source={{ uri: r.user.avatarUrl }} style={gSt.rankAvatar} />
                        : <View style={gSt.rankAvatarFallback}>
                            <Text style={gSt.rankAvatarInitial}>{r.user?.name?.[0]?.toUpperCase()}</Text>
                          </View>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={gSt.rankName} numberOfLines={1}>
                        {r.user?.name ?? "Usuário"}
                        {r.userId === currentUserId && <Text style={gSt.rankMeLabel}> (você)</Text>}
                      </Text>
                      <Text style={gSt.rankActions}>{r.totalActions} ações</Text>
                    </View>
                    <Text style={gSt.rankPts}>{r.totalPoints} pts</Text>
                  </View>
                ))}

                {/* Separator */}
                {lbRankings.length > 3 && <View style={gSt.rankSep} />}

                {/* Rest of ranking */}
                {lbRankings.slice(3).map((r) => (
                  <View
                    key={r.rank}
                    style={[gSt.rankRow, r.userId === currentUserId && gSt.rankRowMe]}
                  >
                    <Text style={gSt.rankPos}>#{r.rank}</Text>
                    <View style={gSt.rankAvatarWrap}>
                      {r.user?.avatarUrl
                        ? <Image source={{ uri: r.user.avatarUrl }} style={gSt.rankAvatar} />
                        : <View style={gSt.rankAvatarFallback}>
                            <Text style={gSt.rankAvatarInitial}>{r.user?.name?.[0]?.toUpperCase()}</Text>
                          </View>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={gSt.rankName} numberOfLines={1}>
                        {r.user?.name ?? "Usuário"}
                        {r.userId === currentUserId && <Text style={gSt.rankMeLabel}> (você)</Text>}
                      </Text>
                      <Text style={gSt.rankActions}>{r.totalActions} ações</Text>
                    </View>
                    <Text style={gSt.rankPts}>{r.totalPoints} pts</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        <View style={gSt.noLbCard}>
          <Feather name="award" size={40} color={C.textMuted} />
          <Text style={gSt.noLbTitle}>Sem competições ativas</Text>
          <Text style={gSt.noLbSub}>Continue interagindo para acumular pontos!</Text>
        </View>
      )}

      {/* ── My action history ── */}
      {myHistory.length > 0 && (
        <View style={gSt.historyCard}>
          <Text style={gSt.historyTitle}>Minhas ações recentes</Text>
          {myHistory.map((ev, i) => (
            <View key={ev.id} style={[gSt.historyRow, i > 0 && gSt.historyRowBorder]}>
              <View style={[gSt.historyDot, { backgroundColor: ev.status === "valid" ? "#10B981" : "#EF4444" }]} />
              <View style={{ flex: 1 }}>
                <Text style={gSt.historyAction}>{ACTION_LABELS[ev.actionType] ?? ev.actionType}</Text>
                {ev.blockReason && <Text style={gSt.historyBlockReason}>{ev.blockReason}</Text>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[gSt.historyPts, { color: ev.pointsAwarded > 0 ? "#10B981" : "#9CA3AF" }]}>
                  {ev.pointsAwarded > 0 ? `+${ev.pointsAwarded}` : "0"} pts
                </Text>
                <Text style={gSt.historyTime}>{fmtDateTime(ev.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Daily tip */}
      <View style={gSt.tipCard}>
        <Feather name="info" size={14} color="#7C3AED" />
        <Text style={gSt.tipText}>
          Ganhe pontos curtindo posts, comentando com qualidade, lendo e assinando documentos do Integra.
        </Text>
      </View>
    </ScrollView>
  );
}

// Gamification styles
const gSt = StyleSheet.create({
  scrollContent: { padding: 14, gap: 14 },

  myStatsCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  myStatsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  myStatsTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text },
  myStatsRow: { flexDirection: "row", alignItems: "center" },
  myStatItem: { flex: 1, alignItems: "center", gap: 2 },
  myStatValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  myStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textMuted, textAlign: "center" },
  myStatsDivider: { width: 1, height: 32, backgroundColor: C.borderLight },
  blockedWarning: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 },
  blockedWarningText: { fontSize: 12, color: "#EF4444", fontFamily: "Inter_400Regular", flex: 1 },

  lbSelector: { paddingHorizontal: 2, paddingBottom: 2, gap: 8, flexDirection: "row" },
  lbSelectorChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  lbSelectorChipActive: { backgroundColor: "#EFF6FF", borderColor: C.tint },
  lbSelectorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  lbSelectorTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },

  lbCard: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  lbCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  lbName: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },
  lbDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  lbDates: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 3 },

  rankEmpty: { alignItems: "center", padding: 30 },
  rankEmptyText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  rankList: { gap: 0 },
  rankSep: { height: 1, backgroundColor: C.borderLight, marginVertical: 4, marginHorizontal: 14 },

  rankTopRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderLeftWidth: 3, borderLeftColor: "transparent",
  },
  rankTopRowMe: { backgroundColor: "#EFF6FF" },
  rankMedal: { fontSize: 20, width: 28, textAlign: "center" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  rankRowMe: { backgroundColor: "#EFF6FF" },
  rankPos: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.textMuted, width: 28, textAlign: "center" },
  rankAvatarWrap: { width: 36, height: 36 },
  rankAvatar: { width: 36, height: 36, borderRadius: 18 },
  rankAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" },
  rankAvatarInitial: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.tint },
  rankName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  rankMeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.tint },
  rankActions: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  rankPts: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.tint },

  noLbCard: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    alignItems: "center", padding: 40, gap: 10,
  },
  noLbTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  noLbSub: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  historyCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  historyTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.text, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  historyRowBorder: { borderTopWidth: 1, borderTopColor: C.borderLight },
  historyDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  historyAction: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  historyBlockReason: { fontSize: 11, color: "#EF4444", fontFamily: "Inter_400Regular", marginTop: 2 },
  historyPts: { fontSize: 13, fontFamily: "Inter_700Bold" },
  historyTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },

  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F5F3FF", borderRadius: 12, padding: 12 },
  tipText: { flex: 1, fontSize: 12, color: "#5B21B6", fontFamily: "Inter_400Regular", lineHeight: 18 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount, dmUnreadCount, refreshUnread } = useNotifications();
  const [mainTab, setMainTab] = useState<MainTab>("feed");

  // Per-tab channel filters
  const [feedChannelId, setFeedChannelId] = useState<number | null>(null);
  const [internoChannelId, setInternoChannelId] = useState<number | null>(null);

  // Birthday sub-tab
  const [bdSubTab, setBdSubTab] = useState<BdSubTab>("today");
  const [bdRefreshing, setBdRefreshing] = useState(false);

  // Birthday banner dismissal (per-day)
  const todayKey = new Date().toDateString();
  const [bdBannerDismissedOn, setBdBannerDismissedOn] = useState<string | null>(null);
  const bdBannerDismissed = bdBannerDismissedOn === todayKey;

  // Refresh states
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [internoRefreshing, setInternoRefreshing] = useState(false);

  // ── Channels ──
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: unreadChannelData } = useQuery<{ unreadIds: number[] }>({
    queryKey: ["channels-unread"],
    queryFn: () => api.get("/channels/unread-ids"),
    refetchInterval: 30_000,
  });
  const unreadChannelIds = new Set(unreadChannelData?.unreadIds ?? []);

  function markChannelRead(channelId: number) {
    api.post(`/channels/${channelId}/read`, {}).then(() => {
      refreshUnread();
    }).catch(() => {});
  }

  const regularChannels = useMemo(
    () => channels.filter((c: any) => !c.isInternalComm),
    [channels]
  );
  const internalChannels = useMemo(
    () => channels.filter((c: any) => c.isInternalComm),
    [channels]
  );
  const internalIds = useMemo(
    () => new Set(internalChannels.map((c: any) => c.id)),
    [internalChannels]
  );

  // ── Feed posts ──
  const { data: feedData, isLoading: feedLoading, refetch: feedRefetch } = useQuery({
    queryKey: ["feed", feedChannelId],
    queryFn: () =>
      api.get(feedChannelId ? `/posts?channelId=${feedChannelId}&limit=40` : "/posts?limit=60"),
  });
  const feedPosts = useMemo(() => {
    const all = feedData?.posts || [];
    return feedChannelId ? all : all.filter((p: any) => !internalIds.has(p.channelId));
  }, [feedData, feedChannelId, internalIds]);

  // ── Interno posts ──
  const { data: internoData, isLoading: internoLoading, refetch: internoRefetch } = useQuery({
    queryKey: ["interno", internoChannelId],
    queryFn: () =>
      api.get(internoChannelId ? `/posts?channelId=${internoChannelId}&limit=40` : "/posts?limit=60"),
    enabled: mainTab === "interno",
  });
  const internoPosts = useMemo(() => {
    const all = internoData?.posts || [];
    return internoChannelId ? all : all.filter((p: any) => internalIds.has(p.channelId));
  }, [internoData, internoChannelId, internalIds]);

  // ── Birthdays ──
  const { data: birthdaysTodayData = [] } = useQuery<any[]>({
    queryKey: ["birthdays-today"],
    queryFn: () => api.get("/birthdays?days=1"),
    staleTime: 10 * 60 * 1000,
  });
  const todayBirthdays = (birthdaysTodayData as any[]).filter((b: any) => b.daysUntil === 0);

  const { data: birthdaysAll = [], isLoading: bdLoading, refetch: bdRefetch } = useQuery<any[]>({
    queryKey: ["birthdays-all"],
    queryFn: () => api.get("/birthdays?days=90"),
    enabled: mainTab === "aniversarios",
  });
  const bdTodayList = birthdaysAll.filter((b: any) => b.daysUntil === 0);
  const bdUpcomingList = birthdaysAll.filter((b: any) => b.daysUntil > 0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  // ── Shared channel filter bar renderer ──
  function ChannelFilterBar({
    chList,
    selected,
    onSelect,
  }: { chList: any[]; selected: number | null; onSelect: (id: number | null) => void }) {
    return (
      <View style={styles.channelBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelBarContent}>
          <TouchableOpacity
            style={[styles.channelPill, selected === null && styles.channelPillActive]}
            onPress={() => onSelect(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.channelPillText, selected === null && styles.channelPillTextActive]}>Todos</Text>
          </TouchableOpacity>
          {chList.map((ch: any) => {
            const active = selected === ch.id;
            const chColor = ch.color || C.tint;
            const hasUnread = unreadChannelIds.has(ch.id);
            return (
              <TouchableOpacity
                key={ch.id}
                style={[
                  styles.channelPill,
                  active
                    ? { backgroundColor: chColor, borderColor: chColor }
                    : ch.color
                    ? { borderColor: ch.color, borderWidth: 1.5 }
                    : null,
                ]}
                onPress={() => {
                  const nextId = active ? null : ch.id;
                  onSelect(nextId);
                  if (!active && hasUnread) markChannelRead(ch.id);
                }}
                activeOpacity={0.8}
              >
                {/* Color dot for inactive colored pills */}
                {!active && ch.color && (
                  <View style={[styles.chPillDot, { backgroundColor: ch.color }]} />
                )}
                {ch.isInternalComm && (
                  <Feather name="shield" size={11} color={active ? "#fff" : chColor} style={{ marginRight: 3 }} />
                )}
                <Text style={[styles.channelPillText, active && styles.channelPillTextActive, !active && ch.color && { color: ch.color }]}>
                  {ch.name}
                </Text>
                {/* Unread dot */}
                {hasUnread && !active && (
                  <View style={styles.chUnreadDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Posts list renderer (shared between feed & interno) ──
  function PostsList({
    posts,
    loading,
    refreshing,
    onRefresh,
    channelId,
    channelList,
    onSelectChannel,
    isFeed,
  }: {
    posts: any[];
    loading: boolean;
    refreshing: boolean;
    onRefresh: () => void;
    channelId: number | null;
    channelList: any[];
    onSelectChannel: (id: number | null) => void;
    isFeed: boolean;
  }) {
    const selectedChName = channelList.find((c: any) => c.id === channelId)?.name;
    const ListHeader = (
      <View>
        {isFeed && (
          <TouchableOpacity
            style={styles.createBox}
            onPress={() => router.push("/channel/create-post")}
            activeOpacity={0.85}
          >
            <View style={styles.createAvatar}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.createAvatarImg} />
              ) : (
                <Text style={styles.createAvatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.createInputFake}>
              <Text style={styles.createPlaceholder}>O que você está pensando?</Text>
            </View>
            <View style={styles.createImageBtn}>
              <Feather name="image" size={18} color={C.tint} />
            </View>
          </TouchableOpacity>
        )}
        {channelId && selectedChName && (
          <View style={styles.filterBanner}>
            <Feather name="filter" size={13} color={C.tint} />
            <Text style={styles.filterBannerText}>
              Filtrando por: <Text style={{ fontFamily: "Inter_700Bold" }}>#{selectedChName}</Text>
            </Text>
            <TouchableOpacity onPress={() => onSelectChannel(null)}>
              <Feather name="x" size={14} color={C.tint} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );

    return (
      <FlatList
        data={posts}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard post={item} onLikeChange={isFeed ? feedRefetch : internoRefetch} onDelete={isFeed ? feedRefetch : internoRefetch} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} colors={[C.tint]} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name={isFeed ? "inbox" : "shield-off"} size={36} color={C.tint} />
              </View>
              <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
              <Text style={styles.emptySubText}>
                {channelId ? "Nenhum post neste canal." : isFeed ? "Seja o primeiro a publicar algo!" : "Sem comunicados no momento."}
              </Text>
              {isFeed && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/channel/create-post")} activeOpacity={0.8}>
                  <Feather name="edit-3" size={15} color="#fff" />
                  <Text style={styles.emptyBtnText}>Criar publicação</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Avatar (→ profile) */}
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Feather name="user" size={22} color="#9CA3AF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Greeting block */}
        <View style={styles.headerGreetingBlock}>
          <Text style={styles.headerGreeting} numberOfLines={1}>
            {getGreeting()}, <Text style={styles.headerGreetingName}>{user?.name?.split(" ")[0]}!</Text>
          </Text>
          <Text style={styles.headerDate} numberOfLines={1}>{getTodayLabel()}</Text>
        </View>

        {/* Header right icons */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* DM icon */}
          <TouchableOpacity
            onPress={() => router.push("/messages" as any)}
            style={styles.bellBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="send" size={20} color={C.text} />
            {dmUnreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{dmUnreadCount > 99 ? "99+" : dmUnreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bell icon */}
          <TouchableOpacity
            onPress={() => router.push("/notifications" as any)}
            style={styles.bellBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={22} color={C.text} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Main 3-tab bar ── */}
      <View style={styles.mainTabBar}>
        {/* Feed tab */}
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "feed" && styles.mainTabActive]}
          onPress={() => setMainTab("feed")}
          activeOpacity={0.8}
        >
          <Feather name="home" size={14} color={mainTab === "feed" ? C.tint : C.textMuted} />
          <Text style={[styles.mainTabText, mainTab === "feed" && styles.mainTabTextActive]}>Feed</Text>
          {mainTab === "feed" && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>

        {/* Comunicação Interna tab */}
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "interno" && styles.mainTabActive]}
          onPress={() => setMainTab("interno")}
          activeOpacity={0.8}
        >
          <Feather name="shield" size={14} color={mainTab === "interno" ? C.tint : C.textMuted} />
          <Text style={[styles.mainTabText, mainTab === "interno" && styles.mainTabTextActive]}>Comunicação</Text>
          {mainTab === "interno" && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>

        {/* Aniversários tab */}
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "aniversarios" && styles.mainTabActive]}
          onPress={() => setMainTab("aniversarios")}
          activeOpacity={0.8}
        >
          <Text style={styles.mainTabEmoji}>🎂</Text>
          <Text style={[styles.mainTabText, mainTab === "aniversarios" && styles.mainTabTextActive]}>Aniversários</Text>
          {bdTodayList.length > 0 && mainTab !== "aniversarios" && (
            <View style={styles.mainTabBadge}>
              <Text style={styles.mainTabBadgeText}>{bdTodayList.length}</Text>
            </View>
          )}
          {mainTab === "aniversarios" && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>

        {/* Ranking tab */}
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "ranking" && styles.mainTabActive]}
          onPress={() => setMainTab("ranking")}
          activeOpacity={0.8}
        >
          <Text style={styles.mainTabEmoji}>🏆</Text>
          <Text style={[styles.mainTabText, mainTab === "ranking" && styles.mainTabTextActive]}>Ranking</Text>
          {mainTab === "ranking" && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* ══ FEED TAB ══ */}
      {mainTab === "feed" && (
        <>
          {/* Birthday notification banner */}
          {todayBirthdays.length > 0 && !bdBannerDismissed && (
            <TouchableOpacity
              style={styles.birthdayBanner}
              onPress={() => setMainTab("aniversarios")}
              activeOpacity={0.88}
            >
              <Text style={styles.birthdayBannerEmoji}>🎂</Text>
              <Text style={styles.birthdayBannerText} numberOfLines={1}>
                {todayBirthdays.length === 1
                  ? `${todayBirthdays[0].name} faz aniversário hoje!`
                  : `${todayBirthdays.slice(0, 2).map((b: any) => b.name.split(" ")[0]).join(" e ")}${todayBirthdays.length > 2 ? ` +${todayBirthdays.length - 2}` : ""} fazem aniversário hoje!`}
              </Text>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); setBdBannerDismissedOn(todayKey); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={15} color="#166534" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          <ChannelFilterBar chList={regularChannels} selected={feedChannelId} onSelect={setFeedChannelId} />
          {/* Channel cover banner */}
          {feedChannelId && (() => {
            const ch = regularChannels.find((c: any) => c.id === feedChannelId);
            return ch?.coverImageUrl ? (
              <View style={styles.coverBanner}>
                <Image source={{ uri: ch.coverImageUrl }} style={styles.coverBannerImg} resizeMode="cover" />
                <View style={styles.coverBannerOverlay}>
                  <Text style={styles.coverBannerName}>{ch.name}</Text>
                  {ch.description ? <Text style={styles.coverBannerDesc}>{ch.description}</Text> : null}
                </View>
              </View>
            ) : null;
          })()}
          <PostsList
            posts={feedPosts}
            loading={feedLoading}
            refreshing={feedRefreshing}
            onRefresh={async () => { setFeedRefreshing(true); await feedRefetch(); setFeedRefreshing(false); }}
            channelId={feedChannelId}
            channelList={regularChannels}
            onSelectChannel={setFeedChannelId}
            isFeed={true}
          />
          {feedLoading && !feedRefreshing && (
            <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>
          )}
        </>
      )}

      {/* ══ COMUNICAÇÃO INTERNA TAB ══ */}
      {mainTab === "interno" && (
        <>
          {/* Internal comms header card */}
          <View style={styles.internoHeader}>
            <View style={styles.internoHeaderIcon}>
              <Feather name="shield" size={20} color={C.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.internoHeaderTitle}>Comunicação Interna</Text>
              <Text style={styles.internoHeaderSub}>Comunicados e avisos oficiais da empresa</Text>
            </View>
          </View>
          <PostsList
            posts={internoPosts}
            loading={internoLoading}
            refreshing={internoRefreshing}
            onRefresh={async () => { setInternoRefreshing(true); await internoRefetch(); setInternoRefreshing(false); }}
            channelId={null}
            channelList={internalChannels}
            onSelectChannel={setInternoChannelId}
            isFeed={false}
          />
          {internoLoading && !internoRefreshing && (
            <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>
          )}
        </>
      )}

      {/* ══ ANIVERSÁRIOS TAB ══ */}
      {mainTab === "aniversarios" && (
        <>
          <View style={styles.bdTabBar}>
            <TouchableOpacity
              style={[styles.bdTab, bdSubTab === "today" && styles.bdTabActive]}
              onPress={() => setBdSubTab("today")}
              activeOpacity={0.8}
            >
              <Text style={[styles.bdTabText, bdSubTab === "today" && styles.bdTabTextActive]}>
                🎂 Hoje{bdTodayList.length > 0 && (
                  <Text style={[styles.bdTabCount, bdSubTab === "today" && styles.bdTabCountActive]}>
                    {"  "}{bdTodayList.length}
                  </Text>
                )}
              </Text>
              {bdSubTab === "today" && <View style={styles.bdTabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bdTab, bdSubTab === "upcoming" && styles.bdTabActive]}
              onPress={() => setBdSubTab("upcoming")}
              activeOpacity={0.8}
            >
              <Text style={[styles.bdTabText, bdSubTab === "upcoming" && styles.bdTabTextActive]}>
                📅 Próximos{bdUpcomingList.length > 0 && (
                  <Text style={[styles.bdTabCount, bdSubTab === "upcoming" && styles.bdTabCountActive]}>
                    {"  "}{bdUpcomingList.length}
                  </Text>
                )}
              </Text>
              {bdSubTab === "upcoming" && <View style={styles.bdTabIndicator} />}
            </TouchableOpacity>
          </View>

          {bdSubTab === "today" && bdTodayList.length > 0 && (
            <View style={styles.bdTodayBanner}>
              <Text style={styles.bdTodayBannerEmoji}>🎊</Text>
              <Text style={styles.bdTodayBannerText}>
                {bdTodayList.length === 1
                  ? `${bdTodayList[0].name} faz aniversário hoje!`
                  : `${bdTodayList.length} colaboradores fazem aniversário hoje!`}
              </Text>
            </View>
          )}

          <FlatList
            data={bdSubTab === "today" ? bdTodayList : bdUpcomingList}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }) => <BirthdayCard item={item} showFullDate={bdSubTab === "today"} />}
            refreshControl={
              <RefreshControl
                refreshing={bdRefreshing}
                onRefresh={async () => { setBdRefreshing(true); await bdRefetch(); setBdRefreshing(false); }}
                tintColor={C.tint}
                colors={[C.tint]}
              />
            }
            contentContainerStyle={[styles.bdListContent, { paddingBottom: botPad }]}
            ListEmptyComponent={
              !bdLoading ? (
                <View style={styles.empty}>
                  <Text style={styles.bdEmptyEmoji}>{bdSubTab === "today" ? "🎂" : "📅"}</Text>
                  <Text style={styles.emptyText}>
                    {bdSubTab === "today" ? "Nenhum aniversariante hoje" : "Nenhum aniversário nos próximos 90 dias"}
                  </Text>
                  {bdSubTab === "today" && (
                    <Text style={styles.emptySubText}>Cheque os próximos na aba ao lado</Text>
                  )}
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
          {bdLoading && (
            <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>
          )}
        </>
      )}

      {/* ══ RANKING TAB ══ */}
      {mainTab === "ranking" && user && (
        <GamificationView currentUserId={user.id} botPad={botPad} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.tint },
  headerAvatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  headerAvatarInitial: { color: "#1E3A8A", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerGreetingBlock: { flex: 1 },
  headerGreeting: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  headerGreetingName: { fontFamily: "Inter_700Bold", color: C.text, fontSize: 14 },
  headerDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  bellBtn: { position: "relative", width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute", top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3, borderColor: C.surface,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  /* Main 3-tab bar */
  mainTabBar: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  mainTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 11, position: "relative",
  },
  mainTabActive: {},
  mainTabEmoji: { fontSize: 14 },
  mainTabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  mainTabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  mainTabIndicator: {
    position: "absolute", bottom: 0, left: "10%", right: "10%",
    height: 3, backgroundColor: C.tint, borderRadius: 3,
  },
  mainTabBadge: {
    backgroundColor: "#EF4444", borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, marginLeft: 1,
  },
  mainTabBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },

  /* Channel cover banner */
  coverBanner: { position: "relative", height: 130, overflow: "hidden" },
  coverBannerImg: { width: "100%", height: "100%" },
  coverBannerOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16, paddingVertical: 10,
  },
  coverBannerName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  coverBannerDesc: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 2 },

  /* Birthday notification banner */
  birthdayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4", paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#BBF7D0",
  },
  birthdayBannerEmoji: { fontSize: 18 },
  birthdayBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#166534" },

  /* Interno header card */
  internoHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#BFDBFE",
  },
  internoHeaderIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center",
  },
  internoHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  internoHeaderSub: { fontSize: 12, color: "#3B82F6", fontFamily: "Inter_400Regular", marginTop: 1 },

  /* Channel filter bar */
  channelBarWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  channelBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  channelPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.surfaceAlt, borderColor: C.border,
  },
  channelPillActive: { backgroundColor: C.tint, borderColor: C.tint },
  channelPillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  channelPillTextActive: { color: "#fff" },
  chPillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  chUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444", marginLeft: 4 },

  /* Create post */
  createBox: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface,
    marginHorizontal: 14, marginTop: 12, marginBottom: 4, padding: 12, borderRadius: 16,
    borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  createAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  createAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  createAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  createInputFake: {
    flex: 1, backgroundColor: C.inputBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, borderColor: C.borderLight,
  },
  createPlaceholder: { color: C.placeholder, fontFamily: "Inter_400Regular", fontSize: 14 },
  createImageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },
  filterBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 14, marginBottom: 4, marginTop: 2,
    backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  filterBannerText: { flex: 1, fontSize: 12, color: C.tint, fontFamily: "Inter_400Regular" },

  listContent: { paddingTop: 4 },

  /* Birthday sub-tab bar */
  bdTabBar: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  bdTab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, position: "relative",
  },
  bdTabActive: {},
  bdTabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary },
  bdTabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  bdTabCount: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textMuted },
  bdTabCountActive: { color: C.tint },
  bdTabIndicator: {
    position: "absolute", bottom: 0, left: "10%", right: "10%",
    height: 3, backgroundColor: C.tint, borderRadius: 3,
  },

  /* Today celebration banner */
  bdTodayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4", marginHorizontal: 14, marginTop: 10, marginBottom: 2,
    borderRadius: 12, padding: 12, borderColor: "#bbf7d0",
  },
  bdTodayBannerEmoji: { fontSize: 22 },
  bdTodayBannerText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#166534" },

  bdListContent: { paddingTop: 10, paddingHorizontal: 14, gap: 8 },

  /* Birthday cards */
  bdCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    borderColor: C.borderLight,
  },
  bdCardToday: { borderColor: C.tint, backgroundColor: "#f0fdf4" },
  bdAvatarWrap: { position: "relative" },
  bdAvatar: { width: 52, height: 52, borderRadius: 26 },
  bdAvatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  bdAvatarFallbackToday: { backgroundColor: "#059669" },
  bdAvatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20 },
  bdCakeEmoji: { position: "absolute", bottom: -4, right: -4, fontSize: 18 },
  bdInfo: { flex: 1, gap: 3 },
  bdName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  bdNameToday: { color: "#166534" },
  bdMetaRow: { flexDirection: "row", gap: 6 },
  bdTagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  bdTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bdDateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  bdDateText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  bdAgeSuffix: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  bdDaysBadge: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minWidth: 52,
  },
  bdDaysBadgeToday: { backgroundColor: "#dcfce7" },
  bdTodayEmoji: { fontSize: 22 },
  bdDaysNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  bdDaysLabel: { fontSize: 10, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  /* Empty state */
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySubText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.tint, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginTop: 4,
  },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  bdEmptyEmoji: { fontSize: 48 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
