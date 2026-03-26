import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Modal, TextInput, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function AdminTicketHandlersScreen() {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const { data: handlers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["ticket-handlers"],
    queryFn: () => api.get("/tickets/admin/handlers"),
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["all-users-for-handlers"],
    queryFn: () => api.get("/users"),
    enabled: showModal,
  });

  const filteredUsers = users.filter((u: any) =>
    !handlers.some((h: any) => h.userId === u.id) &&
    (search === "" || u.name.toLowerCase().includes(search.toLowerCase()))
  );

  async function addHandler(userId: number) {
    try {
      await api.post("/tickets/admin/handlers", { userId });
      await refetch();
      setShowModal(false);
      setSearch("");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function removeHandler(userId: number, name: string) {
    Alert.alert("Remover responsável", `Remover ${name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/tickets/admin/handlers/${userId}`);
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
        <Text style={styles.title}>Responsáveis por Chamados</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={handlers}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.handlerCard}>
            <View style={styles.avatar}>
              {item.user?.avatarUrl ? (
                <Image source={{ uri: item.user.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{item.user?.name?.[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.handlerInfo}>
              <Text style={styles.handlerName}>{item.user?.name}</Text>
              <Text style={styles.handlerRole}>{item.user?.role}</Text>
            </View>
            <TouchableOpacity onPress={() => removeHandler(item.userId, item.user?.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={18} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={!isLoading ? <View style={styles.empty}><Text style={styles.emptyText}>Nenhum responsável cadastrado</Text></View> : null}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Responsável</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar usuário..."
                placeholderTextColor={C.placeholder}
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item: u }) => (
                <TouchableOpacity style={styles.userItem} onPress={() => addHandler(u.id)} activeOpacity={0.8}>
                  <View style={styles.userAvatar}>
                    {u.avatarUrl ? (
                      <Image source={{ uri: u.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>{u.name?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                  </View>
                  <Feather name="plus" size={18} color={C.tint} />
                </TouchableOpacity>
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          </View>
        </View>
      </Modal>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, gap: 8 },
  handlerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderColor: C.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarInitial: { color: "#1E3A8A", fontFamily: "Inter_700Bold", fontSize: 16 },
  handlerInfo: { flex: 1 },
  handlerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  handlerRole: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "70%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, backgroundColor: C.inputBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  userItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  userEmail: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
});
