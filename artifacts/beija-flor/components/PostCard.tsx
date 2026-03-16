import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString("pt-BR");
}

function getTagStyle(tag: string | null | undefined) {
  if (!tag) return null;
  return (C.tagColors as any)[tag] || null;
}

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

interface PostCardProps {
  post: any;
  onLikeChange?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export default function PostCard({ post, onLikeChange, onDelete, compact }: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false);

  const canDelete = user?.id === post.authorId ||
    user?.role === "admin" || user?.role === "master_admin";

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    try {
      const res = await api.post(`/posts/${post.id}/like`, {});
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      onLikeChange?.();
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  }

  function handleDelete() {
    Alert.alert("Excluir post", "Tem certeza que deseja excluir este post?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/posts/${post.id}`);
            onDelete?.();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        }
      }
    ]);
  }

  const tagStyle = getTagStyle(post.author?.tag);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.97}
      onPress={() => !compact && router.push(`/post/${post.id}`)}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push(`/profile/${post.authorId}`)} activeOpacity={0.8}>
          <View style={styles.avatar}>
            {post.author?.avatarUrl ? (
              <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{post.author?.name?.[0]?.toUpperCase() || "?"}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.authorInfo}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.author?.name || "Usuário"}</Text>
            {tagStyle && (
              <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
                <Text style={[styles.tagText, { color: tagStyle.text }]}>
                  {TAG_LABELS[post.author?.tag] || post.author?.tag}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.channelName}>#{post.channel?.name}</Text>
            <Text style={styles.timeDot}>·</Text>
            <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>

        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={16} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.content} numberOfLines={compact ? 4 : undefined}>{post.content}</Text>

      {post.imageUrl && (
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <Feather name="heart" size={18} color={liked ? C.danger : C.textSecondary} />
          <Text style={[styles.actionCount, liked && { color: C.danger }]}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/post/${post.id}`)}
          activeOpacity={0.7}
        >
          <Feather name="message-circle" size={18} color={C.textSecondary} />
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginHorizontal: 16, marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarInitial: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  authorInfo: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  authorName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  channelName: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  timeDot: { fontSize: 12, color: C.textMuted },
  timeAgo: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  moreBtn: { padding: 4 },
  content: { fontSize: 15, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 10 },
  postImage: { width: "100%", height: 200, borderRadius: 10, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 20, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.borderLight },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  actionCount: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },
});
