import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_OPTIONS = ["marketing", "adm", "socio", "posto", "churrascaria", "gerente"];
const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Adm", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};
const ROLE_OPTIONS = ["user", "moderator", "admin"];
const ROLE_LABELS: Record<string, string> = { user: "Colaborador", moderator: "Moderador", admin: "Administrador" };

export default function AdminEmailsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", tag: "", role: "user", temporaryPassword: "" });

  const { data: emails = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["allowed-emails"],
    queryFn: () => api.get("/users/admin/allowed-emails"),
  });

  async function addEmail() {
    if (!form.email.trim() || !form.name.trim() || !form.temporaryPassword.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }
    try {
      await api.post("/users/admin/allowed-emails", form);
      await refetch();
      setShowModal(false);
      setForm({ email: "", name: "", tag: "", role: "user", temporaryPassword: "" });
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  }

  async function removeEmail(id: number, email: string) {
    Alert.alert("Remover e-mail", `Remover ${email}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/users/admin/allowed-emails/${id}`);
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
        <Text style={styles.title}>E-mails Autorizados</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={emails}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.emailCard}>
            <View style={styles.emailIcon}>
              <Feather name="mail" size={18} color={C.tint} />
            </View>
            <View style={styles.emailInfo}>
              <Text style={styles.emailName}>{item.name}</Text>
              <Text style={styles.emailAddr}>{item.email}</Text>
            </View>
            <TouchableOpacity onPress={() => removeEmail(item.id, item.email)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="trash-2" size={18} color={C.danger} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Feather name="mail" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>Nenhum e-mail autorizado</Text>
              <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtnEmpty}>
                <Text style={styles.addBtnEmptyText}>Adicionar e-mail</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={C.tint} /></View>}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar E-mail</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Feather name="x" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Nome *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nome completo" placeholderTextColor={C.placeholder} />

              <Text style={styles.fieldLabel}>E-mail *</Text>
              <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="email@empresa.com" placeholderTextColor={C.placeholder} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.fieldLabel}>Senha temporária *</Text>
              <TextInput style={styles.input} value={form.temporaryPassword} onChangeText={(v) => setForm({ ...form, temporaryPassword: v })} placeholder="Senha inicial" placeholderTextColor={C.placeholder} />

              <Text style={styles.fieldLabel}>Tag</Text>
              <View style={styles.optionRow}>
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity key={tag} style={[styles.optionChip, form.tag === tag && styles.optionChipSelected]} onPress={() => setForm({ ...form, tag })}>
                    <Text style={[styles.optionText, form.tag === tag && { color: "#fff" }]}>{TAG_LABELS[tag]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Papel</Text>
              <View style={styles.optionRow}>
                {ROLE_OPTIONS.map((role) => (
                  <TouchableOpacity key={role} style={[styles.optionChip, form.role === role && styles.optionChipSelected]} onPress={() => setForm({ ...form, role })}>
                    <Text style={[styles.optionText, form.role === role && { color: "#fff" }]}>{ROLE_LABELS[role]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addEmail}>
                <Text style={styles.submitText}>Adicionar</Text>
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
  emailCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  emailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" },
  emailInfo: { flex: 1 },
  emailName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  emailAddr: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  addBtnEmpty: { backgroundColor: C.tint, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addBtnEmptyText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", minHeight: 400 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalContent: { padding: 16, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, fontFamily: "Inter_400Regular",
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  optionChipSelected: { backgroundColor: C.tint, borderColor: C.tint },
  optionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.textSecondary },
  submitBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  submitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
