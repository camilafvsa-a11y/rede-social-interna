import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, ResizeMode } from "expo-av";
import { api } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
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

function MediaMessage({ url, type, isMe }: { url: string; type: string; isMe: boolean }) {
  if (type === "image") {
    return <Image source={{ uri: url }} style={styles.mediaImg} resizeMode="cover" />;
  }
  if (type === "video") {
    return (
      <Video
        source={{ uri: url }}
        style={styles.mediaImg}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        shouldPlay={false}
      />
    );
  }
  if (type === "pdf") {
    return (
      <TouchableOpacity style={[styles.pdfRow, isMe && styles.pdfRowMe]} onPress={() => Linking.openURL(url)} activeOpacity={0.8}>
        <Feather name="file-text" size={18} color={isMe ? "#fff" : "#DC2626"} />
        <Text style={[styles.pdfText, isMe && { color: "#fff" }]}>Ver PDF</Text>
        <Feather name="external-link" size={13} color={isMe ? "rgba(255,255,255,0.7)" : "#9CA3AF"} />
      </TouchableOpacity>
    );
  }
  return null;
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { convId } = useLocalSearchParams<{ convId: string }>();
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: string; filename: string } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 92 : insets.bottom;

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

  useEffect(() => {
    if (convId) {
      api.post(`/dms/${convId}/read`, {}).then(() => refreshUnread()).catch(() => {});
    }
  }, [convId, messages.length]);

  async function pickImage() {
    setShowAttachMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPendingMedia({ uri: asset.uri, type: "image", filename: asset.fileName || `image_${Date.now()}.jpg` });
    }
  }

  async function pickVideo() {
    setShowAttachMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPendingMedia({ uri: asset.uri, type: "video", filename: asset.fileName || `video_${Date.now()}.mp4` });
    }
  }

  async function pickPDF() {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setPendingMedia({ uri: asset.uri, type: "pdf", filename: asset.name || `doc_${Date.now()}.pdf` });
      }
    } catch {
      console.warn("Document picker error");
    }
  }

  async function sendMessage() {
    if (!text.trim() && !pendingMedia) return;
    if (sending || uploading) return;
    setSending(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (pendingMedia) {
        setUploading(true);
        const uploaded = await uploadMedia(pendingMedia.uri, pendingMedia.filename);
        mediaUrl = uploaded.url;
        mediaType = pendingMedia.type;
        setUploading(false);
      }

      await api.post(`/dms/${convId}/messages`, {
        content: text.trim() || null,
        mediaUrl,
        mediaType,
      });
      setText("");
      setPendingMedia(null);
      await refetch();
      refreshUnread();
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.warn("Send error", e);
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  const otherUser = convInfo?.otherUser;

  const allItems: any[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    if (d !== lastDate) {
      allItems.push({ type: "date", date: d, key: `date-${d}` });
      lastDate = d;
    }
    allItems.push({ ...msg, type: "msg" });
  }

  const canSend = (text.trim().length > 0 || !!pendingMedia) && !sending && !uploading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: topPad }]}>
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
                    {item.mediaUrl && item.mediaType && (
                      <MediaMessage url={item.mediaUrl} type={item.mediaType} isMe={isMe} />
                    )}
                    {item.content ? (
                      <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                    ) : null}
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

        {showAttachMenu && (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={pickImage} activeOpacity={0.8}>
              <Feather name="image" size={20} color={C.tint} />
              <Text style={styles.attachOptionText}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickVideo} activeOpacity={0.8}>
              <Feather name="video" size={20} color="#7C3AED" />
              <Text style={[styles.attachOptionText, { color: "#7C3AED" }]}>Vídeo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickPDF} activeOpacity={0.8}>
              <Feather name="file-text" size={20} color="#DC2626" />
              <Text style={[styles.attachOptionText, { color: "#DC2626" }]}>PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingMedia && (
          <View style={styles.pendingMedia}>
            {pendingMedia.type === "image" && (
              <Image source={{ uri: pendingMedia.uri }} style={styles.pendingThumb} />
            )}
            {pendingMedia.type === "video" && (
              <View style={[styles.pendingThumb, styles.pendingVideoThumb]}>
                <Feather name="video" size={18} color="#7C3AED" />
              </View>
            )}
            {pendingMedia.type === "pdf" && (
              <View style={[styles.pendingThumb, styles.pendingPdfThumb]}>
                <Feather name="file-text" size={18} color="#DC2626" />
              </View>
            )}
            <Text style={styles.pendingLabel} numberOfLines={1}>{pendingMedia.filename}</Text>
            <TouchableOpacity onPress={() => setPendingMedia(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(botPad, 12) }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowAttachMenu(!showAttachMenu)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="paperclip" size={20} color={showAttachMenu ? C.tint : C.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={pendingMedia ? "Legenda (opcional)..." : "Mensagem..."}
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            {sending || uploading ? (
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
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, overflow: "hidden" },
  bubbleMe: { backgroundColor: C.tint, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text, lineHeight: 21 },
  bubbleTextMe: { color: "#fff" },
  mediaImg: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  pdfRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  pdfRowMe: {},
  pdfText: { fontSize: 13, color: "#DC2626", fontFamily: "Inter_500Medium" },
  msgMeta: { flexDirection: "row", alignItems: "center", marginTop: 2, marginHorizontal: 4 },
  msgTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  attachMenu: {
    flexDirection: "row", gap: 0,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  attachOption: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6 },
  attachOptionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  pendingMedia: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "#F9FAFB", borderTopWidth: 1, borderTopColor: C.border,
  },
  pendingThumb: { width: 36, height: 36, borderRadius: 6, overflow: "hidden" },
  pendingVideoThumb: { backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  pendingPdfThumb: { backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  pendingLabel: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.2)",
  },
  attachBtn: { paddingBottom: 10, paddingRight: 2 },
  input: {
    flex: 1, maxHeight: 120, borderRadius: 22,
    borderWidth: 1, borderColor: "rgba(60,60,67,0.2)",
    paddingHorizontal: 16, paddingVertical: 11,
    fontFamily: "Inter_400Regular", fontSize: 15, color: C.text,
    backgroundColor: C.surfaceAlt,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    shadowColor: C.tint, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 2,
  },
  sendBtnDisabled: { backgroundColor: "rgba(60,60,67,0.18)", shadowOpacity: 0 },
});
