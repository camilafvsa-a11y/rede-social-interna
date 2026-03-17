import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Platform, TextInput, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TERM_LABELS: Record<string, string> = {
  image_voice_authorization: "Autorização de Uso de Imagem e Voz",
};

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminTermsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: acceptances = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-terms"],
    queryFn: () => api.get("/terms/admin/all"),
  });

  const filtered = acceptances.filter((a: any) =>
    search === "" ||
    a.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    a.termTitle?.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const groupedByTerm: Record<string, any[]> = {};
  filtered.forEach((a) => {
    if (!groupedByTerm[a.termKey]) groupedByTerm[a.termKey] = [];
    groupedByTerm[a.termKey].push(a);
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Termos Assinados</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{acceptances.length}</Text>
          <Text style={styles.summaryLabel}>Assinaturas</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>{Object.keys(groupedByTerm).length}</Text>
          <Text style={styles.summaryLabel}>Documentos</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNum}>
            {new Set(acceptances.map((a: any) => a.user?.id)).size}
          </Text>
          <Text style={styles.summaryLabel}>Colaboradores</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou documento..."
          placeholderTextColor={C.placeholder}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item, index }) => {
          const prevItem = index > 0 ? filtered[index - 1] : null;
          const showGroupHeader = !prevItem || prevItem.termKey !== item.termKey;

          return (
            <>
              {showGroupHeader && (
                <View style={styles.groupHeader}>
                  <View style={styles.groupIconWrap}>
                    <Feather name="file-text" size={14} color={C.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{item.termTitle}</Text>
                    <Text style={styles.groupCount}>
                      {groupedByTerm[item.termKey]?.length || 0} assinatura(s)
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.acceptanceCard}>
                <View style={styles.userAvatar}>
                  {item.user?.avatarUrl ? (
                    <Image source={{ uri: item.user.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>{item.user?.name?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.user?.name}</Text>
                  <Text style={styles.userEmail}>{item.user?.email}</Text>
                </View>
                <View style={styles.dateBadge}>
                  <Feather name="check-circle" size={12} color="#059669" />
                  <Text style={styles.dateText}>{formatDateTime(item.acceptedAt)}</Text>
                </View>
              </View>
            </>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
            tintColor={C.tint}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="file-text" size={32} color={C.textMuted} />
              </View>
              <Text style={styles.emptyText}>
                {search ? "Nenhum resultado encontrado" : "Nenhum termo assinado ainda"}
              </Text>
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
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },

  summaryBar: {
    flexDirection: "row", backgroundColor: C.surface,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.tint },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, backgroundColor: C.surface,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },

  listContent: { paddingHorizontal: 12, gap: 6 },

  groupHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 2,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  groupIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center",
  },
  groupTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#166534" },
  groupCount: { fontSize: 11, color: "#059669", fontFamily: "Inter_400Regular" },

  acceptanceCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.borderLight,
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  userEmail: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 10, color: "#059669", fontFamily: "Inter_500Medium" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.textSecondary },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
