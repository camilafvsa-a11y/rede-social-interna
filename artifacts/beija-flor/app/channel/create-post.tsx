import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Image, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { api } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const [content, setContent] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

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
    ? allUsers.filter((u: any) =>
        u.name?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  function handleContentChange(text: string) {
    setContent(text);
    const lastAt = text.lastIndexOf("@");
    if (lastAt === -1) { setMentionQuery(null); setMentionStart(-1); return; }
    const afterAt = text.slice(lastAt + 1);
    if (afterAt.includes(" ") || afterAt.includes("\n")) {
      setMentionQuery(null); setMentionStart(-1);
    } else {
      setMentionQuery(afterAt); setMentionStart(lastAt);
    }
  }

  function insertMention(user: any) {
    if (mentionStart < 0) return;
    const before = content.slice(0, mentionStart);
    const after = content.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setContent(`${before}@${user.name} ${after}`);
    setMentionQuery(null);
    setMentionStart(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMediaIsVideo(false);
    }
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoMaxDuration: 120,
    });
    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMediaIsVideo(true);
    }
  }

  function clearMedia() {
    setMediaUri(null);
    setMediaIsVideo(false);
  }

  async function submit() {
    if (!content.trim()) { Alert.alert("Atenção", "Escreva algo antes de postar."); return; }
    if (!channelId) { Alert.alert("Atenção", "Selecione um canal."); return; }
    setLoading(true);
    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (mediaUri) {
        const filename = mediaIsVideo
          ? `post_video_${Date.now()}.mp4`
          : `post_image_${Date.now()}.jpg`;
        const uploaded = await uploadMedia(mediaUri, filename);
        if (mediaIsVideo) videoUrl = uploaded.url;
        else imageUrl = uploaded.url;
      }

      await api.post("/posts", { content: content.trim(), imageUrl, videoUrl, channelId });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts", String(channelId)] });
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nova publicação</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!content.trim() || !channelId || !canPost || loading) && styles.postBtnDisabled]}
          onPress={submit}
          disabled={!content.trim() || !channelId || !canPost || loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>Publicar</Text>}
        </TouchableOpacity>
      </View>

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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
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
          maxLength={1000}
        />
        <Text style={styles.charCount}>{content.length}/1000</Text>

        {mediaUri && (
          <View style={styles.mediaPreview}>
            {mediaIsVideo ? (
              <Video
                source={{ uri: mediaUri }}
                style={styles.previewVideo}
                resizeMode={ResizeMode.COVER}
                useNativeControls
                shouldPlay={false}
              />
            ) : (
              <Image source={{ uri: mediaUri }} style={styles.previewImg} resizeMode="cover" />
            )}
            <TouchableOpacity style={styles.removeMedia} onPress={clearMedia}>
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {!mediaUri && (
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaBtn} onPress={pickImage} activeOpacity={0.8}>
              <Feather name="image" size={18} color={C.tint} />
              <Text style={styles.mediaBtnText}>Adicionar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mediaBtn, styles.mediaBtnVideo]} onPress={pickVideo} activeOpacity={0.8}>
              <Feather name="video" size={18} color="#7C3AED" />
              <Text style={[styles.mediaBtnText, { color: "#7C3AED" }]}>Adicionar vídeo</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionLabel}>Selecionar canal *</Text>
        <View style={styles.channelGrid}>
          {channels.map((ch: any) => (
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

        {channelId && !canPost && (
          <View style={styles.noPermission}>
            <Feather name="lock" size={16} color={C.warning} />
            <Text style={styles.noPermissionText}>Você não tem permissão para postar neste canal</Text>
          </View>
        )}
      </ScrollView>
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
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  mentionDropdown: {
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    maxHeight: 240,
  },
  mentionItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  mentionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6" },
  mentionAvatarFallback: { alignItems: "center", justifyContent: "center" },
  mentionName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  mentionTag: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },

  inputHint: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: -6 },
  inputHintText: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },

  content: { padding: 16, gap: 12 },
  textInput: {
    fontSize: 17, color: C.text, fontFamily: "Inter_400Regular",
    lineHeight: 24, minHeight: 120, textAlignVertical: "top",
  },
  charCount: { fontSize: 12, color: C.textMuted, textAlign: "right", fontFamily: "Inter_400Regular" },

  mediaPreview: { borderRadius: 12, overflow: "hidden", position: "relative" },
  previewImg: { width: "100%", height: 200, borderRadius: 12 },
  previewVideo: { width: "100%", height: 200, borderRadius: 12 },
  removeMedia: {
    position: "absolute", top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },

  mediaButtons: { flexDirection: "row", gap: 8 },
  mediaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  mediaBtnVideo: { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" },
  mediaBtnText: { fontSize: 14, color: C.tint, fontFamily: "Inter_500Medium" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  channelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  channelChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  channelChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  channelChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  noPermission: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12 },
  noPermissionText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular", flex: 1 },
});
