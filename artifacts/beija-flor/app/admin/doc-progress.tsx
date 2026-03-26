import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

type UserProgress = {
  user: { id: number; name: string; email: string; role: string };
  readCount: number;
  completionCount: number;
  percentage: number;
  totalDocs: number;
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function ProgressBar({ percent }: { percent: number }) {
  const done = percent >= 100;
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: done ? "#059669" : C.tint }]} />
    </View>
  );
}

function UserRow({
  item,
  onReset,
  resetting,
}: {
  item: UserProgress;
  onReset: () => void;
  resetting: boolean;
}) {
  const done = item.percentage >= 100;

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, done && styles.avatarDone]}>
        <Text style={styles.avatarText}>{getInitials(item.user.name)}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.userName} numberOfLines={1}>{item.user.name}</Text>
          {done && (
            <View style={styles.doneBadge}>
              <Feather name="check-circle" size={10} color="#059669" />
              <Text style={styles.doneBadgeText}>100%</Text>
            </View>
          )}
        </View>
        <Text style={styles.userEmail} numberOfLines={1}>{item.user.email}</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
          <ProgressBar percent={item.percentage} />
          <Text style={[styles.percentText, done && { color: "#059669" }]}>
            {item.percentage}%
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Feather name="file-text" size={11} color={C.textMuted} />
            <Text style={styles.statText}>{item.readCount}/{item.totalDocs} lidos</Text>
          </View>
          {item.completionCount > 0 && (
            <View style={styles.stat}>
              <Feather name="award" size={11} color="#D97706" />
              <Text style={[styles.statText, { color: "#D97706" }]}>
                {item.completionCount}× completou
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.resetBtn, resetting && { opacity: 0.5 }]}
        onPress={onReset}
        disabled={resetting}
        activeOpacity={0.7}
      >
        {resetting
          ? <ActivityIndicator size="small" color="#EF4444" />
          : <Feather name="rotate-ccw" size={16} color="#EF4444" />}
      </TouchableOpacity>
    </View>
  );
}

export default function DocProgressScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");
  const [resettingId, setResettingId] = useState<number | null>(null);

  const { data: progress = [], isLoading, refetch } = useQuery<UserProgress[]>({
    queryKey: ["admin-doc-progress"],
    queryFn: () => api.get("/docs/admin"),
  });

  async function handleReset(userId: number, userName: string) {
    Alert.alert(
      "Resetar progresso",
      `Tem certeza que deseja resetar todo o progresso de leitura de ${userName}?\n\nIsso irá zerar os documentos lidos e o histórico de conclusões.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetar",
          style: "destructive",
          onPress: async () => {
            setResettingId(userId);
            try {
              await api.delete(`/docs/reset/${userId}`);
              await refetch();
              qc.invalidateQueries({ queryKey: ["admin-doc-progress"] });
            } catch (e: any) {
              Alert.alert("Erro", e.message || "Não foi possível resetar o progresso.");
            } finally {
              setResettingId(null);
            }
          },
        },
      ]
    );
  }

  const filtered = progress.filter((p) =>
    p.user.name.toLowerCase().includes(search.toLowerCase()) ||
    p.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = filtered.length;
  const fullyRead = filtered.filter((p) => p.percentage >= 100).length;
  const avgPercent = totalUsers > 0
    ? Math.round(filtered.reduce((acc, p) => acc + p.percentage, 0) / totalUsers)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Progresso de Leitura</Text>
          <Text style={styles.subtitle}>Acompanhe quem leu os documentos</Text>
        </View>
      </View>

      {/* Stats banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsCard}>
          <Text style={styles.statsNum}>{avgPercent}%</Text>
          <Text style={styles.statsLabel}>Média geral</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsCard}>
          <Text style={[styles.statsNum, { color: "#059669" }]}>{fullyRead}</Text>
          <Text style={styles.statsLabel}>Leram tudo</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsCard}>
          <Text style={styles.statsNum}>{totalUsers}</Text>
          <Text style={styles.statsLabel}>Colaboradores</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar colaborador..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.user.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={36} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum colaborador encontrado</Text>
            </View>
          }
          renderItem={({ item }) => (
            <UserRow
              item={item}
              onReset={() => handleReset(item.user.id, item.user.name)}
              resetting={resettingId === item.user.id}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 1 },

  /* Stats banner */
  statsBanner: {
    flexDirection: "row", backgroundColor: C.surface,
    marginHorizontal: 16, marginTop: 14, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statsCard: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statsNum: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.tint },
  statsLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted, marginTop: 2 },
  statsDivider: { width: 1, backgroundColor: C.border, marginVertical: 10 },

  /* Search */
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 10,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular",
    color: C.text, padding: 0,
  },

  /* List */
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  separator: { height: 8 },

  /* Row */
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  avatarDone: { backgroundColor: "#059669" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted },

  doneBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F0FDF4", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  doneBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#059669" },

  bar: {
    flex: 1, height: 6, backgroundColor: C.surfaceAlt,
    borderRadius: 3, overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
  percentText: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.tint, minWidth: 36, textAlign: "right" },

  statsRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textMuted },

  resetBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2, borderWidth: 1, borderColor: "#FECACA",
  },

  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textMuted },
});
