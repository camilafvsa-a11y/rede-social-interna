import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Image, FlatList, Modal, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { api } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;
const MAX_IMAGES = 6;

const CATEGORIES = [
  { key: null,            label: "Sem categoria" },
  { key: "comunicacao",   label: "📢 Comunicação" },
  { key: "rh",            label: "👥 RH" },
  { key: "seguranca",     label: "🦺 Segurança" },
  { key: "lideranca",     label: "⭐ Liderança" },
  { key: "campanhas",     label: "🎯 Campanhas" },
  { key: "reconhecimento",label: "🏅 Reconhecimento" },
  { key: "avisos",        label: "⚠️ Avisos" },
  { key: "geral",         label: "💬 Geral" },
];

interface MediaItem {
  uri: string;
  isVideo: boolean;
}

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [isOfficial, setIsOfficial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [internalCommConfirm, setInternalCommConfirm] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);

  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  const { data: allChannels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });
  // Non-admins cannot see or select internal comm channels
  const channels = (allChannels as any[]).filter((ch: any) => isAdmin || !ch.isInternalComm);
  const selectedChannel = (allChannels as any[]).find((ch: any) => ch.id === channelId) ?? null;
  const isInternalCommSelected = selectedChannel?.isInternalComm ?? false;
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["users-brief"],
    queryFn: () => api.get("/users"),
    staleTime: 60_000,
  });
  const { data: canPostData } = useQuery({
    queryKey: ["can-post", channelId],
    queryFn: () => channelId ? api.get(`/channels/${channelId}/can-post`) : Promise.resolve({ canPost: false }),
    enabled: !!channelId,
  });
  const canPost = !channelId || canPostData?.canPost;

  const mentionSuggestions = mentionQuery !== null
    ? (allUsers as any[]).filter((u) => u.name?.toLowerCase().includes(mentionQuery!.toLowerCase())).slice(0, 6)
    : [];

  function handleContentChange(text: string) {
    setContent(text);
    const lastAt = text.lastIndexOf("@");
    if (lastAt === -1) { setMentionQuery(null); setMentionStart(-1); return; }
    const afterAt = text.slice(lastAt + 1);
    if (afterAt.includes(" ") || afterAt.includes("\n")) { setMentionQuery(null); setMentionStart(-1); }
    else { setMentionQuery(afterAt); setMentionStart(lastAt); }
  }

  function insertMention(u: any) {
    if (mentionStart < 0) return;
    const before = content.slice(0, mentionStart);
    const after = content.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setContent(`${before}@${u.name} ${after}`);
    setMentionQuery(null); setMentionStart(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function pickImages() {
    if (mediaItems.length >= MAX_IMAGES) {
      Alert.alert("Limite", `Máximo de ${MAX_IMAGES} imagens por post.`); return;
    }
    const remaining = MAX_IMAGES - mediaItems.filter((m) => !m.isVideo).length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (!result.canceled) {
      const newItems = result.assets.map((a) => ({ uri: a.uri, isVideo: false }));
      setMediaItems((prev) => [...prev, ...newItems].slice(0, MAX_IMAGES));
    }
  }

  async function pickVideo() {
    const hasVideo = mediaItems.some((m) => m.isVideo);
    if (hasVideo) { Alert.alert("Atenção", "Só é possível adicionar um vídeo por post."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoMaxDuration: 120,
    });
    if (!result.canceled) {
      setMediaItems((prev) => [...prev, { uri: result.assets[0].uri, isVideo: true }]);
    }
  }

  function removeMedia(idx: number) {
    setMediaItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    if (!content.trim() && mediaItems.length === 0) {
      Alert.alert("Atenção", "Adicione um texto ou mídia antes de postar."); return;
    }
    if (!channelId) { Alert.alert("Atenção", "Selecione um canal."); return; }
    // If posting to internal comm channel, show confirmation first
    if (isInternalCommSelected) {
      setInternalCommConfirm(true);
      return;
    }
    performSubmit();
  }

  async function performSubmit() {
    setInternalCommConfirm(false);
    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      const uploadedMedia: Array<{ url: string; type: "image" | "video" }> = [];

      for (const item of mediaItems) {
        const ext = item.isVideo ? "mp4" : "jpg";
        const filename = `post_${item.isVideo ? "video" : "image"}_${Date.now()}.${ext}`;
        const uploaded = await uploadMedia(item.uri, filename);
        if (item.isVideo) {
          videoUrl = uploaded.url;
          uploadedMedia.push({ url: uploaded.url, type: "video" });
        } else {
          if (!imageUrl) imageUrl = uploaded.url;
          uploadedMedia.push({ url: uploaded.url, type: "image" });
        }
      }

      await api.post("/posts", {
        content: content.trim() || null,
        imageUrl,
        videoUrl,
        channelId,
        category: category || null,
        isOfficial: isOfficial && isAdmin ? true : undefined,
        media: uploadedMedia.length > 1 ? uploadedMedia : undefined,
      });

      qc.invalidateQueries({ queryKey: ["posts-todos"] });
      qc.invalidateQueries({ queryKey: ["posts-comunicacao"] });
      qc.invalidateQueries({ queryKey: ["posts-fotos"] });
      qc.invalidateQueries({ queryKey: ["posts-videos"] });
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const selectedCategoryLabel = CATEGORIES.find((c) => c.key === category)?.label || "Categoria";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nova publicação</Text>
        <TouchableOpacity
          style={[styles.postBtn, ((!content.trim() && mediaItems.length === 0) || !channelId || !canPost || loading) && styles.postBtnDisabled]}
          onPress={submit}
          disabled={(!content.trim() && mediaItems.length === 0) || !channelId || !canPost || loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Publicar</Text>}
        </TouchableOpacity>
      </View>

      {/* Mention dropdown */}
      {mentionSuggestions.length > 0 && (
        <View style={styles.mentionDropdown}>
          <FlatList
            data={mentionSuggestions}
            keyExtractor={(u: any) => String(u.id)}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.mentionItem} onPress={() => insertMention(item)} activeOpacity={0.75}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.mentionAvatar} />
                ) : (
                  <View style={[styles.mentionAvatar, styles.mentionAvatarFallback]}>
                    <Feather name="user" size={14} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentionName}>{item.name}</Text>
                  {item.tag && <Text style={styles.mentionTag}>{item.tag}</Text>}
                </View>
                <Feather name="corner-down-left" size={14} color={C.textMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">

        {/* Author row */}
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={StyleSheet.absoluteFill as any} />
            ) : (
              <Text style={styles.authorInitial}>{user?.name?.[0]?.toUpperCase() || "U"}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{user?.name}</Text>
            <Text style={[styles.authorSub, isInternalCommSelected && styles.authorSubOfficial]}>
              {isInternalCommSelected ? "📢 Publicação Oficial — Comunicação Interna" : "Publicando agora"}
            </Text>
          </View>
        </View>

        <View style={styles.inputHint}>
          <Feather name="at-sign" size={12} color={C.textMuted} />
          <Text style={styles.inputHintText}>Digite @ para mencionar alguém</Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={content}
          onChangeText={handleContentChange}
          placeholder="O que você está pensando?"
          placeholderTextColor={C.placeholder}
          multiline
          autoFocus
          maxLength={2000}
        />
        <Text style={styles.charCount}>{content.length}/2000</Text>

        {/* Multi-media previews */}
        {mediaItems.length > 0 && (
          <View style={styles.mediaGrid}>
            {mediaItems.map((item, idx) => (
              <View key={idx} style={[styles.mediaThumb, mediaItems.length === 1 && styles.mediaThumbFull]}>
                {item.isVideo ? (
                  <Video source={{ uri: item.uri }} style={StyleSheet.absoluteFill as any} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                ) : (
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                )}
                <View style={styles.mediaTypeTag}>
                  <Feather name={item.isVideo ? "video" : "image"} size={11} color="#fff" />
                </View>
                <TouchableOpacity style={styles.removeMedia} onPress={() => removeMedia(idx)}>
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Media buttons */}
        <View style={styles.mediaButtons}>
          {!mediaItems.some((m) => m.isVideo) && (
            <TouchableOpacity style={styles.mediaBtn} onPress={pickImages} activeOpacity={0.8}>
              <Feather name="image" size={18} color={C.tint} />
              <Text style={styles.mediaBtnText}>
                {mediaItems.length === 0 ? "Adicionar foto" : `+Foto (${mediaItems.filter((m) => !m.isVideo).length}/${MAX_IMAGES})`}
              </Text>
            </TouchableOpacity>
          )}
          {mediaItems.filter((m) => !m.isVideo).length === 0 && (
            <TouchableOpacity style={[styles.mediaBtn, styles.mediaBtnVideo]} onPress={pickVideo} activeOpacity={0.8}>
              <Feather name="video" size={18} color="#7C3AED" />
              <Text style={[styles.mediaBtnText, { color: "#7C3AED" }]}>Adicionar vídeo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Options row */}
        <View style={styles.optionsRow}>
          {/* Category picker */}
          <TouchableOpacity style={styles.optionChip} onPress={() => setCategoryOpen((o) => !o)} activeOpacity={0.8}>
            <Feather name="tag" size={14} color={category ? C.tint : C.textMuted} />
            <Text style={[styles.optionChipText, category && { color: C.tint }]}>{selectedCategoryLabel}</Text>
            <Feather name={categoryOpen ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
          </TouchableOpacity>

          {/* Official toggle (admin only) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.optionChip, isOfficial && styles.optionChipActive]}
              onPress={() => setIsOfficial((v) => !v)}
              activeOpacity={0.8}
            >
              <Feather name="shield" size={14} color={isOfficial ? C.tint : C.textMuted} />
              <Text style={[styles.optionChipText, isOfficial && { color: C.tint }]}>Oficial</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category dropdown */}
        {categoryOpen && (
          <View style={styles.categoryDropdown}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={String(cat.key)}
                style={[styles.categoryOption, category === cat.key && styles.categoryOptionActive]}
                onPress={() => { setCategory(cat.key); setCategoryOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryOptionText, category === cat.key && styles.categoryOptionTextActive]}>
                  {cat.label}
                </Text>
                {category === cat.key && <Feather name="check" size={15} color={C.tint} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Channel selector */}
        <Text style={styles.sectionLabel}>Selecionar canal *</Text>

        {/* Internal comm channels (admin only) — shown first with special visual */}
        {isAdmin && (channels as any[]).some((ch: any) => ch.isInternalComm) && (
          <>
            <View style={styles.channelSectionHeader}>
              <Feather name="shield" size={13} color={C.tint} />
              <Text style={styles.channelSectionHeaderText}>Canais Oficiais</Text>
            </View>
            <View style={styles.channelGrid}>
              {(channels as any[]).filter((ch: any) => ch.isInternalComm).map((ch: any) => {
                const active = channelId === ch.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.channelChip, styles.channelChipOfficial, active && styles.channelChipOfficialSelected]}
                    onPress={() => setChannelId(ch.id)}
                    activeOpacity={0.8}
                  >
                    <Feather name="shield" size={14} color={active ? "#fff" : C.tint} />
                    <Text style={[styles.channelChipText, { color: active ? "#fff" : C.tint }]}>{ch.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.channelSectionHeader}>
              <Feather name="hash" size={13} color={C.textMuted} />
              <Text style={[styles.channelSectionHeaderText, { color: C.textMuted }]}>Outros canais</Text>
            </View>
          </>
        )}

        <View style={styles.channelGrid}>
          {(channels as any[]).filter((ch: any) => !ch.isInternalComm).map((ch: any) => (
            <TouchableOpacity
              key={ch.id}
              style={[styles.channelChip, channelId === ch.id && styles.channelChipSelected]}
              onPress={() => setChannelId(ch.id)}
              activeOpacity={0.8}
            >
              <Feather name={(ch.icon || "hash") as any} size={14} color={channelId === ch.id ? "#fff" : C.textSecondary} />
              <Text style={[styles.channelChipText, channelId === ch.id && { color: "#fff" }]}>{ch.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Internal comm banner warning */}
        {isInternalCommSelected && (
          <View style={styles.internalCommBanner}>
            <Feather name="alert-circle" size={15} color="#1D4ED8" />
            <Text style={styles.internalCommBannerText}>
              Este é um canal oficial. A publicação será visível para todos os usuários.
            </Text>
          </View>
        )}

        {channelId && !canPost && (
          <View style={styles.noPermission}>
            <Feather name="lock" size={16} color={C.warning} />
            <Text style={styles.noPermissionText}>Você não tem permissão para postar neste canal</Text>
          </View>
        )}
      </ScrollView>

      {/* Internal comm confirmation modal */}
      <Modal
        visible={internalCommConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setInternalCommConfirm(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setInternalCommConfirm(false)}>
          <Pressable style={styles.confirmBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmIconWrap}>
              <Feather name="shield" size={30} color={C.tint} />
            </View>
            <Text style={styles.confirmTitle}>Publicação Oficial</Text>
            <Text style={styles.confirmDesc}>
              Você está publicando no canal{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{selectedChannel?.name ?? "Comunicação Interna"}</Text>.{"\n\n"}
              Este é um canal oficial e institucional visível para{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>todos os usuários</Text> do app.
              Deseja confirmar a publicação?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setInternalCommConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPublishBtn}
                onPress={performSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={styles.confirmPublishText}>Confirmar publicação</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  postBtn: { backgroundColor: C.tint, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, minWidth: 70, alignItems: "center" },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  mentionDropdown: {
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, maxHeight: 240,
  },
  mentionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  mentionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", overflow: "hidden" },
  mentionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  mentionName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  mentionTag: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  content: { padding: 16, gap: 12 },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  authorAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.tint,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  authorInitial: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  authorName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  authorSub: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 1 },

  inputHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  inputHintText: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },

  textInput: { fontSize: 17, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 24, minHeight: 100, textAlignVertical: "top" },
  charCount: { fontSize: 12, color: C.textMuted, textAlign: "right", fontFamily: "Inter_400Regular" },

  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mediaThumb: {
    width: "31%", aspectRatio: 1, borderRadius: 10, overflow: "hidden",
    backgroundColor: "#F3F4F6", position: "relative",
  },
  mediaThumbFull: { width: "100%", aspectRatio: 16 / 9 },
  mediaTypeTag: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 6, padding: 3,
  },
  removeMedia: {
    position: "absolute", top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
  },

  mediaButtons: { flexDirection: "row", gap: 8 },
  mediaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BFDBFE",
  },
  mediaBtnVideo: { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
  mediaBtnText: { fontSize: 14, color: C.tint, fontFamily: "Inter_500Medium" },

  optionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  optionChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  optionChipActive: { borderColor: C.tint, backgroundColor: "#EFF6FF" },
  optionChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },

  categoryDropdown: {
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    overflow: "hidden", backgroundColor: C.surface,
  },
  categoryOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  categoryOptionActive: { backgroundColor: "#EFF6FF" },
  categoryOptionText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  categoryOptionTextActive: { color: C.tint, fontFamily: "Inter_700Bold" },

  authorSubOfficial: { color: C.tint, fontFamily: "Inter_600SemiBold" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  channelSectionHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6, marginTop: 4 },
  channelSectionHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.tint, textTransform: "uppercase", letterSpacing: 0.5 },
  channelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  channelChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  channelChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  channelChipOfficial: { borderColor: C.tint, backgroundColor: "#EFF6FF" },
  channelChipOfficialSelected: { backgroundColor: C.tint, borderColor: C.tint },
  channelChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  noPermission: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12 },
  noPermissionText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular", flex: 1 },

  internalCommBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.tint,
  },
  internalCommBannerText: { flex: 1, fontSize: 13, color: "#1D4ED8", fontFamily: "Inter_500Medium", lineHeight: 18 },

  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmBox: {
    backgroundColor: C.surface, borderRadius: 20, padding: 24,
    width: "100%", maxWidth: 360, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  confirmIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  confirmTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 10 },
  confirmDesc: {
    fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 21, marginBottom: 22,
  },
  confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.surfaceAlt, alignItems: "center",
  },
  confirmCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  confirmPublishBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 13, borderRadius: 12, backgroundColor: C.tint,
  },
  confirmPublishText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
