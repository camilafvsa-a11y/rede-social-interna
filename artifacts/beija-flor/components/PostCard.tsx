import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  Modal, Pressable, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

function MentionText({ text, style, numberOfLines }: { text: string; style?: any; numberOfLines?: number }) {
  const parts = text.split(/(@[A-Za-zÀ-ÿ0-9 ._-]+?)(?=[\s,!?.@]|$)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <Text key={i} style={{ color: C.tint, fontFamily: "Inter_600SemiBold" }}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

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
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const moreRef = useRef<TouchableOpacity>(null);

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

  function openMenu() {
    if (Platform.OS === "web") {
      setMenuPos({ top: 40, right: 0 });
      setMenuVisible(true);
      return;
    }
    moreRef.current?.measure((_x, _y, _w, h, _px, py) => {
      setMenuPos({ top: py + h + 4, right: 16 });
      setMenuVisible(true);
    });
  }

  function handleDeletePress() {
    setMenuVisible(false);
    setTimeout(() => setConfirmVisible(true), 150);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/posts/${post.id}`);
      setConfirmVisible(false);
      onDelete?.();
    } catch (e: any) {
      setConfirmVisible(false);
      Alert.alert("Erro", e.message || "Não foi possível excluir o post.");
    } finally {
      setDeleting(false);
    }
  }

  const tagStyle = getTagStyle(post.author?.tag);

  return (
    <>
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
                <Feather name="user" size={20} color="#9CA3AF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.authorInfo}>
            <TouchableOpacity onPress={() => router.push(`/profile/${post.authorId}`)} activeOpacity={0.7}>
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
            </TouchableOpacity>
            <View style={styles.metaRow}>
              <Text style={styles.channelName}>#{post.channel?.name}</Text>
              <Text style={styles.timeDot}>·</Text>
              <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>

          {canDelete && (
            <TouchableOpacity
              ref={moreRef}
              onPress={openMenu}
              style={styles.moreBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="more-horizontal" size={20} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {post.content ? (
          <MentionText text={post.content} style={styles.content} numberOfLines={compact ? 4 : undefined} />
        ) : null}

        {post.imageUrl && (
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}
        {post.videoUrl && (
          <Video
            source={{ uri: post.videoUrl }}
            style={styles.postImage}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            shouldPlay={false}
          />
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

      {/* Dropdown menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)}>
          <View
            style={[
              styles.menu,
              Platform.OS === "web"
                ? { position: "absolute", top: menuPos.top, right: menuPos.right }
                : { position: "absolute", top: menuPos.top, right: menuPos.right },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleDeletePress} activeOpacity={0.8}>
              <Feather name="trash-2" size={16} color={C.danger} />
              <Text style={styles.menuItemTextDanger}>Excluir post</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Confirm delete dialog */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => !deleting && setConfirmVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Feather name="trash-2" size={28} color={C.danger} />
            </View>
            <Text style={styles.confirmTitle}>Excluir post?</Text>
            <Text style={styles.confirmDesc}>
              Esta ação não pode ser desfeita. O post será permanentemente removido.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmVisible(false)}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={15} color="#fff" />
                <Text style={styles.deleteBtnText}>{deleting ? "Excluindo…" : "Excluir"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarInitial: { color: "#1E3A8A", fontSize: 16, fontFamily: "Inter_700Bold" },
  authorInfo: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  authorName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  channelName: { fontSize: 12, color: C.tint, fontFamily: "Inter_500Medium" },
  timeDot: { fontSize: 12, color: C.textMuted },
  timeAgo: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  moreBtn: { padding: 4, marginTop: 2 },
  content: { fontSize: 15, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 10 },
  postImage: { width: "100%", height: 200, borderRadius: 10, marginBottom: 10 },
  actions: { flexDirection: "row", gap: 20, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.borderLight },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  actionCount: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },

  /* Dropdown menu */
  menu: {
    backgroundColor: C.surface, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    minWidth: 160,
    borderColor: C.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  menuItemTextDanger: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.danger },

  /* Confirm dialog */
  confirmOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  confirmBox: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, width: "100%", maxWidth: 340, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  confirmIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 8 },
  confirmDesc: {
    fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 20, marginBottom: 24,
  },
  confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.surfaceAlt, alignItems: "center",
    borderColor: C.border,
  },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  deleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: C.danger,
    shadowColor: C.danger, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
