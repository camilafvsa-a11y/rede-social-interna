import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function AdminReportsScreen() {
  const insets = useSafeAreaInsets();
  const { data: reports = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["reports"],
    queryFn: () => api.get("/posts/reports/all"),
  });

  async function deleteComment(commentId: number) {
    Alert.alert("Excluir comentário", "Excluir e resolver a denúncia?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/posts/comments/${commentId}`);
            await refetch();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        }
      }
    ]);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Denúncias</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.flagIcon}>
                <Feather name="flag" size={16} color={C.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reporterName}>Denunciado por: {item.reporter?.name}</Text>
                <Text style={styles.reportReason}>Motivo: {item.reason}</Text>
              </View>
            </View>
            <View style={styles.commentBox}>
              <Text style={styles.commentAuthor}>{item.comment?.author?.name}:</Text>
              <Text style={styles.commentContent}>{item.comment?.content}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deleteComment(item.commentId)}
            >
              <Feather name="trash-2" size={14} color="#fff" />
              <Text style={styles.deleteBtnText}>Excluir comentário</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 20 }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="check-circle" size={48} color={C.success} />
              <Text style={styles.emptyText}>Nenhuma denúncia pendente</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}
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
  listContent: { padding: 12, gap: 10 },
  reportCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#FECACA", gap: 10,
  },
  reportHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  flagIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  reporterName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  reportReason: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  commentBox: { backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 10 },
  commentAuthor: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 4 },
  commentContent: { fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  deleteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
});
