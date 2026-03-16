import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ["channels"],
    queryFn: () => api.get("/channels"),
  });

  const { data: canPostData } = useQuery({
    queryKey: ["can-post", channelId],
    queryFn: () => channelId ? api.get(`/channels/${channelId}/can-post`) : Promise.resolve({ canPost: false }),
    enabled: !!channelId,
  });

  const canPost = !channelId || canPostData?.canPost;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function submit() {
    if (!content.trim()) { Alert.alert("Atenção", "Escreva algo antes de postar."); return; }
    if (!channelId) { Alert.alert("Atenção", "Selecione um canal."); return; }
    setLoading(true);
    try {
      await api.post("/posts", { content: content.trim(), imageUrl: imageUri, channelId });
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

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <TextInput
          style={styles.textInput}
          value={content}
          onChangeText={setContent}
          placeholder="O que você está pensando?"
          placeholderTextColor={C.placeholder}
          multiline
          autoFocus
          maxLength={1000}
        />
        <Text style={styles.charCount}>{content.length}/1000</Text>

        {imageUri && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImg} onPress={() => setImageUri(null)}>
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.addImageBtn} onPress={pickImage} activeOpacity={0.8}>
          <Feather name="image" size={18} color={C.tint} />
          <Text style={styles.addImageText}>Adicionar imagem</Text>
        </TouchableOpacity>

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
              <Text style={[styles.channelChipText, channelId === ch.id && { color: "#fff" }]}>
                {ch.name}
              </Text>
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
  content: { padding: 16, gap: 12 },
  textInput: {
    fontSize: 17, color: C.text, fontFamily: "Inter_400Regular",
    lineHeight: 24, minHeight: 120, textAlignVertical: "top",
  },
  charCount: { fontSize: 12, color: C.textMuted, textAlign: "right", fontFamily: "Inter_400Regular" },
  imagePreview: { borderRadius: 12, overflow: "hidden", position: "relative" },
  previewImg: { width: "100%", height: 200, borderRadius: 12 },
  removeImg: {
    position: "absolute", top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  addImageBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  addImageText: { fontSize: 14, color: C.tint, fontFamily: "Inter_500Medium" },
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
  noPermissionText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_500Medium", flex: 1 },
});
