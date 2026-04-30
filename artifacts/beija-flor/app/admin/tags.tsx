import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Modal, ScrollView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

type TagType = "unidade" | "setor" | "cargo";
type Tag = { id: number; tipo: TagType; nome: string; sortOrder: number; isActive: boolean };

const TABS: { id: TagType; label: string; icon: string; color: string }[] = [
  { id: "unidade", label: "Unidades", icon: "map-pin", color: "#2563EB" },
  { id: "setor", label: "Setores", icon: "layers", color: "#7C3AED" },
  { id: "cargo", label: "Cargos", icon: "briefcase", color: "#059669" },
];

function TagModal({
  visible, tag, tipo, onClose, onSave,
}: {
  visible: boolean; tag: Tag | null; tipo: TagType; onClose: () => void; onSave: (data: any) => void;
}) {
  const [nome, setNome] = useState(tag?.nome || "");
  const [sortOrder, setSortOrder] = useState(String(tag?.sortOrder ?? 0));
  const isEdit = !!tag;

  React.useEffect(() => {
    if (visible) {
      setNome(tag?.nome || "");
      setSortOrder(String(tag?.sortOrder ?? 0));
    }
  }, [visible, tag]);

  const tabInfo = TABS.find((t) => t.id === tipo)!;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? "Editar" : "Nova"} {tabInfo.label.slice(0, -1)}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Nome *</Text>
            <TextInput
              style={styles.formInput}
              value={nome}
              onChangeText={setNome}
              placeholder={`Ex: ${tipo === "unidade" ? "Centro" : tipo === "setor" ? "Recursos Humanos" : "Operador de Caixa"}`}
              placeholderTextColor={C.textMuted}
              autoFocus
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Ordem (menor = primeiro)</Text>
            <TextInput
              style={styles.formInput}
              value={sortOrder}
              onChangeText={setSortOrder}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={C.textMuted}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: tabInfo.color }]}
              onPress={() => {
                if (!nome.trim()) { Alert.alert("Erro", "Nome é obrigatório"); return; }
                onSave({ nome: nome.trim(), tipo, sortOrder: parseInt(sortOrder) || 0 });
              }}
            >
              <Text style={styles.saveBtnText}>{isEdit ? "Salvar" : "Criar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TagItem({ tag, onEdit, onToggle, onDelete, color }: {
  tag: Tag; onEdit: () => void; onToggle: () => void; onDelete: () => void; color: string;
}) {
  return (
    <View style={[styles.tagItem, !tag.isActive && styles.tagItemInactive]}>
      <View style={[styles.tagOrder, { borderColor: color + "40" }]}>
        <Text style={[styles.tagOrderText, { color }]}>{tag.sortOrder}</Text>
      </View>
      <Text style={[styles.tagNome, !tag.isActive && styles.tagNomeInactive]}>{tag.nome}</Text>
      {!tag.isActive && (
        <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inativo</Text></View>
      )}
      <View style={styles.tagActions}>
        <TouchableOpacity onPress={onToggle} style={styles.tagAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={tag.isActive ? "eye-off" : "eye"} size={16} color={tag.isActive ? C.textMuted : "#059669"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.tagAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="edit-2" size={16} color={C.tint} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.tagAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TagsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TagType>("unidade");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const { data: allTags = [], isLoading, refetch } = useQuery<Tag[]>({
    queryKey: ["admin-tags"],
    queryFn: () => api.get("/tags/all"),
  });

  const filtered = allTags.filter((t) => t.tipo === activeTab);
  const tabInfo = TABS.find((t) => t.id === activeTab)!;

  const createMut = useMutation({
    mutationFn: (data: any) => api.post("/tags", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tags"] }); setModalVisible(false); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/tags/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tags"] }); setModalVisible(false); setEditingTag(null); },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-tags"] }),
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  function handleSave(data: any) {
    if (editingTag) {
      updateMut.mutate({ id: editingTag.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  function handleDelete(tag: Tag) {
    Alert.alert("Excluir tag", `Deseja excluir "${tag.nome}"? Esta ação não pode ser desfeita.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => deleteMut.mutate(tag.id) },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gestão de Tags</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: tabInfo.color }]}
          onPress={() => { setEditingTag(null); setModalVisible(true); }}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab strip */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const count = allTags.filter((t) => t.tipo === tab.id && t.isActive).length;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, active && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Feather name={tab.icon as any} size={14} color={active ? tab.color : C.textMuted} />
              <Text style={[styles.tabText, { color: active ? tab.color : C.textMuted }]}>{tab.label}</Text>
              <View style={[styles.tabBadge, { backgroundColor: active ? tab.color + "20" : C.surfaceAlt }]}>
                <Text style={[styles.tabBadgeText, { color: active ? tab.color : C.textMuted }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => String(t.id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={tabInfo.icon as any} size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma {tabInfo.label.slice(0, -1).toLowerCase()} cadastrada</Text>
              <Text style={styles.emptyDesc}>Toque no + para adicionar</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TagItem
              tag={item}
              color={tabInfo.color}
              onEdit={() => { setEditingTag(item); setModalVisible(true); }}
              onToggle={() => updateMut.mutate({ id: item.id, data: { isActive: !item.isActive } })}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <TagModal
        visible={modalVisible}
        tag={editingTag}
        tipo={activeTab}
        onClose={() => { setModalVisible(false); setEditingTag(null); }}
        onSave={handleSave}
      />
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
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabs: {
    flexDirection: "row", backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 8 },
  tagItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  tagItemInactive: { opacity: 0.6 },
  tagOrder: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  tagOrderText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tagNome: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  tagNomeInactive: { textDecorationLine: "line-through", color: C.textMuted },
  inactiveBadge: {
    backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  inactiveBadgeText: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_500Medium" },
  tagActions: { flexDirection: "row", gap: 8 },
  tagAction: { padding: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  emptyDesc: { fontSize: 14, color: C.textMuted, fontFamily: "Inter_400Regular" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 16,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  formField: { gap: 6 },
  formLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  formInput: {
    backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder,
    paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  modalActions: { flexDirection: "row", gap: 12, paddingTop: 4 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  saveBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
