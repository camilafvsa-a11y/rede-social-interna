import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Platform, Modal, TextInput,
  KeyboardAvoidingView, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function LastMessagePreview({ msg }: { msg: any }) {
  if (!msg) return null;
  if (msg.mediaType === "image") return <Text style={styles.convLast} numberOfLines={1}>📷 Foto</Text>;
  if (msg.mediaType === "video") return <Text style={styles.convLast} numberOfLines={1}>🎥 Vídeo</Text>;
  if (msg.mediaType === "pdf") return <Text style={styles.convLast} numberOfLines={1}>📄 PDF</Text>;
  if (msg.content) return <Text style={styles.convLast} numberOfLines={1}>{msg.content}</Text>;
  return null;
}

function NewConversationModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users"),
    enabled: visible,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users
      .filter((u: any) => u.id !== me?.id)
      .filter((u: any) =>
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.tag?.toLowerCase().includes(q)
      );
  }, [users, search, me?.id]);

  function handleSelect(userId: number) {
    onClose();
    setSearch("");
    router.push(`/messages/with/${userId}` as any);
  }

  function handleClose() {
    setSearch("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKAV}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar colaborador..."
                placeholderTextColor={C.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            {isLoading ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color={C.tint} />
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.modalCenter}>
                <Feather name="users" size={32} color={C.borderLight} />
                <Text style={styles.noResultsText}>
                  {search ? "Nenhum colaborador encontrado" : "Nenhum usuário disponível"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(u) => String(u.id)}
                keyboardShouldPersistTaps="handled"
                style={styles.userList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.userSep} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                    ) : (
                      <View style={styles.userAvatarFallback}>
                        <Feather name="user" size={18} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      {item.tag ? (
                        <Text style={styles.userTag}>@{item.tag}</Text>
                      ) : (
                        <Text style={styles.userTag}>{item.role === "admin" ? "Admin" : item.role === "master_admin" ? "Master Admin" : "Colaborador"}</Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={16} color={C.border} />
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [showNewConv, setShowNewConv] = useState(false);
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["dms"],
    queryFn: () => api.get("/dms"),
    refetchInterval: 15_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c: any) =>
      c.otherUser?.name?.toLowerCase().includes(q) ||
      c.lastMessage?.content?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const totalUnread = conversations.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Mensagens</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => setShowNewConv(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={20} color={C.tint} />
        </TouchableOpacity>
      </View>

      {conversations.length > 2 && (
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar conversa..."
            placeholderTextColor={C.textMuted}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          {search ? (
            <>
              <Feather name="search" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma conversa encontrada</Text>
              <Text style={styles.emptyText}>Tente um nome diferente</Text>
            </>
          ) : (
            <>
              <Feather name="send" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
              <Text style={styles.emptyText}>Toque em ✏️ para iniciar uma nova conversa</Text>
              <TouchableOpacity style={styles.newConvBtn} onPress={() => setShowNewConv(true)} activeOpacity={0.8}>
                <Feather name="edit-2" size={16} color="#fff" />
                <Text style={styles.newConvBtnText}>Nova Conversa</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 118 : 20 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const name = item.otherUser?.name || "Usuário";
            const initials = getInitials(name);
            const hasUnread = item.unreadCount > 0;

            return (
              <TouchableOpacity
                style={[styles.convRow, hasUnread && styles.convRowUnread]}
                onPress={() => router.push(`/messages/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.avatarWrap}>
                  {item.otherUser?.avatarUrl ? (
                    <Image source={{ uri: item.otherUser.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                  {hasUnread && <View style={styles.unreadDot} />}
                </View>

                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={[styles.convName, hasUnread && styles.convNameBold]} numberOfLines={1}>
                      {name}
                    </Text>
                    {item.lastMessage && (
                      <Text style={[styles.convTime, hasUnread && styles.convTimeUnread]}>
                        {timeAgo(item.lastMessage.createdAt)}
                      </Text>
                    )}
                  </View>
                  {(item.otherUser?.position || item.otherUser?.sector) && !item.lastMessage && (
                    <Text style={styles.convRole} numberOfLines={1}>
                      {[item.otherUser.position, item.otherUser.sector].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                  <LastMessagePreview msg={item.lastMessage} />
                </View>

                {hasUnread ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                  </View>
                ) : (
                  <Feather name="chevron-right" size={16} color={C.borderLight} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <NewConversationModal visible={showNewConv} onClose={() => setShowNewConv(false)} />
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
  headerTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  headerBadge: { backgroundColor: C.tint, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  headerBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  composeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: C.inputBorder,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, padding: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center" },
  newConvBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  newConvBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  separator: { height: 1, backgroundColor: C.borderLight, marginLeft: 76 },
  convRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surface,
  },
  convRowUnread: { backgroundColor: "#FAFCFF" },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.border },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.tint },
  unreadDot: {
    position: "absolute", bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.tint, borderWidth: 2, borderColor: C.surface,
  },
  convInfo: { flex: 1, overflow: "hidden" },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text, flex: 1, marginRight: 8 },
  convNameBold: { fontFamily: "Inter_700Bold" },
  convTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, flexShrink: 0 },
  convTimeUnread: { color: C.tint, fontFamily: "Inter_600SemiBold" },
  convRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textMuted, marginTop: 1 },
  convLast: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalKAV: { justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: "80%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center", marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: C.inputBorder,
  },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    color: C.text, padding: 0,
  },
  modalCenter: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  noResultsText: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  userList: { maxHeight: 400 },
  userSep: { height: 1, backgroundColor: C.borderLight, marginLeft: 70 },
  userRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  userAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.border },
  userAvatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  userTag: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 1 },
});
