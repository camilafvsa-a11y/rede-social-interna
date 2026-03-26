import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, ScrollView, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

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

// ─── Main screen ─────────────────────────────────────────────────────────────
type MainTab = "feed" | "aniversarios";
type BdTab = "today" | "upcoming";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("feed");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const todayKey = new Date().toDateString();
  const [birthdayBannerDismissedOn, setBirthdayBannerDismissedOn] = useState<string | null>(null);
  const birthdayBannerDismissed = birthdayBannerDismissedOn === todayKey;
  const [bdTab, setBdTab] = useState<BdTab>("today");
  const [bdRefreshing, setBdRefreshing] = useState(false);

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

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
  const bdDisplayList = bdTab === "today" ? bdTodayList : bdUpcomingList;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feed", selectedChannel],
    queryFn: () =>
      api.get(selectedChannel
        ? `/posts?channelId=${selectedChannel}&limit=40`
        : "/posts?limit=40"),
    enabled: mainTab === "feed",
  });
  const posts = data?.posts || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const FeedListHeader = (
    <View>
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
      {selectedChannel && (
        <View style={styles.filterBanner}>
          <Feather name="filter" size={13} color={C.tint} />
          <Text style={styles.filterBannerText}>
            Filtrando por: <Text style={{ fontFamily: "Inter_700Bold" }}>
              #{channels.find((c: any) => c.id === selectedChannel)?.name}
            </Text>
          </Text>
          <TouchableOpacity onPress={() => setSelectedChannel(null)}>
            <Feather name="x" size={14} color={C.tint} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        {mainTab === "feed" && (
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => router.push("/channel/create-post")}
            activeOpacity={0.8}
          >
            <Feather name="edit-3" size={20} color={C.tint} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Main tab bar: Feed | Aniversários ── */}
      <View style={styles.mainTabBar}>
        <TouchableOpacity
          style={[styles.mainTab, mainTab === "feed" && styles.mainTabActive]}
          onPress={() => setMainTab("feed")}
          activeOpacity={0.8}
        >
          <Feather name="home" size={15} color={mainTab === "feed" ? C.tint : C.textMuted} />
          <Text style={[styles.mainTabText, mainTab === "feed" && styles.mainTabTextActive]}>Feed</Text>
          {mainTab === "feed" && <View style={styles.mainTabIndicator} />}
        </TouchableOpacity>
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
      </View>

      {/* ══ FEED TAB ══ */}
      {mainTab === "feed" && (
        <>
          {/* Birthday notification banner */}
          {todayBirthdays.length > 0 && !birthdayBannerDismissed && (
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
                onPress={(e) => { e.stopPropagation(); setBirthdayBannerDismissedOn(todayKey); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={15} color="#166534" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Channel filter bar */}
          <View style={styles.channelBarWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelBarContent}>
              <TouchableOpacity
                style={[styles.channelPill, selectedChannel === null && styles.channelPillActive]}
                onPress={() => setSelectedChannel(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.channelPillText, selectedChannel === null && styles.channelPillTextActive]}>Todos</Text>
              </TouchableOpacity>
              {channels.map((ch: any) => {
                const active = selectedChannel === ch.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.channelPill, active && styles.channelPillActive]}
                    onPress={() => setSelectedChannel(active ? null : ch.id)}
                    activeOpacity={0.8}
                  >
                    {ch.isInternalComm && (
                      <Feather name="shield" size={11} color={active ? "#fff" : C.tint} style={{ marginRight: 3 }} />
                    )}
                    <Text style={[styles.channelPillText, active && styles.channelPillTextActive]}>{ch.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Posts list */}
          <FlatList
            data={posts}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }) => (
              <PostCard post={item} onLikeChange={refetch} onDelete={refetch} />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} colors={[C.tint]} />
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
            ListHeaderComponent={FeedListHeader}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Feather name="inbox" size={36} color={C.tint} />
                  </View>
                  <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
                  <Text style={styles.emptySubText}>
                    {selectedChannel ? "Nenhum post neste canal. Seja o primeiro!" : "Seja o primeiro a publicar algo!"}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => router.push("/channel/create-post")}
                    activeOpacity={0.8}
                  >
                    <Feather name="edit-3" size={15} color="#fff" />
                    <Text style={styles.emptyBtnText}>Criar publicação</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
          {isLoading && !refreshing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={C.tint} />
            </View>
          )}
        </>
      )}

      {/* ══ ANIVERSÁRIOS TAB ══ */}
      {mainTab === "aniversarios" && (
        <>
          {/* Sub-tabs: Hoje / Próximos */}
          <View style={styles.bdTabBar}>
            <TouchableOpacity
              style={[styles.bdTab, bdTab === "today" && styles.bdTabActive]}
              onPress={() => setBdTab("today")}
              activeOpacity={0.8}
            >
              <Text style={[styles.bdTabText, bdTab === "today" && styles.bdTabTextActive]}>
                🎂 Hoje
                {bdTodayList.length > 0 && (
                  <Text style={[styles.bdTabCount, bdTab === "today" && styles.bdTabCountActive]}>
                    {"  "}{bdTodayList.length}
                  </Text>
                )}
              </Text>
              {bdTab === "today" && <View style={styles.bdTabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bdTab, bdTab === "upcoming" && styles.bdTabActive]}
              onPress={() => setBdTab("upcoming")}
              activeOpacity={0.8}
            >
              <Text style={[styles.bdTabText, bdTab === "upcoming" && styles.bdTabTextActive]}>
                📅 Próximos
                {bdUpcomingList.length > 0 && (
                  <Text style={[styles.bdTabCount, bdTab === "upcoming" && styles.bdTabCountActive]}>
                    {"  "}{bdUpcomingList.length}
                  </Text>
                )}
              </Text>
              {bdTab === "upcoming" && <View style={styles.bdTabIndicator} />}
            </TouchableOpacity>
          </View>

          {/* Today banner */}
          {bdTab === "today" && bdTodayList.length > 0 && (
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
            data={bdDisplayList}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }) => <BirthdayCard item={item} showFullDate={bdTab === "today"} />}
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
                  <Text style={styles.bdEmptyEmoji}>{bdTab === "today" ? "🎂" : "📅"}</Text>
                  <Text style={styles.emptyText}>
                    {bdTab === "today" ? "Nenhum aniversariante hoje" : "Nenhum aniversário nos próximos 90 dias"}
                  </Text>
                  {bdTab === "today" && (
                    <Text style={styles.emptySubText}>Cheque os próximos na aba ao lado</Text>
                  )}
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
          {bdLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={C.tint} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  greeting: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  newPostBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },

  /* Main tab bar */
  mainTabBar: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  mainTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, position: "relative",
  },
  mainTabActive: {},
  mainTabEmoji: { fontSize: 15 },
  mainTabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary },
  mainTabTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },
  mainTabIndicator: {
    position: "absolute", bottom: 0, left: "10%", right: "10%",
    height: 3, backgroundColor: C.tint, borderRadius: 3,
  },
  mainTabBadge: {
    backgroundColor: "#EF4444", borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, marginLeft: 2,
  },
  mainTabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },

  /* Birthday notification banner (feed tab) */
  birthdayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#BBF7D0",
  },
  birthdayBannerEmoji: { fontSize: 18 },
  birthdayBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#166534" },

  /* Channel filter bar */
  channelBarWrapper: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  channelBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  channelPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
  },
  channelPillActive: { backgroundColor: C.tint, borderColor: C.tint },
  channelPillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  channelPillTextActive: { color: "#fff" },

  /* Create post */
  createBox: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface,
    marginHorizontal: 14, marginTop: 12, marginBottom: 4, padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
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
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.borderLight,
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

  /* Birthdays sub-tab bar */
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
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#bbf7d0",
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
    borderWidth: 1, borderColor: C.borderLight,
  },
  bdCardToday: { borderColor: C.tint, borderWidth: 1.5, backgroundColor: "#f0fdf4" },
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
