import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, Image, TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTHS_SHORT[month - 1]}`;
}

function getAge(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

type Tab = "today" | "upcoming";

function BirthdayCard({ item, showFullDate }: { item: any; showFullDate?: boolean }) {
  const tagStyle = (C.tagColors as any)[item.tag] || null;
  const isToday = item.daysUntil === 0;
  const age = item.birthDate ? getAge(item.birthDate) : null;

  return (
    <View style={[styles.card, isToday && styles.cardToday]}>
      {/* Left: avatar */}
      <View style={styles.avatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, isToday && styles.avatarFallbackToday]}>
            <Feather name="user" size={24} color={isToday ? "#fff" : "#9CA3AF"} />
          </View>
        )}
        {isToday && <Text style={styles.cakeEmoji}>🎂</Text>}
      </View>

      {/* Middle: info */}
      <View style={styles.info}>
        <Text style={[styles.name, isToday && styles.nameToday]}>{item.name}</Text>

        <View style={styles.metaRow}>
          {tagStyle && item.tag && (
            <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
              <Text style={[styles.tagText, { color: tagStyle.text }]}>{TAG_LABELS[item.tag]}</Text>
            </View>
          )}
        </View>

        {item.birthDate && (
          <View style={styles.dateRow}>
            <Feather name="calendar" size={12} color={isToday ? C.tint : C.textMuted} />
            <Text style={[styles.dateText, isToday && { color: C.tint }]}>
              {showFullDate ? formatFullDate(item.birthDate) : formatDayMonth(item.birthDate)}
              {age !== null && !isToday && (
                <Text style={styles.ageSuffix}> · {age} anos</Text>
              )}
              {age !== null && isToday && (
                <Text style={[styles.ageSuffix, { color: C.tint }]}> · {age + 1} anos! 🎉</Text>
              )}
            </Text>
          </View>
        )}
      </View>

      {/* Right: days badge */}
      <View style={[styles.daysBadge, isToday && styles.daysBadgeToday]}>
        {isToday ? (
          <Text style={styles.todayEmoji}>🎉</Text>
        ) : (
          <>
            <Text style={styles.daysNum}>{item.daysUntil}</Text>
            <Text style={styles.daysLabel}>dias</Text>
          </>
        )}
      </View>
    </View>
  );
}

export default function BirthdaysScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const [tab, setTab] = useState<Tab>("today");
  const [refreshing, setRefreshing] = useState(false);

  const { data: birthdays = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["birthdays"],
    queryFn: () => api.get("/birthdays?days=90"),
  });

  const todayList = birthdays.filter((b: any) => b.daysUntil === 0);
  const upcomingList = birthdays.filter((b: any) => b.daysUntil > 0);
  const displayList = tab === "today" ? todayList : upcomingList;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        {canGoBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, canGoBack && { flex: 1 }]}>Aniversários</Text>
        <Feather name="gift" size={22} color={C.tint} />
      </View>

      {/* Sub-tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === "today" && styles.tabActive]}
          onPress={() => setTab("today")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === "today" && styles.tabTextActive]}>
            🎂 Hoje
            {todayList.length > 0 && (
              <Text style={[styles.tabCount, tab === "today" && styles.tabCountActive]}>
                {" "}{todayList.length}
              </Text>
            )}
          </Text>
          {tab === "today" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === "upcoming" && styles.tabActive]}
          onPress={() => setTab("upcoming")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>
            📅 Próximos
            {upcomingList.length > 0 && (
              <Text style={[styles.tabCount, tab === "upcoming" && styles.tabCountActive]}>
                {" "}{upcomingList.length}
              </Text>
            )}
          </Text>
          {tab === "upcoming" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Today special banner */}
      {tab === "today" && todayList.length > 0 && (
        <View style={styles.todayBanner}>
          <Text style={styles.todayBannerEmoji}>🎊</Text>
          <Text style={styles.todayBannerText}>
            {todayList.length === 1
              ? `${todayList[0].name} faz aniversário hoje!`
              : `${todayList.length} colaboradores fazem aniversário hoje!`}
          </Text>
        </View>
      )}

      <FlatList
        data={displayList}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <BirthdayCard item={item} showFullDate={tab === "today"} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
            tintColor={C.tint}
            colors={[C.tint]}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tab === "today" ? "🎂" : "📅"}</Text>
              <Text style={styles.emptyText}>
                {tab === "today"
                  ? "Nenhum aniversariante hoje"
                  : "Nenhum aniversário nos próximos 90 dias"}
              </Text>
              {tab === "today" && (
                <Text style={styles.emptySubText}>Cheque os próximos aniversários na aba ao lado</Text>
              )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: { padding: 2 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },

  /* Sub-tabs */
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  tabTextActive: {
    color: C.tint, fontFamily: "Inter_700Bold",
  },
  tabCount: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
  },
  tabCountActive: { color: C.tint },
  tabIndicator: {
    position: "absolute", bottom: 0, left: "10%", right: "10%",
    height: 3, backgroundColor: C.tint, borderRadius: 3,
  },

  /* Today banner */
  todayBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4",
    marginHorizontal: 14, marginTop: 10, marginBottom: 2,
    borderRadius: 12, padding: 12,
    borderColor: "#bbf7d0",
  },
  todayBannerEmoji: { fontSize: 22 },
  todayBannerText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#166534" },

  listContent: { paddingTop: 10, paddingHorizontal: 14, gap: 8 },

  /* Cards */
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    borderColor: C.borderLight,
  },
  cardToday: {
    borderColor: C.tint, borderWidth: 1.5,
    backgroundColor: "#f0fdf4",
  },

  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  avatarFallbackToday: { backgroundColor: "#059669", borderColor: "#059669" },
  avatarInitial: { color: "#1E3A8A", fontFamily: "Inter_700Bold", fontSize: 20 },
  cakeEmoji: { position: "absolute", bottom: -4, right: -4, fontSize: 18 },

  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  nameToday: { color: "#166534" },

  metaRow: { flexDirection: "row", gap: 6 },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  dateText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  ageSuffix: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  daysBadge: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.surfaceAlt,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    minWidth: 52,
  },
  daysBadgeToday: { backgroundColor: "#dcfce7" },
  todayEmoji: { fontSize: 22 },
  daysNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  daysLabel: { fontSize: 10, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  empty: { alignItems: "center", paddingTop: 70, gap: 10, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textAlign: "center" },
  emptySubText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
