import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, ScrollView, Image, Platform,
  TextInput, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Birthday helpers ─────────────────────────────────────────────────────────
const TAG_LABELS_BD: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};
const MONTHS_BD = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ─── BirthdaysTab — calendário inline + lista ────────────────────────────────
function BirthdaysTab({ allBirthdays, loading, refreshing, onRefresh, botPad }: {
  allBirthdays: any[]; loading: boolean; refreshing: boolean;
  onRefresh: () => void; botPad: number;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selDay, setSelDay] = useState(today.getDate());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDOW = new Date(year, month, 1).getDay();
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();
  const isSelToday = isCurrentMonth && selDay === today.getDate();

  function bdForDay(d: number, m: number) {
    return allBirthdays.filter((b: any) => {
      if (!b.birthDate) return false;
      const parts = b.birthDate.split("-");
      return parseInt(parts[1]) === m + 1 && parseInt(parts[2]) === d;
    });
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    setSelDay(1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    setSelDay(1);
  }
  function goToToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth()); setSelDay(today.getDate());
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDOW; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedBDs = bdForDay(selDay, month);
  const selLabel = isSelToday
    ? "🎉 Hoje"
    : `${selDay} de ${MONTHS_BD[month]}${year !== today.getFullYear() ? " de " + year : ""}`;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[bd.scrollContent, { paddingBottom: botPad }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} colors={[C.tint]} />}
    >
      {/* Page header */}
      <View style={bd.pageHeader}>
        <Text style={bd.pageTitle}>🎂 Aniversariantes</Text>
        {!isSelToday && (
          <TouchableOpacity style={bd.todayBtn} onPress={goToToday} activeOpacity={0.8}>
            <Feather name="calendar" size={13} color={C.tint} />
            <Text style={bd.todayBtnText}>Hoje</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inline calendar */}
      <View style={bd.calBox}>
        <View style={bd.monthNav}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={bd.monthLabel}>{MONTHS_BD[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="chevron-right" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={bd.weekRow}>
          {["D","S","T","Q","Q","S","S"].map((l, i) => (
            <Text key={i} style={bd.weekLabel}>{l}</Text>
          ))}
        </View>

        <View style={bd.dayGrid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={bd.dayCell} />;
            const isTd = isCurrentMonth && day === today.getDate();
            const isSel = day === selDay;
            const hasBD = bdForDay(day, month).length > 0;
            return (
              <TouchableOpacity
                key={`d${day}`}
                style={[bd.dayCell, isSel && bd.dayCellSel, !isSel && isTd && bd.dayCellToday]}
                onPress={() => setSelDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[bd.dayNum, isSel && bd.dayNumSel, !isSel && isTd && bd.dayNumToday]}>{day}</Text>
                {hasBD && <View style={[bd.dot, isSel && bd.dotSel]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List section */}
      <View style={bd.listBox}>
        <View style={bd.listHeader}>
          <Text style={[bd.listTitle, isSelToday && bd.listTitleToday]}>{selLabel}</Text>
          {selectedBDs.length > 0 && (
            <View style={bd.countBadge}><Text style={bd.countText}>{selectedBDs.length}</Text></View>
          )}
        </View>

        {loading ? (
          <View style={bd.listLoading}><ActivityIndicator color={C.tint} /></View>
        ) : selectedBDs.length === 0 ? (
          <View style={bd.listEmpty}>
            <Text style={bd.listEmptyEmoji}>{isSelToday ? "🎂" : "📅"}</Text>
            <Text style={bd.listEmptyText}>
              {isSelToday ? "Nenhum aniversariante hoje" : "Nenhum aniversariante nesta data."}
            </Text>
          </View>
        ) : (
          selectedBDs.map((b: any, i: number) => {
            const tagStyle = (C.tagColors as any)[b.tag] || null;
            const parts = b.birthDate?.split("-") || [];
            const birthStr = parts.length === 3
              ? `${parseInt(parts[2])}/${parseInt(parts[1]).toString().padStart(2, "0")}`
              : "";
            return (
              <View key={b.id} style={[bd.bdRow, i > 0 && bd.bdRowBorder]}>
                {b.avatarUrl ? (
                  <Image source={{ uri: b.avatarUrl }} style={bd.bdAvatar} />
                ) : (
                  <View style={[bd.bdAvatarFb, isSelToday && { backgroundColor: "#059669" }]}>
                    <Text style={bd.bdAvatarInitial}>{b.name?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={bd.bdName} numberOfLines={1}>{b.name}</Text>
                  {birthStr !== "" && (
                    <Text style={bd.bdDateSmall}>{birthStr}</Text>
                  )}
                </View>
                {tagStyle && b.tag && (
                  <View style={[bd.bdTag, { backgroundColor: tagStyle.bg }]}>
                    <Text style={[bd.bdTagText, { color: tagStyle.text }]}>{TAG_LABELS_BD[b.tag]}</Text>
                  </View>
                )}
                {isSelToday && <Text style={{ fontSize: 20 }}>🎉</Text>}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
const bd = StyleSheet.create({
  scrollContent: { gap: 0 },
  pageHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.18)",
  },
  pageTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  todayBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: "#BFDBFE",
  },
  todayBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },

  calBox: { backgroundColor: C.surface, paddingBottom: 8, marginBottom: 12 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  monthLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  weekRow: { flexDirection: "row", paddingHorizontal: 14, marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_700Bold", color: C.textMuted, textTransform: "uppercase" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14 },
  dayCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  dayCellSel: { backgroundColor: C.tint, borderRadius: 999 },
  dayCellToday: { backgroundColor: "#EFF6FF", borderRadius: 999 },
  dayNum: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  dayNumSel: { color: "#fff", fontFamily: "Inter_700Bold" },
  dayNumToday: { color: C.tint, fontFamily: "Inter_700Bold" },
  dot: { position: "absolute", bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: C.tint },
  dotSel: { backgroundColor: "rgba(255,255,255,0.85)" },

  listBox: {
    marginHorizontal: 14, backgroundColor: C.surface, borderRadius: 16, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.12)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.1)",
    backgroundColor: C.surfaceAlt,
  },
  listTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  listTitleToday: { color: "#166534" },
  countBadge: { backgroundColor: C.tint, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  listLoading: { padding: 24, alignItems: "center" },
  listEmpty: { padding: 28, alignItems: "center", gap: 8 },
  listEmptyEmoji: { fontSize: 36 },
  listEmptyText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  bdRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  bdRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.08)" },
  bdAvatar: { width: 42, height: 42, borderRadius: 21 },
  bdAvatarFb: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  bdAvatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  bdName: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  bdDateSmall: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  bdTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bdTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = "todos" | "destaques" | "comunicacao" | "fotos" | "videos" | "salvos" | "aniversarios";

const TABS: Array<{ key: MainTab; label: string; icon?: string; emoji?: string }> = [
  { key: "todos",       label: "Feed",         icon: "home" },
  { key: "destaques",   label: "Destaques",    icon: "star" },
  { key: "comunicacao", label: "Comunicação",  icon: "shield" },
  { key: "fotos",       label: "Fotos",        icon: "image" },
  { key: "videos",      label: "Vídeos",       icon: "video" },
  { key: "salvos",      label: "Salvos",       icon: "bookmark" },
  { key: "aniversarios",label: "Aniversários", emoji: "🎂" },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount, dmUnreadCount, refreshUnread } = useNotifications();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ openTab?: string }>();
  const [mainTab, setMainTab] = useState<MainTab>("todos");

  useEffect(() => {
    if (params.openTab && TABS.some((t) => t.key === params.openTab)) {
      setMainTab(params.openTab as MainTab);
      router.setParams({ openTab: undefined });
    }
  }, [params.openTab]);

  const [feedChannelId, setFeedChannelId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<"recent" | "popular">("recent");
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh flags
  const [todosRefreshing, setTodosRefreshing] = useState(false);
  const [destRefreshing, setDestRefreshing] = useState(false);
  const [comRefreshing, setComRefreshing] = useState(false);
  const [fotosRefreshing, setFotosRefreshing] = useState(false);
  const [videosRefreshing, setVideosRefreshing] = useState(false);
  const [savedRefreshing, setSavedRefreshing] = useState(false);
  const [bdRefreshing, setBdRefreshing] = useState(false);
  const [bdBannerDismissedOn, setBdBannerDismissedOn] = useState<string | null>(null);
  const todayKey = new Date().toDateString();
  const bdBannerDismissed = bdBannerDismissedOn === todayKey;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  // ── Channels ──────────────────────────────────────────────────────────────
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
    api.post(`/channels/${channelId}/read`, {}).then(() => refreshUnread()).catch(() => {});
  }

  const regularChannels = useMemo(() => channels.filter((c: any) => !c.isInternalComm), [channels]);
  const internalChannels = useMemo(() => channels.filter((c: any) => c.isInternalComm), [channels]);
  const internalIds = useMemo(() => new Set(internalChannels.map((c: any) => c.id)), [internalChannels]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const todosQ = useQuery({
    queryKey: ["posts-todos", feedChannelId, sortMode],
    queryFn: () => {
      const base = feedChannelId ? `/posts?channelId=${feedChannelId}&sort=${sortMode}&limit=60` : `/posts?sort=${sortMode}&limit=60`;
      return api.get(base);
    },
  });
  const todosData = useMemo(() => {
    const all = todosQ.data?.posts || [];
    return feedChannelId ? all : all.filter((p: any) => !internalIds.has(p.channelId));
  }, [todosQ.data, feedChannelId, internalIds]);

  const destaquesQ = useQuery({
    queryKey: ["posts-destaques"],
    queryFn: () => api.get("/posts?onlyPinned=true&limit=40"),
    enabled: mainTab === "destaques",
  });
  const destaquesData = useMemo(() => destaquesQ.data?.posts || [], [destaquesQ.data]);

  const comunicacaoQ = useQuery({
    queryKey: ["posts-comunicacao"],
    queryFn: () => api.get("/posts?limit=60"),
    enabled: mainTab === "comunicacao",
  });
  const comunicacaoData = useMemo(() => {
    const all = comunicacaoQ.data?.posts || [];
    return all.filter((p: any) => internalIds.has(p.channelId));
  }, [comunicacaoQ.data, internalIds]);

  const fotosQ = useQuery({
    queryKey: ["posts-fotos"],
    queryFn: () => api.get("/posts?type=image&limit=40"),
    enabled: mainTab === "fotos",
  });
  const fotosData = useMemo(() => fotosQ.data?.posts || [], [fotosQ.data]);

  const videosQ = useQuery({
    queryKey: ["posts-videos"],
    queryFn: () => api.get("/posts?type=video&limit=40"),
    enabled: mainTab === "videos",
  });
  const videosData = useMemo(() => videosQ.data?.posts || [], [videosQ.data]);

  const savedQ = useQuery({
    queryKey: ["posts-saved"],
    queryFn: () => api.get("/posts/saved"),
    enabled: mainTab === "salvos",
  });
  const savedData = useMemo(() => savedQ.data?.posts || [], [savedQ.data]);

  const bdTodayQ = useQuery<any[]>({
    queryKey: ["birthdays-today"],
    queryFn: () => api.get("/birthdays?days=1"),
    staleTime: 10 * 60 * 1000,
  });
  const todayBirthdays = ((bdTodayQ.data as any[]) || []).filter((b: any) => b.daysUntil === 0);

  const bdAllQ = useQuery<any[]>({
    queryKey: ["birthdays-all"],
    queryFn: () => api.get("/birthdays?days=365"),
    staleTime: 30 * 60 * 1000,
  });
  const allBirthdays = (bdAllQ.data || []) as any[];
  const bdTodayList = allBirthdays.filter((b: any) => b.daysUntil === 0);
  const bdUpcomingList = allBirthdays.filter((b: any) => b.daysUntil > 0);

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredTodosData = useMemo(() => {
    if (!searchQuery.trim()) return todosData;
    const q = searchQuery.toLowerCase();
    return todosData.filter((p: any) =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.author?.name || "").toLowerCase().includes(q)
    );
  }, [todosData, searchQuery]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["posts-todos"] });
    qc.invalidateQueries({ queryKey: ["posts-destaques"] });
    qc.invalidateQueries({ queryKey: ["posts-comunicacao"] });
    qc.invalidateQueries({ queryKey: ["posts-fotos"] });
    qc.invalidateQueries({ queryKey: ["posts-videos"] });
    qc.invalidateQueries({ queryKey: ["posts-saved"] });
  }

  // ── Channel filter bar ─────────────────────────────────────────────────────
  function ChannelFilterBar({ chList, selected, onSelect }: { chList: any[]; selected: number | null; onSelect: (id: number | null) => void }) {
    return (
      <View style={styles.channelBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelBarContent}>
          <TouchableOpacity style={[styles.channelPill, selected === null && styles.channelPillActive]} onPress={() => onSelect(null)} activeOpacity={0.8}>
            <Text style={[styles.channelPillText, selected === null && styles.channelPillTextActive]}>Todos</Text>
          </TouchableOpacity>
          {chList.map((ch: any) => {
            const active = selected === ch.id;
            const chColor = ch.color || C.tint;
            const hasUnread = unreadChannelIds.has(ch.id);
            return (
              <TouchableOpacity
                key={ch.id}
                style={[styles.channelPill, active ? { backgroundColor: chColor, borderColor: chColor } : ch.color ? { borderColor: ch.color, borderWidth: 1.5 } : null]}
                onPress={() => { const nextId = active ? null : ch.id; onSelect(nextId); if (!active && hasUnread) markChannelRead(ch.id); }}
                activeOpacity={0.8}
              >
                {!active && ch.color && <View style={[styles.chPillDot, { backgroundColor: ch.color }]} />}
                <Text style={[styles.channelPillText, active && styles.channelPillTextActive, !active && ch.color && { color: ch.color }]}>{ch.name}</Text>
                {hasUnread && !active && <View style={styles.chUnreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Generic posts list ─────────────────────────────────────────────────────
  function PostsList({
    posts, loading, refreshing, onRefresh, queryKey, header, emptyIcon, emptyText, emptySubText, emptyAction,
  }: {
    posts: any[]; loading: boolean; refreshing: boolean; onRefresh: () => void;
    queryKey: string; header?: React.ReactNode;
    emptyIcon?: string; emptyText?: string; emptySubText?: string; emptyAction?: React.ReactNode;
  }) {
    return (
      <FlatList
        data={posts}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLikeChange={invalidateAll}
            onDelete={invalidateAll}
            onSaveChange={invalidateAll}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} colors={[C.tint]} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListHeaderComponent={header ? <>{header}</> : null}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name={(emptyIcon as any) || "inbox"} size={36} color={C.tint} />
            </View>
            <Text style={styles.emptyText}>{emptyText || "Nenhuma publicação"}</Text>
            {emptySubText ? <Text style={styles.emptySubText}>{emptySubText}</Text> : null}
            {emptyAction}
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  // ── Sort bar ──────────────────────────────────────────────────────────────
  const SortBar = () => (
    <View style={styles.sortBar}>
      <TouchableOpacity style={[styles.sortBtn, sortMode === "recent" && styles.sortBtnActive]} onPress={() => setSortMode("recent")} activeOpacity={0.8}>
        <Feather name="clock" size={13} color={sortMode === "recent" ? C.tint : C.textMuted} />
        <Text style={[styles.sortBtnText, sortMode === "recent" && styles.sortBtnTextActive]}>Recentes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.sortBtn, sortMode === "popular" && styles.sortBtnActive]} onPress={() => setSortMode("popular")} activeOpacity={0.8}>
        <Feather name="trending-up" size={13} color={sortMode === "popular" ? C.tint : C.textMuted} />
        <Text style={[styles.sortBtnText, sortMode === "popular" && styles.sortBtnTextActive]}>Populares</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity onPress={() => router.push("/channel/create-post")} style={styles.createFab} activeOpacity={0.8}>
        <Feather name="edit-3" size={14} color="#fff" />
        <Text style={styles.createFabText}>Publicar</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Feed header (create post box) ─────────────────────────────────────────
  const FeedHeader = (
    <View>
      {todayBirthdays.length > 0 && !bdBannerDismissed && (
        <TouchableOpacity style={styles.birthdayBanner} onPress={() => setMainTab("aniversarios")} activeOpacity={0.88}>
          <Text style={styles.birthdayBannerEmoji}>🎂</Text>
          <Text style={styles.birthdayBannerText} numberOfLines={1}>
            {todayBirthdays.length === 1
              ? `${todayBirthdays[0].name} faz aniversário hoje!`
              : `${todayBirthdays.slice(0, 2).map((b: any) => b.name.split(" ")[0]).join(" e ")}${todayBirthdays.length > 2 ? ` +${todayBirthdays.length - 2}` : ""} fazem aniversário hoje!`}
          </Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); setBdBannerDismissedOn(todayKey); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={15} color="#166534" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.createBox} onPress={() => router.push("/channel/create-post")} activeOpacity={0.85}>
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
        <View style={styles.createMediaBtns}>
          <Feather name="image" size={18} color={C.tint} />
          <Feather name="video" size={18} color={C.tint} />
        </View>
      </TouchableOpacity>
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
      {feedChannelId && (
        <View style={styles.filterBanner}>
          <Feather name="filter" size={13} color={C.tint} />
          <Text style={styles.filterBannerText}>
            Filtrando: <Text style={{ fontFamily: "Inter_700Bold" }}>#{regularChannels.find((c: any) => c.id === feedChannelId)?.name}</Text>
          </Text>
          <TouchableOpacity onPress={() => setFeedChannelId(null)}>
            <Feather name="x" size={14} color={C.tint} />
          </TouchableOpacity>
        </View>
      )}
      {searchVisible && searchQuery.length > 0 && filteredTodosData.length !== todosData.length && (
        <View style={styles.filterBanner}>
          <Feather name="search" size={13} color={C.tint} />
          <Text style={styles.filterBannerText}>{filteredTodosData.length} resultado{filteredTodosData.length !== 1 ? "s" : ""} para "{searchQuery}"</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarInitial}>{user?.name?.[0]?.toUpperCase() || "U"}</Text>
            </View>
          )}
        </TouchableOpacity>

        {searchVisible ? (
          <View style={styles.searchBarWrap}>
            <Feather name="search" size={16} color={C.textMuted} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar posts..."
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.headerGreetingBlock}>
            <Text style={styles.headerGreeting} numberOfLines={1}>
              {getGreeting()}, <Text style={styles.headerGreetingName}>{user?.name?.split(" ")[0]}!</Text>
            </Text>
            <Text style={styles.headerDate} numberOfLines={1}>{getTodayLabel()}</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { setSearchVisible((v) => !v); if (searchVisible) setSearchQuery(""); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={searchVisible ? "x" : "search"} size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/saved" as any)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Feather name="bookmark" size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/messages" as any)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Feather name="send" size={19} color={C.text} />
            {dmUnreadCount > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{dmUnreadCount > 99 ? "99+" : dmUnreadCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/notifications" as any)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Feather name="bell" size={21} color={C.text} />
            {unreadCount > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Horizontal tab bar ── */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tab) => {
            const active = mainTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setMainTab(tab.key)}
                activeOpacity={0.8}
              >
                {tab.emoji ? (
                  <Text style={styles.tabEmoji}>{tab.emoji}</Text>
                ) : tab.icon ? (
                  <Feather name={tab.icon as any} size={14} color={active ? C.tint : C.textMuted} />
                ) : null}
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                {tab.key === "aniversarios" && (bdTodayList.length > 0 || todayBirthdays.length > 0) && !active && (
                  <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{bdTodayList.length || todayBirthdays.length}</Text></View>
                )}
                {active && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ══ TODOS TAB ══ */}
      {mainTab === "todos" && (
        <>
          <ChannelFilterBar chList={regularChannels} selected={feedChannelId} onSelect={setFeedChannelId} />
          <SortBar />
          <PostsList
            posts={filteredTodosData}
            loading={todosQ.isLoading}
            refreshing={todosRefreshing}
            onRefresh={async () => { setTodosRefreshing(true); await todosQ.refetch(); setTodosRefreshing(false); }}
            queryKey="todos"
            header={FeedHeader}
            emptyIcon="inbox"
            emptyText="Nenhuma publicação ainda"
            emptySubText="Seja o primeiro a publicar algo!"
            emptyAction={
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/channel/create-post")} activeOpacity={0.8}>
                <Feather name="edit-3" size={15} color="#fff" />
                <Text style={styles.emptyBtnText}>Criar publicação</Text>
              </TouchableOpacity>
            }
          />
          {todosQ.isLoading && !todosRefreshing && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ DESTAQUES TAB ══ */}
      {mainTab === "destaques" && (
        <>
          <View style={styles.sectionHeader}>
            <Feather name="star" size={16} color="#F59E0B" />
            <Text style={styles.sectionHeaderText}>Posts fixados e em destaque</Text>
          </View>
          <PostsList
            posts={destaquesData}
            loading={destaquesQ.isLoading}
            refreshing={destRefreshing}
            onRefresh={async () => { setDestRefreshing(true); await destaquesQ.refetch(); setDestRefreshing(false); }}
            queryKey="destaques"
            emptyIcon="star"
            emptyText="Sem destaques no momento"
            emptySubText="Posts fixados e destacados pelo admin aparecem aqui."
          />
          {destaquesQ.isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ COMUNICAÇÃO TAB ══ */}
      {mainTab === "comunicacao" && (
        <>
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
            posts={comunicacaoData}
            loading={comunicacaoQ.isLoading}
            refreshing={comRefreshing}
            onRefresh={async () => { setComRefreshing(true); await comunicacaoQ.refetch(); setComRefreshing(false); }}
            queryKey="comunicacao"
            emptyIcon="shield"
            emptyText="Sem comunicados"
            emptySubText="Avisos e comunicados oficiais da empresa aparecem aqui."
          />
          {comunicacaoQ.isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ FOTOS TAB ══ */}
      {mainTab === "fotos" && (
        <>
          <View style={styles.sectionHeader}>
            <Feather name="image" size={16} color={C.tint} />
            <Text style={styles.sectionHeaderText}>Posts com fotos</Text>
          </View>
          <PostsList
            posts={fotosData}
            loading={fotosQ.isLoading}
            refreshing={fotosRefreshing}
            onRefresh={async () => { setFotosRefreshing(true); await fotosQ.refetch(); setFotosRefreshing(false); }}
            queryKey="fotos"
            emptyIcon="image"
            emptyText="Nenhuma foto publicada"
            emptySubText="Posts com imagens aparecem aqui."
          />
          {fotosQ.isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ VÍDEOS TAB ══ */}
      {mainTab === "videos" && (
        <>
          <View style={styles.sectionHeader}>
            <Feather name="video" size={16} color={C.tint} />
            <Text style={styles.sectionHeaderText}>Posts com vídeos</Text>
          </View>
          <PostsList
            posts={videosData}
            loading={videosQ.isLoading}
            refreshing={videosRefreshing}
            onRefresh={async () => { setVideosRefreshing(true); await videosQ.refetch(); setVideosRefreshing(false); }}
            queryKey="videos"
            emptyIcon="video"
            emptyText="Nenhum vídeo publicado"
            emptySubText="Posts com vídeos aparecem aqui."
          />
          {videosQ.isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ SALVOS TAB ══ */}
      {mainTab === "salvos" && (
        <>
          <View style={styles.sectionHeader}>
            <Feather name="bookmark" size={16} color={C.tint} />
            <Text style={styles.sectionHeaderText}>Posts salvos por você</Text>
          </View>
          <PostsList
            posts={savedData}
            loading={savedQ.isLoading}
            refreshing={savedRefreshing}
            onRefresh={async () => { setSavedRefreshing(true); await savedQ.refetch(); setSavedRefreshing(false); }}
            queryKey="salvos"
            emptyIcon="bookmark"
            emptyText="Nenhum post salvo"
            emptySubText='Toque no ícone 🔖 em um post para salvá-lo aqui.'
          />
          {savedQ.isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
        </>
      )}

      {/* ══ ANIVERSÁRIOS TAB ══ */}
      {mainTab === "aniversarios" && (
        <BirthdaysTab
          allBirthdays={allBirthdays}
          loading={bdAllQ.isLoading}
          refreshing={bdRefreshing}
          onRefresh={async () => { setBdRefreshing(true); await bdAllQ.refetch(); setBdRefreshing(false); }}
          botPad={botPad}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.tint },
  headerAvatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#2563EB22", alignItems: "center", justifyContent: "center",
  },
  headerAvatarInitial: { color: "#2563EB", fontSize: 17, fontFamily: "Inter_700Bold" },
  headerGreetingBlock: { flex: 1 },
  headerGreeting: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  headerGreetingName: { fontFamily: "Inter_700Bold", color: C.text, fontSize: 13 },
  headerDate: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },
  searchBarWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchBarInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  iconBtn: { position: "relative", width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute", top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  tabBarWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBarContent: { paddingHorizontal: 8, paddingBottom: 0, flexDirection: "row", gap: 0 },
  tabItem: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 11,
    position: "relative",
  },
  tabItemActive: {},
  tabEmoji: { fontSize: 14 },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary } as any,
  tabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  tabIndicator: { position: "absolute", bottom: 0, left: "10%", right: "10%", height: 3, backgroundColor: C.tint, borderRadius: 3 },
  tabBadge: { backgroundColor: "#EF4444", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 1 },
  tabBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },

  sortBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sortBtnActive: { backgroundColor: "#EFF6FF" },
  sortBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted },
  sortBtnTextActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },
  createFab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  createFabText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sectionHeaderText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },

  channelBarWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  channelBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  channelPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surfaceAlt, borderColor: C.border },
  channelPillActive: { backgroundColor: C.tint, borderColor: C.tint },
  channelPillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  channelPillTextActive: { color: "#fff" },
  chPillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  chUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444", marginLeft: 4 },

  createBox: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface,
    marginHorizontal: 12, marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  createAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  createAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  createAvatarText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  createInputFake: {
    flex: 1, backgroundColor: C.inputBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  createPlaceholder: { color: C.placeholder, fontFamily: "Inter_400Regular", fontSize: 14 },
  createMediaBtns: { flexDirection: "row", gap: 10, alignItems: "center" },

  coverBanner: { position: "relative", height: 120, overflow: "hidden" },
  coverBannerImg: { width: "100%", height: "100%" },
  coverBannerOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16, paddingVertical: 10 },
  coverBannerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  coverBannerDesc: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular", marginTop: 2 },
  filterBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 12, marginBottom: 2, marginTop: 4,
    backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  filterBannerText: { flex: 1, fontSize: 12, color: C.tint, fontFamily: "Inter_400Regular" },

  internoHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#EFF6FF", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#BFDBFE",
  },
  internoHeaderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  internoHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  internoHeaderSub: { fontSize: 12, color: "#3B82F6", fontFamily: "Inter_400Regular", marginTop: 1 },

  birthdayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4", paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#BBF7D0",
  },
  birthdayBannerEmoji: { fontSize: 18 },
  birthdayBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#166534" },

  listContent: { paddingTop: 4 },


  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySubText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.tint, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)" },
});
