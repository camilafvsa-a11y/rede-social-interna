import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Modal, TextInput, ScrollView, Switch, Image, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const ICON_OPTIONS = ["hash", "globe", "megaphone", "briefcase", "users", "star", "award", "trending-up", "coffee", "droplet"];

const COLOR_PALETTE = [
  "#2563EB", // blue (default)
  "#16A34A", // green
  "#DC2626", // red
  "#9333EA", // purple
  "#EC4899", // pink
  "#EA580C", // orange
  "#CA8A04", // yellow
  "#0D9488", // teal
  "#4F46E5", // indigo
  "#E11D48", // rose
  "#0891B2", // cyan
  "#65A30D", // lime
  "#78716C", // stone
  "#0F172A", // slate
];

type Form = {
  name: string;
  description: string;
  icon: string;
  allowedTags: string[];
  isInternalComm: boolean;
  coverImageUrl: string;
  color: string;
};

export default function AdminChannelsScreen() {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>({
    name: "", description: "", icon: "hash", allowedTags: [], isInternalComm: false, coverImageUrl: "", color: "",
  });
  const [origForm, setOrigForm] = useState<Form | null>(null);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2800);
  }

  const { data: workTagOptions = [] } = useQuery<{id:number;key:string;label:string;color:string;bg:string}[]>({
    queryKey: ["work-tags"],
    queryFn: () => api.get("/work-tags"),
  });

  const tagLabelMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    workTagOptions.forEach((t) => { m[t.key] = t.label; });
    return m;
  }, [workTagOptions]);

  const { data: channels = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-channels"],
    queryFn: () => api.get("/channels"),
  });

  const EMPTY_FORM: Form = { name: "", description: "", icon: "hash", allowedTags: [], isInternalComm: false, coverImageUrl: "", color: "" };

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOrigForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(ch: any) {
    setEditing(ch);
    const f: Form = {
      name: ch.name,
      description: ch.description || "",
      icon: ch.icon || "hash",
      allowedTags: ch.allowedTags || [],
      isInternalComm: ch.isInternalComm,
      coverImageUrl: ch.coverImageUrl || "",
      color: ch.color || "",
    };
    setForm(f);
    setOrigForm(f);
    setShowModal(true);
  }

  function formIsDirty(f: Form, orig: Form | null): boolean {
    if (!orig) return false;
    return (
      f.name !== orig.name ||
      f.description !== orig.description ||
      f.icon !== orig.icon ||
      f.isInternalComm !== orig.isInternalComm ||
      f.coverImageUrl !== orig.coverImageUrl ||
      f.color !== orig.color ||
      JSON.stringify([...f.allowedTags].sort()) !== JSON.stringify([...orig.allowedTags].sort())
    );
  }

  const channelIsDirty = formIsDirty(form, origForm);

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      allowedTags: prev.allowedTags.includes(tag)
        ? prev.allowedTags.filter((t) => t !== tag)
        : [...prev.allowedTags, tag],
    }));
  }

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setForm((prev) => ({ ...prev, coverImageUrl: uri }));
    }
  }

  async function save() {
    if (!form.name.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        coverImageUrl: form.coverImageUrl || null,
        color: form.color || null,
      };
      if (editing) {
        await api.patch(`/channels/${editing.id}`, payload);
      } else {
        await api.post("/channels", payload);
      }
      await refetch();
      setShowModal(false);
      triggerToast();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChannel(ch: any) {
    Alert.alert("Excluir canal", `Excluir ${ch.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/channels/${ch.id}`);
            await refetch();
          } catch (e: any) {
            Alert.alert("Erro", e.message);
          }
        },
      },
    ]);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Canais</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item: ch }) => (
          <View style={styles.channelCard}>
            {/* Cover image thumbnail or icon */}
            {ch.coverImageUrl ? (
              <Image source={{ uri: ch.coverImageUrl }} style={styles.coverThumb} />
            ) : (
              <View style={[styles.iconWrap, { backgroundColor: ch.color ? `${ch.color}22` : ch.isInternalComm ? C.tint : "#f0fdf4" }]}>
                <Feather name={(ch.icon || "hash") as any} size={18} color={ch.color || (ch.isInternalComm ? "#fff" : C.tint)} />
              </View>
            )}
            {/* Color dot */}
            {ch.color && (
              <View style={[styles.colorDot, { backgroundColor: ch.color }]} />
            )}
            <View style={styles.chInfo}>
              <View style={styles.chNameRow}>
                <Text style={styles.chName}>{ch.name}</Text>
                {ch.isInternalComm && (
                  <View style={styles.internBadge}>
                    <Feather name="shield" size={10} color={C.tint} />
                    <Text style={styles.internBadgeText}>Interno</Text>
                  </View>
                )}
              </View>
              <Text style={styles.chDesc} numberOfLines={1}>{ch.description || "Sem descrição"}</Text>
              {ch.allowedTags?.length > 0 && (
                <Text style={styles.chTags}>{ch.allowedTags.map((t: string) => tagLabelMap[t] ?? t).join(", ")}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => openEdit(ch)} style={styles.editBtn}>
              <Feather name="edit-2" size={16} color={C.tint} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteChannel(ch)} style={styles.editBtn}>
              <Feather name="trash-2" size={16} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 118 : 20 }]}
        ListEmptyComponent={!isLoading ? <View style={styles.empty}><Text style={styles.emptyText}>Nenhum canal criado</Text></View> : null}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Editar Canal" : "Novo Canal"}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>

              {/* Cover photo */}
              <Text style={styles.fieldLabel}>Foto de Capa</Text>
              <TouchableOpacity style={styles.coverPickerBtn} onPress={pickCover} activeOpacity={0.8}>
                {form.coverImageUrl ? (
                  <View style={styles.coverPreviewWrap}>
                    <Image source={{ uri: form.coverImageUrl }} style={styles.coverPreview} resizeMode="cover" />
                    <View style={styles.coverOverlay}>
                      <Feather name="camera" size={20} color="#fff" />
                      <Text style={styles.coverOverlayText}>Alterar foto</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.coverPickerEmpty}>
                    <Feather name="image" size={28} color={C.textMuted} />
                    <Text style={styles.coverPickerHint}>Toque para adicionar uma foto de capa</Text>
                    <Text style={styles.coverPickerSub}>Proporção ideal: 16:9</Text>
                  </View>
                )}
              </TouchableOpacity>
              {form.coverImageUrl ? (
                <TouchableOpacity
                  style={styles.removeCoverBtn}
                  onPress={() => setForm((prev) => ({ ...prev, coverImageUrl: "" }))}
                >
                  <Feather name="trash-2" size={13} color={C.danger} />
                  <Text style={styles.removeCoverText}>Remover foto de capa</Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.fieldLabel}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Ex: Marketing"
                placeholderTextColor={C.placeholder}
              />

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                style={styles.input}
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="Descrição do canal"
                placeholderTextColor={C.placeholder}
              />

              <Text style={styles.fieldLabel}>Ícone</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, form.icon === icon && styles.iconOptionSelected]}
                    onPress={() => setForm({ ...form, icon })}
                  >
                    <Feather name={icon as any} size={20} color={form.icon === icon ? "#fff" : C.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Cor do Canal</Text>
              <View style={styles.colorGrid}>
                {/* "Sem cor" option */}
                <TouchableOpacity
                  style={[styles.colorSwatch, styles.colorSwatchNone, form.color === "" && styles.colorSwatchSelected]}
                  onPress={() => setForm({ ...form, color: "" })}
                >
                  <Feather name="slash" size={14} color={form.color === "" ? C.tint : C.textMuted} />
                </TouchableOpacity>
                {COLOR_PALETTE.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    style={[styles.colorSwatch, { backgroundColor: hex }, form.color === hex && styles.colorSwatchSelectedColored]}
                    onPress={() => setForm({ ...form, color: hex })}
                  >
                    {form.color === hex && <Feather name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
              {form.color !== "" && (
                <View style={styles.colorPreviewRow}>
                  <View style={[styles.colorPreviewPill, { backgroundColor: form.color }]}>
                    <Text style={styles.colorPreviewText}>{form.name || "Canal"}</Text>
                  </View>
                  <Text style={styles.colorPreviewHint}>Prévia da pílula</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Tags permitidas (vazio = todos)</Text>
              <View style={styles.tagRow}>
                {workTagOptions.map((wt) => (
                  <TouchableOpacity
                    key={wt.key}
                    style={[styles.tagChip, form.allowedTags.includes(wt.key) && styles.tagChipSelected]}
                    onPress={() => toggleTag(wt.key)}
                  >
                    <Text style={[styles.tagChipText, form.allowedTags.includes(wt.key) && { color: "#fff" }]}>{wt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Comunicação Interna</Text>
                  <Text style={styles.switchDesc}>Somente usuários autorizados podem postar</Text>
                </View>
                <Switch
                  value={form.isInternalComm}
                  onValueChange={(v) => setForm({ ...form, isInternalComm: v })}
                  trackColor={{ false: C.border, true: C.tint }}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (saving || !channelIsDirty) && { opacity: 0.4 }]}
                onPress={save}
                disabled={saving || !channelIsDirty}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{editing ? "Salvar" : "Criar Canal"}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast */}
      {showToast && (
        <View style={styles.toast} pointerEvents="none">
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>Canal salvo</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 12, gap: 8 },
  channelCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  coverThumb: { width: 48, height: 36, borderRadius: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" },
  chInfo: { flex: 1 },
  chNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  internBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  internBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.tint },
  chDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  chTags: { fontSize: 11, color: C.tint, fontFamily: "Inter_500Medium", marginTop: 2 },
  editBtn: { padding: 6 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginLeft: -6, marginTop: -20, alignSelf: "flex-start" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "93%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalContent: { padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text, fontFamily: "Inter_400Regular" },

  /* Cover picker */
  coverPickerBtn: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.border, borderStyle: "dashed" },
  coverPickerEmpty: {
    height: 120, alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: C.surfaceAlt,
  },
  coverPickerHint: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  coverPickerSub: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  coverPreviewWrap: { position: "relative" },
  coverPreview: { width: "100%", height: 140 },
  coverOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 8,
  },
  coverOverlayText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  removeCoverBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, alignSelf: "flex-end" },
  removeCoverText: { fontSize: 12, color: C.danger, fontFamily: "Inter_500Medium" },

  /* Color picker */
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  colorSwatchNone: {
    backgroundColor: C.surfaceAlt,
    borderWidth: 1, borderColor: C.border,
  },
  colorSwatchSelected: { borderWidth: 2, borderColor: C.tint },
  colorSwatchSelectedColored: {
    borderWidth: 3, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  colorPreviewRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  colorPreviewPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  colorPreviewText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  colorPreviewHint: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  /* Icon grid */
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  iconOptionSelected: { backgroundColor: C.tint, borderColor: C.tint },

  /* Tags */
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tagChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  tagChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },

  /* Switch */
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 8 },
  switchLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  switchDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  submitBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  toast: {
    position: "absolute", bottom: 36, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8,
  },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
