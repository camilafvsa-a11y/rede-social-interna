import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  Modal, Pressable, Platform, ScrollView, Dimensions, TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_INNER = Math.min(SCREEN_W - 32, 500) - 32;

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const CATEGORY_LABELS: Record<string, string> = {
  comunicacao: "Comunicação", rh: "RH", seguranca: "Segurança",
  lideranca: "Liderança", campanhas: "Campanhas", reconhecimento: "Reconhecimento",
  avisos: "Avisos", geral: "Geral",
};

// ── Media Gallery ─────────────────────────────────────────────────────────────
function MediaGallery({ media, imageUrl, videoUrl }: { media: any[]; imageUrl?: string | null; videoUrl?: string | null }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [pageIdx, setPageIdx] = useState(0);

  // Merge legacy single-url fields with new media array
  const items: Array<{ type: "image" | "video"; url: string }> = [];
  if (media && media.length > 0) {
    media.forEach((m) => items.push({ type: m.mediaType as any, url: m.url }));
  } else {
    if (imageUrl) items.push({ type: "image", url: imageUrl });
    if (videoUrl) items.push({ type: "video", url: videoUrl });
  }

  if (items.length === 0) return null;

  // Single item
  if (items.length === 1) {
    const item = items[0];
    return (
      <View style={gStyles.singleMedia}>
        {item.type === "video" ? (
          <Video
            source={{ uri: item.url }}
            style={gStyles.singleImg}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            shouldPlay={false}
          />
        ) : (
          <TouchableOpacity onPress={() => setLightboxIdx(0)} activeOpacity={0.95}>
            <Image source={{ uri: item.url }} style={gStyles.singleImg} resizeMode="cover" />
          </TouchableOpacity>
        )}
        {lightboxIdx !== null && (
          <Lightbox items={items} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </View>
    );
  }

  // 2 items — side by side
  if (items.length === 2) {
    return (
      <View style={gStyles.gridTwo}>
        {items.map((item, idx) => (
          <TouchableOpacity key={idx} style={gStyles.gridTwoItem} onPress={() => setLightboxIdx(idx)} activeOpacity={0.92}>
            <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </TouchableOpacity>
        ))}
        {lightboxIdx !== null && (
          <Lightbox items={items} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </View>
    );
  }

  // 3+ items — featured + grid
  const featured = items[0];
  const rest = items.slice(1, 3);
  const extra = items.length - 3;
  return (
    <View style={gStyles.gridThree}>
      <TouchableOpacity style={gStyles.gridFeatured} onPress={() => setLightboxIdx(0)} activeOpacity={0.92}>
        <Image source={{ uri: featured.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </TouchableOpacity>
      <View style={gStyles.gridSide}>
        {rest.map((item, idx) => (
          <TouchableOpacity key={idx} style={[gStyles.gridSideItem, idx === 0 && { marginBottom: 2 }]} onPress={() => setLightboxIdx(idx + 1)} activeOpacity={0.92}>
            <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {idx === 1 && extra > 0 && (
              <View style={gStyles.moreOverlay}>
                <Text style={gStyles.moreText}>+{extra}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {lightboxIdx !== null && (
        <Lightbox items={items} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </View>
  );
}

function Lightbox({ items, startIndex, onClose }: { items: any[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={lbStyles.overlay}>
        <TouchableOpacity style={lbStyles.close} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={26} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: items[current]?.url }} style={lbStyles.img} resizeMode="contain" />
        {items.length > 1 && (
          <View style={lbStyles.controls}>
            <TouchableOpacity onPress={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
              <Feather name="chevron-left" size={30} color={current === 0 ? "#555" : "#fff"} />
            </TouchableOpacity>
            <Text style={lbStyles.counter}>{current + 1} / {items.length}</Text>
            <TouchableOpacity onPress={() => setCurrent((c) => Math.min(items.length - 1, c + 1))} disabled={current === items.length - 1} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
              <Feather name="chevron-right" size={30} color={current === items.length - 1 ? "#555" : "#fff"} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ post, visible, onClose, onShared }: { post: any; visible: boolean; onClose: () => void; onShared: () => void }) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [sharing, setSharing] = useState(false);

  async function doShare() {
    setSharing(true);
    try {
      await api.post(`/posts/${post.id}/share`, { comment: comment.trim() || null, channelId: post.channelId });
      setSharing(false);
      onClose();
      onShared();
    } catch (e: any) {
      setSharing(false);
      Alert.alert("Erro", e.message || "Não foi possível compartilhar.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shareStyles.overlay}>
        <View style={shareStyles.sheet}>
          <View style={shareStyles.header}>
            <Text style={shareStyles.title}>Compartilhar post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={shareStyles.input}
            placeholder="Adicione um comentário (opcional)"
            placeholderTextColor={C.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          {/* Mini preview of the original post */}
          <View style={shareStyles.origPreview}>
            <View style={shareStyles.origLine} />
            <View style={{ flex: 1 }}>
              <Text style={shareStyles.origAuthor}>{post.author?.name}</Text>
              {post.content ? <Text style={shareStyles.origContent} numberOfLines={2}>{post.content}</Text> : null}
            </View>
          </View>
          <TouchableOpacity style={[shareStyles.shareBtn, sharing && { opacity: 0.6 }]} onPress={doShare} disabled={sharing} activeOpacity={0.8}>
            {sharing ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="share-2" size={16} color="#fff" /><Text style={shareStyles.shareBtnText}>Compartilhar</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Report Modal ──────────────────────────────────────────────────────────────
function ReportModal({ postId, visible, onClose }: { postId: number; visible: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!reason.trim()) return;
    setSending(true);
    try {
      await api.post(`/posts/${postId}/report`, { reason });
      setSending(false);
      onClose();
      Alert.alert("Denúncia enviada", "Obrigado. Nossa equipe irá revisar este conteúdo.");
    } catch {
      setSending(false);
      Alert.alert("Erro", "Não foi possível enviar a denúncia.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={shareStyles.overlay}>
        <View style={shareStyles.sheet}>
          <View style={shareStyles.header}>
            <Text style={shareStyles.title}>Denunciar post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[shareStyles.input, { height: 80 }]}
            placeholder="Descreva o motivo da denúncia"
            placeholderTextColor={C.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <TouchableOpacity style={[shareStyles.shareBtn, { backgroundColor: C.danger }, (!reason.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!reason.trim() || sending} activeOpacity={0.8}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="flag" size={16} color="#fff" /><Text style={shareStyles.shareBtnText}>Enviar denúncia</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Embedded shared post ──────────────────────────────────────────────────────
function SharedPostEmbed({ post }: { post: any }) {
  const router = useRouter();
  if (!post) return null;
  const items: any[] = post.media?.length > 0 ? post.media : (post.imageUrl ? [{ type: "image", url: post.imageUrl }] : []);
  return (
    <TouchableOpacity style={embedStyles.wrap} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.9}>
      <View style={embedStyles.header}>
        <View style={embedStyles.avatar}>
          {post.author?.avatarUrl
            ? <Image source={{ uri: post.author.avatarUrl }} style={StyleSheet.absoluteFill as any} />
            : <Feather name="user" size={13} color="#9CA3AF" />
          }
        </View>
        <Text style={embedStyles.name} numberOfLines={1}>{post.author?.name || "Usuário"}</Text>
        <Text style={embedStyles.time}>· {timeAgo(post.createdAt)}</Text>
      </View>
      {post.content ? <Text style={embedStyles.content} numberOfLines={3}>{post.content}</Text> : null}
      {items.length > 0 && (
        <Image source={{ uri: items[0].url }} style={embedStyles.img} resizeMode="cover" />
      )}
    </TouchableOpacity>
  );
}

// ── Main PostCard ─────────────────────────────────────────────────────────────
interface PostCardProps {
  post: any;
  onLikeChange?: () => void;
  onDelete?: () => void;
  onSaveChange?: () => void;
  compact?: boolean;
}

export default function PostCard({ post, onLikeChange, onDelete, onSaveChange, compact }: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [liking, setLiking] = useState(false);
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [saving, setSavingPost] = useState(false);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const moreRef = useRef<TouchableOpacity>(null);

  const isAdmin = user?.role === "admin" || user?.role === "master_admin";
  const canDelete = user?.id === post.authorId || isAdmin;

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    try {
      const res = await api.post(`/posts/${post.id}/like`, {});
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      onLikeChange?.();
    } catch {
      setLiked(prev);
      setLikeCount(liked ? likeCount : likeCount - 1);
    } finally {
      setLiking(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSavingPost(true);
    const prev = saved;
    setSaved(!saved);
    try {
      await api.post(`/posts/${post.id}/save`, {});
      onSaveChange?.();
    } catch {
      setSaved(prev);
    } finally {
      setSavingPost(false);
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

  async function handlePin() {
    setMenuVisible(false);
    try {
      const res = await api.put(`/posts/${post.id}/pin`, {});
      Alert.alert("OK", res.isPinned ? "Post fixado no topo." : "Post desfixado.");
      onDelete?.();
    } catch (e: any) { Alert.alert("Erro", e.message); }
  }

  async function handleHighlight() {
    setMenuVisible(false);
    try {
      const res = await api.put(`/posts/${post.id}/highlight`, {});
      Alert.alert("OK", res.isHighlighted ? "Post em destaque." : "Destaque removido.");
      onDelete?.();
    } catch (e: any) { Alert.alert("Erro", e.message); }
  }

  const tagStyle = getTagStyle(post.author?.tag);
  const isPinned = post.isPinned ?? false;
  const isHighlighted = post.isHighlighted ?? false;
  const isOfficial = post.isOfficial ?? false;
  const category = post.category ?? null;

  // Compose bordered style for highlighted posts
  const cardBorderStyle = isHighlighted
    ? { borderWidth: 2, borderColor: "#2563EB" }
    : isPinned
    ? { borderWidth: 1.5, borderColor: "#FFD700" }
    : {};

  return (
    <>
      <View style={[styles.card, cardBorderStyle]}>
        {/* ── Pinned / Official ribbon ── */}
        {(isPinned || isOfficial) && (
          <View style={styles.ribbon}>
            {isPinned && (
              <View style={[styles.ribbonTag, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="bookmark" size={11} color="#D97706" />
                <Text style={[styles.ribbonText, { color: "#D97706" }]}>Fixado</Text>
              </View>
            )}
            {isOfficial && (
              <View style={[styles.ribbonTag, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="shield" size={11} color="#2563EB" />
                <Text style={[styles.ribbonText, { color: "#2563EB" }]}>Oficial</Text>
              </View>
            )}
            {category && CATEGORY_LABELS[category] && (
              <View style={[styles.ribbonTag, { backgroundColor: "#F3F4F6" }]}>
                <Text style={[styles.ribbonText, { color: C.textSecondary }]}>{CATEGORY_LABELS[category]}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Header ── */}
        <TouchableOpacity
          activeOpacity={0.97}
          onPress={() => !compact && router.push(`/post/${post.id}`)}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push(`/profile/${post.authorId}`)} activeOpacity={0.8}>
              <View style={styles.avatar}>
                {post.author?.avatarUrl ? (
                  <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{post.author?.name?.[0]?.toUpperCase() || "U"}</Text>
                  </View>
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

            <TouchableOpacity
              ref={moreRef}
              onPress={openMenu}
              style={styles.moreBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="more-horizontal" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Content ── */}
          {post.sharedFrom ? (
            <>
              {post.content ? (
                <MentionText text={post.content} style={styles.content} numberOfLines={compact ? 3 : undefined} />
              ) : null}
              <SharedPostEmbed post={post.sharedFrom} />
            </>
          ) : (
            <>
              {post.content ? (
                <MentionText text={post.content} style={styles.content} numberOfLines={compact ? 4 : undefined} />
              ) : null}
              <MediaGallery media={post.media ?? []} imageUrl={post.imageUrl} videoUrl={post.videoUrl} />
            </>
          )}
        </TouchableOpacity>

        {/* ── Action bar ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
            <Feather name="heart" size={18} color={liked ? C.danger : C.textSecondary} />
            {likeCount > 0 && <Text style={[styles.actionCount, liked && { color: C.danger }]}>{likeCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)} activeOpacity={0.7}>
            <Feather name="message-circle" size={18} color={C.textSecondary} />
            {post.commentCount > 0 && <Text style={styles.actionCount}>{post.commentCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShareModalVisible(true)} activeOpacity={0.7}>
            <Feather name="share-2" size={17} color={C.textSecondary} />
            {shareCount > 0 && <Text style={styles.actionCount}>{shareCount}</Text>}
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.actionBtn} onPress={handleSave} activeOpacity={0.7}>
            <Feather name="bookmark" size={17} color={saved ? C.tint : C.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Dropdown menu ── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menu, Platform.OS === "web"
            ? { position: "absolute", top: menuPos.top, right: menuPos.right }
            : { position: "absolute", top: menuPos.top, right: menuPos.right }
          ]}>
            {isAdmin && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handlePin} activeOpacity={0.8}>
                  <Feather name="bookmark" size={15} color={isPinned ? "#D97706" : C.textSecondary} />
                  <Text style={styles.menuItemText}>{isPinned ? "Desfixar post" : "Fixar post"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleHighlight} activeOpacity={0.8}>
                  <Feather name="star" size={15} color={isHighlighted ? C.tint : C.textSecondary} />
                  <Text style={styles.menuItemText}>{isHighlighted ? "Remover destaque" : "Colocar em destaque"}</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setTimeout(() => setReportVisible(true), 150); }} activeOpacity={0.8}>
              <Feather name="flag" size={15} color={C.textSecondary} />
              <Text style={styles.menuItemText}>Denunciar</Text>
            </TouchableOpacity>
            {canDelete && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setTimeout(() => setConfirmVisible(true), 150); }} activeOpacity={0.8}>
                  <Feather name="trash-2" size={15} color={C.danger} />
                  <Text style={styles.menuItemTextDanger}>Excluir post</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── Confirm delete ── */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => !deleting && setConfirmVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconWrap}>
              <Feather name="trash-2" size={28} color={C.danger} />
            </View>
            <Text style={styles.confirmTitle}>Excluir post?</Text>
            <Text style={styles.confirmDesc}>Esta ação não pode ser desfeita.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)} disabled={deleting} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={async () => {
                  setDeleting(true);
                  try {
                    await api.delete(`/posts/${post.id}`);
                    setConfirmVisible(false);
                    onDelete?.();
                  } catch (e: any) {
                    setConfirmVisible(false);
                    Alert.alert("Erro", e.message || "Não foi possível excluir.");
                  } finally { setDeleting(false); }
                }}
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

      {/* ── Share Modal ── */}
      <ShareModal
        post={post}
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        onShared={() => { setShareCount((c) => c + 1); onLikeChange?.(); }}
      />

      {/* ── Report Modal ── */}
      <ReportModal
        postId={post.id}
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4,
    marginHorizontal: 12, marginVertical: 5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  ribbon: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  ribbonTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  ribbonText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#2563EB22",
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#2563EB", fontSize: 16, fontFamily: "Inter_700Bold" },
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
  content: {
    fontSize: 15, color: C.text, fontFamily: "Inter_400Regular",
    lineHeight: 22, marginBottom: 10,
  },
  actions: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingTop: 8, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: C.borderLight, marginTop: 4,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 6 },
  actionCount: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  menu: {
    backgroundColor: C.surface, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    minWidth: 190, borderColor: C.border, overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  menuItemTextDanger: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.danger },
  menuDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 12 },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmBox: {
    backgroundColor: C.surface, borderRadius: 20, padding: 24,
    width: "100%", maxWidth: 340, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  confirmIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 8 },
  confirmDesc: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  confirmActions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.surfaceAlt, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  deleteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: C.danger },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const gStyles = StyleSheet.create({
  singleMedia: { borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  singleImg: { width: "100%", height: 220, borderRadius: 12 },
  gridTwo: { flexDirection: "row", gap: 2, height: 180, borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  gridTwoItem: { flex: 1, backgroundColor: "#F3F4F6" },
  gridThree: { flexDirection: "row", gap: 2, height: 200, borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  gridFeatured: { flex: 2, backgroundColor: "#F3F4F6" },
  gridSide: { flex: 1, flexDirection: "column", gap: 2 },
  gridSideItem: { flex: 1, backgroundColor: "#F3F4F6" },
  moreOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
});

const lbStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", top: 52, right: 20, zIndex: 10, padding: 8 },
  img: { width: SCREEN_W, height: SCREEN_W * 1.1 },
  controls: { position: "absolute", bottom: 60, flexDirection: "row", alignItems: "center", gap: 30 },
  counter: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 15 },
});

const shareStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.text },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
    minHeight: 60, textAlignVertical: "top",
  },
  origPreview: {
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: C.surfaceAlt, borderRadius: 10, alignItems: "flex-start",
  },
  origLine: { width: 3, borderRadius: 2, backgroundColor: C.tint, alignSelf: "stretch" },
  origAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 2 },
  origContent: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 18 },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
  },
  shareBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const embedStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 12, marginBottom: 10, gap: 6, backgroundColor: C.surfaceAlt,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 7 },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5E7EB", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  time: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 20 },
  img: { width: "100%", height: 120, borderRadius: 8 },
});
