import React, { useRef, useState } from "react";
import {
  Animated, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Platform, Modal, ActivityIndicator, PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import Colors from "@/constants/colors";

const C = Colors.light;
const CROP_SIZE = 280;

const ROLE_LABELS: Record<string, string> = {
  user: "Colaborador", moderator: "Moderador",
  admin: "Administrador", master_admin: "Administrador Master",
};

// ─── Crop Editor ──────────────────────────────────────────────────────────────
function CropEditor({
  uri,
  imgWidth,
  imgHeight,
  initialOffsetX,
  initialOffsetY,
  onConfirm,
  onCancel,
  processing,
}: {
  uri: string;
  imgWidth: number;
  imgHeight: number;
  initialOffsetX: number;
  initialOffsetY: number;
  onConfirm: (offsetX: number, offsetY: number, scale: number) => void;
  onCancel: () => void;
  processing: boolean;
}) {
  const scale = CROP_SIZE / Math.min(imgWidth, imgHeight);
  const displayW = imgWidth * scale;
  const displayH = imgHeight * scale;

  const clampX = (v: number) => Math.min(0, Math.max(CROP_SIZE - displayW, v));
  const clampY = (v: number) => Math.min(0, Math.max(CROP_SIZE - displayH, v));

  const pan = useRef(new Animated.ValueXY({
    x: clampX(initialOffsetX),
    y: clampY(initialOffsetY),
  })).current;

  const lastOffset = useRef({
    x: clampX(initialOffsetX),
    y: clampY(initialOffsetY),
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: lastOffset.current.x, y: lastOffset.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        const nx = clampX(lastOffset.current.x + g.dx);
        const ny = clampY(lastOffset.current.y + g.dy);
        lastOffset.current = { x: nx, y: ny };
        pan.flattenOffset();
        pan.setValue({ x: nx, y: ny });
      },
    })
  ).current;

  function handleConfirm() {
    const ox = (pan.x as any)._value ?? lastOffset.current.x;
    const oy = (pan.y as any)._value ?? lastOffset.current.y;
    onConfirm(ox, oy, scale);
  }

  return (
    <View style={cropSt.wrapper}>
      <Text style={cropSt.title}>Ajustar recorte</Text>
      <Text style={cropSt.subtitle}>Arraste a foto para reposicionar</Text>

      {/* Crop box — circular mask */}
      <View style={cropSt.cropOuter}>
        <View style={cropSt.cropBox}>
          <Animated.Image
            source={{ uri }}
            style={[
              { width: displayW, height: displayH, position: "absolute" },
              { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
            ]}
            {...panResponder.panHandlers}
            resizeMode="cover"
          />
        </View>
        {/* Corner overlays for darkening outside circle */}
        <View style={[cropSt.cornerOverlay, cropSt.overlayTop]} pointerEvents="none" />
        <View style={[cropSt.cornerOverlay, cropSt.overlayBottom]} pointerEvents="none" />
        <View style={[cropSt.cornerOverlay, cropSt.overlayLeft]} pointerEvents="none" />
        <View style={[cropSt.cornerOverlay, cropSt.overlayRight]} pointerEvents="none" />
      </View>

      <Text style={cropSt.hint}>
        <Feather name="move" size={12} color={C.textMuted} /> Arraste para mover a foto dentro do círculo
      </Text>

      <TouchableOpacity
        style={[cropSt.confirmBtn, processing && { opacity: 0.6 }]}
        onPress={handleConfirm}
        disabled={processing}
        activeOpacity={0.8}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Feather name="check" size={16} color="#fff" />
            <Text style={cropSt.confirmBtnText}>Confirmar recorte</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={cropSt.cancelBtn} onPress={onCancel} disabled={processing} activeOpacity={0.8}>
        <Text style={cropSt.cancelBtnText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const qc = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [cropOffset, setCropOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  const [showCropEditor, setShowCropEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const w = asset.width || 800;
      const h = asset.height || 800;
      setOriginalUri(asset.uri);
      setOriginalSize({ w, h });
      const scale = CROP_SIZE / Math.min(w, h);
      const dw = w * scale;
      const dh = h * scale;
      setCropOffset({ x: -(dw - CROP_SIZE) / 2, y: -(dh - CROP_SIZE) / 2 });
      setPendingUri(null);
      setShowPreview(false);
      setShowCropEditor(true);
    }
  }

  async function confirmCrop(offsetX: number, offsetY: number, scale: number) {
    if (!originalUri) return;
    setProcessing(true);
    try {
      const { w, h } = originalSize;
      const originX = Math.max(0, Math.round(-offsetX / scale));
      const originY = Math.max(0, Math.round(-offsetY / scale));
      const cropPx = Math.round(CROP_SIZE / scale);
      const safeW = Math.min(cropPx, w - originX);
      const safeH = Math.min(cropPx, h - originY);

      const cropped = await ImageManipulator.manipulateAsync(
        originalUri,
        [
          { crop: { originX, originY, width: safeW, height: safeH } },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCropOffset({ x: offsetX, y: offsetY });
      setPendingUri(cropped.uri);
      setShowCropEditor(false);
      setShowPreview(true);
    } catch (e: any) {
      Alert.alert("Erro ao recortar", e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function confirmAvatar() {
    if (!pendingUri) return;
    setUpdating(true);
    try {
      const filename = `avatar_${Date.now()}.jpg`;
      const uploaded = await uploadMedia(pendingUri, filename);
      const updated = await api.post(`/users/${user?.id}/avatar`, { avatarUrl: uploaded.url });
      updateUser(updated);
      await qc.invalidateQueries();
      setShowPreview(false);
      setPendingUri(null);
      setOriginalUri(null);
    } catch (e: any) {
      Alert.alert("Erro ao salvar foto", e.message);
    } finally {
      setUpdating(false);
    }
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "Não informado";
    const [year, month, day] = dateStr.split("-").map(Number);
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${day} de ${months[month - 1]} de ${year}`;
  }

  const tagStyle = user?.tag ? (C.tagColors as any)[user.tag] : null;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Meu Perfil</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => router.push("/admin")}
              activeOpacity={0.8}
            >
              <Feather name="settings" size={18} color={C.tint} />
              <Text style={styles.adminBtnText}>Admin</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileCard}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarContainer}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={40} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Feather name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{ROLE_LABELS[user?.role || "user"]}</Text>
            </View>
            {tagStyle && user?.tag && (
              <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
                <Text style={[styles.tagText, { color: tagStyle.text }]}>{user.tag}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="calendar" label="Aniversário" value={formatDate(user?.birthDate)} />
            <InfoRow icon="briefcase" label="Data de admissão" value={formatDate(user?.admissionDate)} />
            <InfoRow icon="clock" label="Membro desde" value={formatDate(user?.createdAt?.split("T")[0])} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          <View style={styles.infoCard}>
            <TouchableOpacity style={styles.actionRow} onPress={pickAvatar} activeOpacity={0.8}>
              <Feather name="camera" size={18} color={C.tint} />
              <Text style={styles.actionText}>Alterar foto de perfil</Text>
              <Feather name="chevron-right" size={16} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => Alert.alert("Sair", "Tem certeza que deseja sair?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: logout },
            ])}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={C.danger} />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Crop Editor Modal ── */}
      <Modal
        visible={showCropEditor}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!processing) setShowCropEditor(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            {originalUri && (
              <CropEditor
                uri={originalUri}
                imgWidth={originalSize.w}
                imgHeight={originalSize.h}
                initialOffsetX={cropOffset.x}
                initialOffsetY={cropOffset.y}
                onConfirm={confirmCrop}
                onCancel={() => setShowCropEditor(false)}
                processing={processing}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Preview & Confirm Modal ── */}
      <Modal
        visible={showPreview}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!updating) { setShowPreview(false); setPendingUri(null); } }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.previewTitle}>Prévia da foto de perfil</Text>
            <Text style={styles.previewSubtitle}>Confira como vai ficar e salve</Text>

            {pendingUri && (
              <Image source={{ uri: pendingUri }} style={styles.previewImage} />
            )}

            <TouchableOpacity
              style={styles.recropBtn}
              onPress={() => {
                setShowPreview(false);
                setShowCropEditor(true);
              }}
              disabled={updating}
              activeOpacity={0.8}
            >
              <Feather name="crop" size={16} color={C.tint} />
              <Text style={styles.recropBtnText}>Alterar recorte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, updating && { opacity: 0.7 }]}
              onPress={confirmAvatar}
              disabled={updating}
              activeOpacity={0.85}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Salvar foto de perfil</Text>
                </>
              )}
            </TouchableOpacity>

            {!updating && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowPreview(false); setPendingUri(null); setOriginalUri(null); }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={16} color={C.tint} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Crop Editor Styles ───────────────────────────────────────────────────────
const OUTER = CROP_SIZE + 64;
const CORNER_SIZE = 64;

const cropSt = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 16, paddingHorizontal: 24, paddingTop: 8 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: -8 },
  cropOuter: {
    width: OUTER, height: OUTER,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  cropBox: {
    width: CROP_SIZE, height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3, borderColor: C.tint,
    backgroundColor: "#000",
  },
  cornerOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlayTop: { top: 0, left: 0, right: 0, height: CORNER_SIZE / 2 },
  overlayBottom: { bottom: 0, left: 0, right: 0, height: CORNER_SIZE / 2 },
  overlayLeft: {
    top: CORNER_SIZE / 2,
    bottom: CORNER_SIZE / 2,
    left: 0,
    width: CORNER_SIZE / 2,
  },
  overlayRight: {
    top: CORNER_SIZE / 2,
    bottom: CORNER_SIZE / 2,
    right: 0,
    width: CORNER_SIZE / 2,
  },
  hint: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14,
    width: "100%", justifyContent: "center",
  },
  confirmBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textMuted },
});

// ─── Main Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  adminBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  adminBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint },
  profileCard: { alignItems: "center", backgroundColor: C.surface, paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.tint },
  avatarFallback: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  editBadge: { position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  profileName: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  profileEmail: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 10 },
  badgeRow: { flexDirection: "row", gap: 8 },
  roleBadge: { backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.tint },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: { padding: 16 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  infoCard: { backgroundColor: C.surface, borderRadius: 14, overflow: "hidden", borderColor: C.border },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  infoLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium", marginTop: 1 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  actionText: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, borderColor: "#FECACA" },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.danger },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 24,
    alignItems: "center",
    gap: 14,
  },

  previewTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text, textAlign: "center" },
  previewSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", marginTop: -6 },
  previewImage: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, borderColor: C.tint, backgroundColor: "#F3F4F6", marginVertical: 8 },
  recropBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.tint,
    backgroundColor: "#EFF6FF", width: "100%", justifyContent: "center",
  },
  recropBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.tint },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 12,
    paddingVertical: 14, width: "100%", justifyContent: "center",
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.textMuted },
});
