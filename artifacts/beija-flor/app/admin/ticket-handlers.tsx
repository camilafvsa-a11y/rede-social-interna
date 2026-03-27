import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Modal, TextInput, Image, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { TICKET_CATEGORIES } from "@/constants/tickets";

const C = Colors.light;

interface HandlerRecord {
  id: number;
  userId: number;
  category: string;
  user: { id: number; name: string; avatarUrl?: string | null; role: string } | null;
  addedAt: string;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
}

export default function AdminTicketHandlersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"user" | "category">("user");
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [search, setSearch] = useState("");

  const { data: handlers = [], isLoading, refetch } = useQuery<HandlerRecord[]>({
    queryKey: ["ticket-handlers"],
    queryFn: () => api.get("/tickets/admin/handlers"),
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["all-users-for-handlers"],
    queryFn: () => api.get("/users"),
    enabled: showModal,
  });

  const filteredUsers = users.filter((u) =>
    search === "" || u.name.toLowerCase().includes(search.toLowerCase())
  );

  function openModal() {
    setStep("user");
    setSelectedUser(null);
    setSearch("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedUser(null);
    setSearch("");
    setStep("user");
  }

  function selectUser(u: UserItem) {
    setSelectedUser(u);
    setSearch("");
    setStep("category");
  }

  async function addHandler(category: string) {
    if (!selectedUser) return;
    try {
      await api.post("/tickets/admin/handlers", { userId: selectedUser.id, category });
      await qc.invalidateQueries({ queryKey: ["ticket-handlers"] });
      closeModal();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function removeHandler(handlerId: number, name: string, category: string) {
    Alert.alert(
      "Remover delegação",
      `Remover ${name} de "${category}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover", style: "destructive", onPress: async () => {
            try {
              await api.delete(`/tickets/admin/handlers/${handlerId}`);
              await qc.invalidateQueries({ queryKey: ["ticket-handlers"] });
            } catch (e: any) {
              Alert.alert("Erro", e.message);
            }
          },
        },
      ]
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const groupedByUser: Record<number, { user: HandlerRecord["user"]; categories: HandlerRecord[] }> = {};
  handlers.forEach((h) => {
    if (!groupedByUser[h.userId]) groupedByUser[h.userId] = { user: h.user, categories: [] };
    groupedByUser[h.userId].categories.push(h);
  });
  const groupedList = Object.values(groupedByUser);

  const catInfo = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c.label, c]));

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Responsáveis por Chamados</Text>
        <TouchableOpacity onPress={openModal} style={styles.addBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList<typeof groupedList[number]>
        data={groupedList}
        keyExtractor={(item) => String(item.user?.id ?? Math.random())}
        renderItem={({ item: group }) => (
          <View style={styles.groupCard}>
            <View style={styles.groupUserRow}>
              <View style={styles.avatar}>
                {group.user?.avatarUrl ? (
                  <Image source={{ uri: group.user.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Feather name="user" size={20} color="#9CA3AF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{group.user?.name ?? "—"}</Text>
                <Text style={styles.userRole}>{group.categories.length} {group.categories.length === 1 ? "categoria" : "categorias"}</Text>
              </View>
            </View>
            <View style={styles.catList}>
              {group.categories.map((h) => {
                const info = catInfo[h.category];
                return (
                  <View key={h.id} style={[styles.catChip, { backgroundColor: info?.bg ?? "#F3F4F6" }]}>
                    <Feather name={info?.icon ?? "tag"} size={12} color={info?.color ?? "#6B7280"} />
                    <Text style={[styles.catChipText, { color: info?.color ?? "#6B7280" }]}>{h.category}</Text>
                    <TouchableOpacity
                      onPress={() => removeHandler(h.id, group.user?.name ?? "Usuário", h.category)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="x" size={12} color={info?.color ?? "#6B7280"} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 20 }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="user-check" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum responsável cadastrado</Text>
              <Text style={styles.emptySubText}>Adicione responsáveis por categoria usando o botão +</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={step === "category" ? () => { setStep("user"); setSearch(""); } : closeModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={step === "category" ? "arrow-left" : "x"} size={22} color={C.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {step === "user" ? "Escolher Colaborador" : "Escolher Categoria"}
              </Text>
              <View style={{ width: 22 }} />
            </View>

            {step === "user" ? (
              <>
                <View style={styles.searchBar}>
                  <Feather name="search" size={16} color={C.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar colaborador..."
                    placeholderTextColor={C.placeholder}
                  />
                </View>
                <FlatList<UserItem>
                  data={filteredUsers}
                  keyExtractor={(u) => String(u.id)}
                  renderItem={({ item: u }) => (
                    <TouchableOpacity style={styles.userItem} onPress={() => selectUser(u)} activeOpacity={0.8}>
                      <View style={styles.userAvatar}>
                        {u.avatarUrl ? (
                          <Image source={{ uri: u.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Feather name="user" size={18} color="#9CA3AF" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userItemName}>{u.name}</Text>
                        <Text style={styles.userItemEmail}>{u.email}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={C.textMuted} />
                    </TouchableOpacity>
                  )}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  ListEmptyComponent={
                    <View style={styles.emptyModal}>
                      <Text style={styles.emptyModalText}>Nenhum colaborador encontrado</Text>
                    </View>
                  }
                />
              </>
            ) : (
              <>
                {selectedUser && (
                  <View style={styles.selectedUserBanner}>
                    <View style={styles.userAvatar}>
                      {selectedUser.avatarUrl ? (
                        <Image source={{ uri: selectedUser.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Feather name="user" size={16} color="#9CA3AF" />
                      )}
                    </View>
                    <Text style={styles.selectedUserName}>{selectedUser.name}</Text>
                  </View>
                )}
                <Text style={styles.pickCatLabel}>Selecione a categoria que {selectedUser?.name} irá atender:</Text>
                <ScrollView contentContainerStyle={styles.catGrid} showsVerticalScrollIndicator={false}>
                  {TICKET_CATEGORIES.map((cat) => {
                    const alreadyAssigned = handlers.some(
                      (h) => h.userId === selectedUser?.id && h.category === cat.label
                    );
                    return (
                      <TouchableOpacity
                        key={cat.label}
                        style={[
                          styles.catOptionCard,
                          alreadyAssigned && styles.catOptionAssigned,
                        ]}
                        onPress={() => !alreadyAssigned && addHandler(cat.label)}
                        activeOpacity={alreadyAssigned ? 1 : 0.8}
                      >
                        <View style={[styles.catOptionIcon, { backgroundColor: cat.bg }]}>
                          <Feather name={cat.icon} size={20} color={cat.color} />
                        </View>
                        <Text style={[styles.catOptionText, alreadyAssigned && { color: C.textMuted }]}>{cat.label}</Text>
                        {alreadyAssigned && (
                          <View style={styles.assignedBadge}>
                            <Text style={styles.assignedBadgeText}>já atribuído</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
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
  listContent: { padding: 12, gap: 10 },

  groupCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  groupUserRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  userRole: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  catList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  catChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  emptySubText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "75%", paddingTop: 4 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, backgroundColor: C.inputBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  userItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  userItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  userItemEmail: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emptyModal: { alignItems: "center", paddingTop: 30 },
  emptyModalText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular" },

  selectedUserBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#EFF6FF", borderRadius: 12, margin: 12, padding: 12,
  },
  selectedUserName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },
  pickCatLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
  catGrid: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  catOptionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  catOptionAssigned: { opacity: 0.5 },
  catOptionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catOptionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  assignedBadge: { backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  assignedBadgeText: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_500Medium" },
});
