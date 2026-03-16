import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, Image, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

function formatBirthDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day} de ${months[month - 1]}`;
}

export default function BirthdaysScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: birthdays = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["birthdays"],
    queryFn: () => api.get("/birthdays?days=60"),
  });

  const today = birthdays.filter((b: any) => b.daysUntil === 0);
  const upcoming = birthdays.filter((b: any) => b.daysUntil > 0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  function BirthdayCard({ item }: { item: any }) {
    const tagStyle = (C.tagColors as any)[item.tag] || null;
    const isToday = item.daysUntil === 0;

    return (
      <View style={[styles.card, isToday && styles.cardToday]}>
        <View style={styles.avatarContainer}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, isToday && { backgroundColor: C.accent }]}>
              <Text style={styles.avatarInitial}>{item.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          {isToday && <Text style={styles.cakeEmoji}>🎂</Text>}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, isToday && { color: C.tint }]}>{item.name}</Text>
          {tagStyle && item.tag && (
            <View style={[styles.tag, { backgroundColor: tagStyle.bg }]}>
              <Text style={[styles.tagText, { color: tagStyle.text }]}>{TAG_LABELS[item.tag]}</Text>
            </View>
          )}
          <Text style={styles.date}>{formatBirthDate(item.birthDate)}</Text>
        </View>

        <View style={[styles.daysBadge, isToday && styles.daysBadgeToday]}>
          <Text style={[styles.daysNum, isToday && { color: C.tint }]}>
            {isToday ? "🎉" : item.daysUntil}
          </Text>
          {!isToday && <Text style={styles.daysLabel}>dias</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Aniversários</Text>
        <Feather name="gift" size={22} color={C.tint} />
      </View>

      <FlatList
        data={[...today, ...upcoming]}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item, index }) => {
          const prevItem = index > 0 ? [...today, ...upcoming][index - 1] : null;
          const showTodayHeader = index === 0 && today.length > 0;
          const showUpcomingHeader = item.daysUntil > 0 && (prevItem === null || prevItem.daysUntil === 0);
          return (
            <>
              {showTodayHeader && (
                <Text style={styles.sectionLabel}>🎉 Hoje</Text>
              )}
              {showUpcomingHeader && (
                <Text style={styles.sectionLabel}>Próximos aniversários</Text>
              )}
              <BirthdayCard item={item} />
            </>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={C.tint} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="gift" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum aniversário nos próximos 60 dias</Text>
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
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, paddingHorizontal: 16, paddingVertical: 8 },
  listContent: { paddingTop: 8 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, marginHorizontal: 16, marginVertical: 4,
    borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardToday: {
    borderWidth: 1.5, borderColor: C.tint,
    backgroundColor: "#f0fdf4",
  },
  avatarContainer: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 },
  cakeEmoji: { position: "absolute", bottom: -4, right: -4, fontSize: 16 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  tag: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  daysBadge: {
    alignItems: "center", backgroundColor: C.surfaceAlt,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 48,
  },
  daysBadgeToday: { backgroundColor: "#dcfce7" },
  daysNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  daysLabel: { fontSize: 10, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
