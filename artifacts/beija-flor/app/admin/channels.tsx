import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Platform, Modal, TextInput, ScrollView, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_OPTIONS = ["marketing", "adm", "socio", "posto", "churrascaria", "gerente"];
const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

const ICON_OPTIONS = ["hash", "globe", "megaphone", "briefcase", "users", "star", "award", "trending-up", "coffee", "droplet"];

export default function AdminChannelsScreen() {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "hash", allowedTags: [] as string[], isInternalComm: false });

  const { data: channels = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-channels"],
    queryFn: () => api.get("/channels"),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", icon: "hash", allowedTags: [], isInternalComm: false });
    setShowModal(true);
  }

  function openEdit(ch: any) {
    setEditing(ch);
    setForm({ name: ch.name, description: ch.description || "", icon: ch.icon || "hash", allowedTags: ch.allowedTags || [], isInternalComm: ch.isInternalComm });
    setShowModal(true);
  }

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      allowedTags: prev.allowedTags.includes(tag)
        ? prev.allowedTags.filter((t) => t !== tag)
        : [...prev.allowedTags, tag],
    }));
  }

  async function save() {
    if (!form.name.trim()) { Alert.alert("Atenção", "Nome é obrigatório."); return; }
    try {
      if (editing) {
        await api.patch(`/channels/${editing.id}`, form);
      } else {
        await api.post("/channels", form);
      }
      await refetch();
      setShowModal(false);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
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
        }
      }
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
            <View style={[styles.iconWrap, ch.isInternalComm && { backgroundColor: C.tint }]}>
              <Feather name={(ch.icon || "hash") as any} size={18} color={ch.isInternalComm ? "#fff" : C.tint} />
            </View>
            <View style={styles.chInfo}>
              <Text style={styles.chName}>{ch.name}</Text>
              <Text style={styles.chDesc} numberOfLines={1}>{ch.description || "Sem descrição"}</Text>
              {ch.allowedTags?.length > 0 && (
                <Text style={styles.chTags}>{ch.allowedTags.map((t: string) => TAG_LABELS[t]).join(", ")}</Text>
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
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={!isLoading ? <View style={styles.empty}><Text style={styles.emptyText}>Nenhum canal criado</Text></View> : null}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Editar Canal" : "Novo Canal"}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Nome *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Marketing" placeholderTextColor={C.placeholder} />

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Descrição do canal" placeholderTextColor={C.placeholder} />

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

              <Text style={styles.fieldLabel}>Tags permitidas (vazio = todos)</Text>
              <View style={styles.tagRow}>
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, form.allowedTags.includes(tag) && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.tagChipText, form.allowedTags.includes(tag) && { color: "#fff" }]}>{TAG_LABELS[tag]}</Text>
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

              <TouchableOpacity style={styles.submitBtn} onPress={save}>
                <Text style={styles.submitText}>{editing ? "Salvar" : "Criar Canal"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" },
  chInfo: { flex: 1 },
  chName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  chDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  chTags: { fontSize: 11, color: C.tint, fontFamily: "Inter_500Medium", marginTop: 2 },
  editBtn: { padding: 6 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalContent: { padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, fontFamily: "Inter_400Regular" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  iconOptionSelected: { backgroundColor: C.tint, borderColor: C.tint },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tagChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  tagChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 8 },
  switchLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  switchDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  submitBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
