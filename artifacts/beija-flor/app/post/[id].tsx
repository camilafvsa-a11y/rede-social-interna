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
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString("pt-BR");
}

export default function PostScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.get(`/posts/${id}`),
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ["comments", id],
    queryFn: () => api.get(`/posts/${id}/comments`),
    enabled: !!id,
  });

  async function submitComment() {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api.post(`/posts/${id}/comments`, { content: comment.trim() });
      setComment("");
      await refetchComments();
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: number) {
    Alert.alert("Excluir comentário", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/posts/comments/${commentId}`);
            await refetchComments();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        }
      }
    ]);
  }

  async function reportComment(commentId: number) {
    Alert.prompt(
      "Denunciar comentário",
      "Motivo da denúncia:",
      async (reason) => {
        if (!reason) return;
        try {
          await api.post(`/posts/comments/${commentId}/report`, { reason });
          Alert.alert("Obrigado", "Denúncia enviada com sucesso.");
        } catch (e: any) {
          Alert.alert("Erro", e.message);
        }
      }
    );
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item: any) => String(item.id)}
        ListHeaderComponent={
          post ? (
            <View style={styles.postHeader}>
              <PostCard post={post} onDelete={() => router.back()} compact />
              <Text style={styles.commentsLabel}>Comentários</Text>
            </View>
          ) : (
            postLoading ? <ActivityIndicator style={{ margin: 20 }} color={C.tint} /> : null
          )
        }
        renderItem={({ item }) => {
          const canDelete = user?.id === item.authorId || user?.role === "admin" || user?.role === "master_admin" || user?.role === "moderator";
          return (
            <View style={styles.commentCard}>
              <TouchableOpacity onPress={() => router.push(`/profile/${item.authorId}`)}>
                <View style={styles.commentAvatar}>
                  {item.author?.avatarUrl ? (
                    <Image source={{ uri: item.author.avatarUrl }} style={styles.commentAvatarImg} />
                  ) : (
                    <Feather name="user" size={16} color="#9CA3AF" />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.commentBody}>
                <View style={styles.commentMeta}>
                  <Text style={styles.commentAuthor}>{item.author?.name}</Text>
                  <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
                <View style={styles.commentActions}>
                  {!canDelete && (
                    <TouchableOpacity onPress={() => reportComment(item.id)}>
                      <Text style={styles.reportText}>Denunciar</Text>
                    </TouchableOpacity>
                  )}
                  {canDelete && (
                    <TouchableOpacity onPress={() => deleteComment(item.id)}>
                      <Text style={styles.deleteText}>Excluir</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.noComments}>
            <Text style={styles.noCommentsText}>Seja o primeiro a comentar!</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Escreva um comentário..."
          placeholderTextColor={C.placeholder}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!comment.trim() || posting) && styles.sendBtnDisabled]}
          onPress={submitComment}
          disabled={!comment.trim() || posting}
        >
          {posting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  postHeader: { paddingBottom: 8 },
  commentsLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  listContent: { paddingBottom: 20 },
  commentCard: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  commentAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  commentAvatarInitial: { color: "#1E3A8A", fontSize: 13, fontFamily: "Inter_700Bold" },
  commentBody: { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 12, padding: 10 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  commentTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  commentContent: { fontSize: 14, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  commentActions: { flexDirection: "row", marginTop: 6, gap: 12 },
  reportText: { fontSize: 12, color: C.warning, fontFamily: "Inter_500Medium" },
  deleteText: { fontSize: 12, color: C.danger, fontFamily: "Inter_500Medium" },
  noComments: { padding: 20, alignItems: "center" },
  noCommentsText: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular" },
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
