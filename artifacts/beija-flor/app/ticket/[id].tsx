import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
  Linking,
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
import Colors from "@/constants/colors";

const C = Colors.light;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: "Aberto",         color: "#166534", bg: "#DCFCE7" },
  in_progress: { label: "Em Atendimento", color: "#92400E", bg: "#FEF3C7" },
  closed:      { label: "Resolvido",      color: "#6B7280", bg: "#F3F4F6" },
};

const STATUS_FLOW: Record<string, { next: string; label: string; color: string; bg: string }> = {
  open:        { next: "in_progress", label: "Iniciar Atendimento", color: "#92400E", bg: "#FEF3C7" },
  in_progress: { next: "closed",      label: "Marcar Resolvido",    color: "#6B7280", bg: "#F3F4F6" },
  closed:      { next: "open",        label: "Reabrir Chamado",     color: "#166534", bg: "#DCFCE7" },
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

function MediaBubble({ url, type }: { url: string; type: string }) {
  if (type === "image") {
    return <Image source={{ uri: url }} style={styles.bubbleMedia} resizeMode="cover" />;
  }
  if (type === "video") {
    return (
      <Video
        source={{ uri: url }}
        style={styles.bubbleMedia}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        shouldPlay={false}
      />
    );
  }
  if (type === "pdf") {
    return (
      <TouchableOpacity style={styles.pdfBubble} onPress={() => Linking.openURL(url)} activeOpacity={0.8}>
        <Feather name="file-text" size={20} color="#DC2626" />
        <Text style={styles.pdfLabel}>Ver PDF</Text>
        <Feather name="external-link" size={14} color="#9CA3AF" />
      </TouchableOpacity>
    );
  }
  return null;
}

export default function TicketScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const flatRef = useRef<FlatList>(null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const { data: ticket, isLoading, refetch: refetchTicket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.get(`/tickets/${id}`),
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ["ticket-messages", id],
    queryFn: () => api.get(`/tickets/${id}/messages`),
    enabled: !!id,
  });

  useEffect(() => {
    if (id) {
      api.post(`/tickets/${id}/read`, {}).catch(() => {});
    }
  }, [id]);

  const canManage = user?.role === "admin" || user?.role === "master_admin";

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
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  }

  async function sendMessage() {
    if (!message.trim() && !pendingMedia) return;
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

      await api.post(`/tickets/${id}/messages`, {
        content: message.trim() || null,
        mediaUrl,
        mediaType,
      });
      setMessage("");
      setPendingMedia(null);
      await refetchMessages();
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  async function advanceStatus() {
    if (!ticket) return;
    const flow = STATUS_FLOW[ticket.status];
    if (!flow) return;
    setChangingStatus(true);
    try {
      await api.patch(`/tickets/${id}`, { status: flow.next });
      await refetchTicket();
      await qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setChangingStatus(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const sc = ticket ? (STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open) : STATUS_CONFIG.open;
  const flow = ticket ? STATUS_FLOW[ticket.status] : null;
  const canSend = (message.trim().length > 0 || !!pendingMedia) && !sending;

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
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item: any) => String(item.id)}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
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

              {ticket.assignedTo && (
                <View style={styles.delegatedRow}>
                  <Feather name="user-check" size={13} color="#059669" />
                  <Text style={styles.delegatedText}>Delegado para: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{ticket.assignedTo.name}</Text></Text>
                </View>
              )}

              {canManage && flow && (
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: flow.bg }]}
                  onPress={advanceStatus}
                  disabled={changingStatus}
                  activeOpacity={0.8}
                >
                  {changingStatus ? (
                    <ActivityIndicator size="small" color={flow.color} />
                  ) : (
                    <>
                      <Feather name="arrow-right-circle" size={15} color={flow.color} />
                      <Text style={[styles.statusActionText, { color: flow.color }]}>{flow.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

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
                    <Feather name="user" size={14} color="#9CA3AF" />
                  )}
                </View>
              )}
              <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                {!isMe && <Text style={styles.msgAuthor}>{item.author?.name}</Text>}
                {item.mediaUrl && item.mediaType && (
                  <MediaBubble url={item.mediaUrl} type={item.mediaType} />
                )}
                {item.content ? (
                  <Text style={[styles.msgContent, isMe && { color: "#fff" }]}>{item.content}</Text>
                ) : null}
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
              <Feather name="video" size={20} color="#7C3AED" />
            </View>
          )}
          {pendingMedia.type === "pdf" && (
            <View style={[styles.pendingThumb, styles.pendingPdfThumb]}>
              <Feather name="file-text" size={20} color="#DC2626" />
            </View>
          )}
          <Text style={styles.pendingLabel} numberOfLines={1}>{pendingMedia.filename}</Text>
          <TouchableOpacity onPress={() => setPendingMedia(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.composer, { paddingBottom: Platform.OS === "web" ? 92 : insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => setShowAttachMenu(!showAttachMenu)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="paperclip" size={20} color={showAttachMenu ? C.tint : C.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder={pendingMedia ? "Legenda (opcional)..." : "Escreva uma mensagem..."}
          placeholderTextColor={C.placeholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!canSend}
        >
          {sending || uploading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
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
  ticketMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  metaText: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 12, color: C.textMuted },
  delegatedRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  delegatedText: { fontSize: 13, color: "#059669", fontFamily: "Inter_400Regular" },
  statusActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 10, paddingVertical: 10, marginBottom: 4,
  },
  statusActionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  messagesLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  listContent: { paddingBottom: 20 },
  msgRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  msgAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  msgBubble: { maxWidth: "75%", borderRadius: 16, padding: 10 },
  msgBubbleOther: { backgroundColor: C.surface, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: C.tint, borderBottomRightRadius: 4 },
  msgAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 2 },
  msgContent: { fontSize: 14, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  msgTime: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 4, alignSelf: "flex-end" },
  bubbleMedia: { width: 200, height: 150, borderRadius: 8, marginBottom: 6 },
  pdfBubble: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8, marginBottom: 6 },
  pdfLabel: { flex: 1, fontSize: 13, color: "#DC2626", fontFamily: "Inter_500Medium" },
  noMessages: { padding: 20, alignItems: "center" },
  noMessagesText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  attachMenu: {
    flexDirection: "row", gap: 0,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  attachOption: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 8 },
  attachOptionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  pendingMedia: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "#F9FAFB", borderTopWidth: 1, borderTopColor: C.border,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: 6, overflow: "hidden" },
  pendingVideoThumb: { backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  pendingPdfThumb: { backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  pendingLabel: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  composer: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
  },
  attachBtn: { paddingBottom: 10, paddingRight: 4 },
  input: {
    flex: 1, backgroundColor: C.inputBg, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: C.text, maxHeight: 80,
    borderColor: C.border, fontFamily: "Inter_400Regular",
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
