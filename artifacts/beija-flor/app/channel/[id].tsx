import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PostCard from "@/components/PostCard";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function ChannelScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: channel } = useQuery({
    queryKey: ["channel", id],
    queryFn: () => api.get(`/channels/${id}`),
  });

  const { data: postsData, refetch, isLoading } = useQuery({
    queryKey: ["posts", id],
    queryFn: () => api.get(`/posts?channelId=${id}&limit=50`),
  });

  const { data: canPostData } = useQuery({
    queryKey: ["can-post", id],
    queryFn: () => api.get(`/channels/${id}/can-post`),
  });

  const posts = postsData?.posts || [];
  const canPost = canPostData?.canPost ?? false;

  async function submitPost() {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      await api.post("/posts", { content: postContent.trim(), channelId: parseInt(id) });
      setPostContent("");
      await refetch();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setPosting(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.channelName}>#{channel?.name || "Canal"}</Text>
          {channel?.description && (
            <Text style={styles.channelDesc} numberOfLines={1}>{channel.description}</Text>
          )}
        </View>
        {channel?.isInternalComm && (
          <View style={styles.officialBadge}>
            <Feather name="shield" size={12} color="#92400E" />
            <Text style={styles.officialText}>Oficial</Text>
          </View>
        )}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard post={item} onDelete={refetch} onLikeChange={refetch} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={C.tint} />
        </View>
      )}

      {canPost && (
        <View style={[styles.composer, { paddingBottom: Platform.OS === "web" ? 92 : insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={postContent}
            onChangeText={setPostContent}
            placeholder="Escreva algo..."
            placeholderTextColor={C.placeholder}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!postContent.trim() || posting) && styles.sendBtnDisabled]}
            onPress={submitPost}
            disabled={!postContent.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  channelName: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  channelDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  officialBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  officialText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#92400E" },
  listContent: { paddingTop: 8, paddingBottom: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.textSecondary },
  loadingBar: { padding: 12, alignItems: "center" },
  composer: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.2)",
  },
  input: {
    flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: C.text, maxHeight: 100,
    borderWidth: 1, borderColor: "rgba(60,60,67,0.2)",
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    shadowColor: C.tint, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 2,
  },
  sendBtnDisabled: { backgroundColor: "rgba(60,60,67,0.18)", shadowOpacity: 0 },
});
