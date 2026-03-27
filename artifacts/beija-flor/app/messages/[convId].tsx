import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import Colors from "@/constants/colors";

const C = Colors.light;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: messages = [], isLoading: msgsLoading, refetch } = useQuery<any[]>({
    queryKey: ["dm-messages", convId],
    queryFn: () => api.get(`/dms/${convId}/messages`),
    refetchInterval: 5_000,
    enabled: !!convId,
  });

  const { data: convInfo } = useQuery({
    queryKey: ["dm-conv-info", convId],
    queryFn: () => api.get("/dms").then((convs: any[]) => convs.find((c: any) => String(c.id) === String(convId))),
  });

  // Mark as read when screen opens and when new messages arrive
  useEffect(() => {
    if (convId) {
      api.post(`/dms/${convId}/read`, {}).then(() => refreshUnread()).catch(() => {});
    }
  }, [convId, messages.length]);

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/dms/${convId}/messages`, { content: text.trim() });
      setText("");
      await refetch();
      refreshUnread();
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.warn("Send error", e);
    } finally {
      setSending(false);
    }
  }

  const otherUser = convInfo?.otherUser;

  // Group messages by date
  const grouped: { type: "date"; date: string } | any = [];
  let lastDate = "";
  const allItems: any[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      allItems.push({ type: "date", date: d, key: `date-${d}` });
      lastDate = d;
    }
    allItems.push({ ...msg, type: "msg" });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={24} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerUser}
            onPress={() => otherUser && router.push(`/profile/${otherUser.id}` as any)}
            activeOpacity={0.7}
          >
            {otherUser?.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Feather name="user" size={16} color="#9CA3AF" />
              </View>
            )}
            <Text style={styles.headerName}>{otherUser?.name || "Conversa"}</Text>
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>

        {/* Messages */}
        {msgsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.tint} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={allItems}
            keyExtractor={(item) => item.id ? String(item.id) : item.key}
            contentContainerStyle={{ padding: 12, paddingBottom: 8 + botPad }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
                <Text style={styles.emptyHint}>Diga olá!</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === "date") {
                return (
                  <View style={styles.dateDivider}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateLabel}>{item.date}</Text>
                    <View style={styles.dateLine} />
                  </View>
                );
              }
              const isMe = item.senderId === user?.id;
              return (
                <View style={[styles.msgWrap, isMe ? styles.msgRight : styles.msgLeft]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                  </View>
                  <View style={[styles.msgMeta, isMe ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
                    <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
                    {isMe && (
                      <Feather
                        name={item.readAt ? "check-circle" : "check"}
                        size={10}
                        color={item.readAt ? C.tint : C.textMuted}
                        style={{ marginLeft: 3 }}
                      />
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(botPad, 12) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Mensagem..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerUser: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginHorizontal: 8 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.textSecondary },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textMuted },
  dateDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  dateLine: { flex: 1, height: 1, backgroundColor: C.borderLight },
  dateLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  msgWrap: { marginBottom: 4 },
  msgLeft: { alignItems: "flex-start" },
  msgRight: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "78%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
  },
  bubbleMe: { backgroundColor: C.tint, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text, lineHeight: 21 },
  bubbleTextMe: { color: "#fff" },
  msgMeta: { flexDirection: "row", alignItems: "center", marginTop: 2, marginHorizontal: 4 },
  msgTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  input: {
    flex: 1, maxHeight: 120, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: "Inter_400Regular", fontSize: 15, color: C.text,
    backgroundColor: C.background,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.border },
});
