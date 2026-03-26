import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Aberto", color: "#166534", bg: "#DCFCE7" },
  in_progress: { label: "Em andamento", color: "#92400E", bg: "#FEF3C7" },
  closed: { label: "Encerrado", color: "#6B7280", bg: "#F3F4F6" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString("pt-BR");
}

export default function TicketScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: ticket, isLoading, refetch: refetchTicket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.get(`/tickets/${id}`),
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ["ticket-messages", id],
    queryFn: () => api.get(`/tickets/${id}/messages`),
    enabled: !!id,
  });

  const canManage = user?.role === "admin" || user?.role === "master_admin";

  async function sendMessage() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, { content: message.trim() });
      setMessage("");
      await refetchMessages();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status: string) {
    try {
      await api.patch(`/tickets/${id}`, { status });
      await refetchTicket();
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const sc = ticket ? STATUS_CONFIG[ticket.status] : STATUS_CONFIG.open;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Chamado #{id}</Text>
        {canManage && ticket && (
          <TouchableOpacity
            onPress={() => {
              const options = Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== ticket.status)
                .map(([key, val]) => ({ text: val.label, onPress: () => updateStatus(key) }));
              Alert.alert("Alterar status", "Selecione o novo status:", [...options, { text: "Cancelar", style: "cancel" }] as any);
            }}
          >
            <Feather name="edit-2" size={20} color={C.tint} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item: any) => String(item.id)}
        ListHeaderComponent={
          ticket ? (
            <View style={styles.ticketInfo}>
              <View style={styles.titleRow}>
                <Text style={styles.ticketTitle}>{ticket.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>
              <Text style={styles.ticketCategory}>{ticket.category}</Text>
              <Text style={styles.ticketDesc}>{ticket.description}</Text>
              <View style={styles.ticketMeta}>
                <Text style={styles.metaText}>Por {ticket.author?.name}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{timeAgo(ticket.createdAt)}</Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.messagesLabel}>Mensagens</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isMe = item.authorId === user?.id;
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              {!isMe && (
                <View style={styles.msgAvatar}>
                  {item.author?.avatarUrl ? (
                    <Image source={{ uri: item.author.avatarUrl }} style={styles.msgAvatarImg} />
                  ) : (
                    <Text style={styles.msgAvatarInitial}>{item.author?.name?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
              )}
              <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                {!isMe && <Text style={styles.msgAuthor}>{item.author?.name}</Text>}
                <Text style={[styles.msgContent, isMe && { color: "#fff" }]}>{item.content}</Text>
                <Text style={[styles.msgTime, isMe && { color: "rgba(255,255,255,0.7)" }]}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.noMessages}>
            <Text style={styles.noMessagesText}>Nenhuma mensagem ainda. Inicie a conversa!</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <ActivityIndicator style={{ margin: 20 }} color={C.tint} />}

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={C.placeholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!message.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  ticketInfo: { padding: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  ticketTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  ticketCategory: { fontSize: 13, color: C.tint, fontFamily: "Inter_500Medium", marginBottom: 8 },
  ticketDesc: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 8 },
  ticketMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 12, color: C.textMuted },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  messagesLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  listContent: { paddingBottom: 20 },
  msgRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  msgAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  msgAvatarInitial: { color: "#1E3A8A", fontSize: 12, fontFamily: "Inter_700Bold" },
  msgBubble: { maxWidth: "75%", borderRadius: 16, padding: 10 },
  msgBubbleOther: { backgroundColor: C.surface, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: C.tint, borderBottomRightRadius: 4 },
  msgAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 2 },
  msgContent: { fontSize: 14, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  msgTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 4, alignSelf: "flex-end" },
  noMessages: { padding: 20, alignItems: "center" },
  noMessagesText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  composer: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  input: {
    flex: 1, backgroundColor: C.inputBg, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: C.text, maxHeight: 80,
    borderColor: C.border, fontFamily: "Inter_400Regular",
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
