import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { TICKET_CATEGORIES } from "@/constants/tickets";

const C = Colors.light;

export default function NewTicketScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim() || !description.trim() || !category) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/tickets", { title: title.trim(), description: description.trim(), category });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Chamado</Text>
        <TouchableOpacity onPress={submit} disabled={loading} style={[styles.submitBtn, loading && { opacity: 0.6 }]}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Enviar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 118 : insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Título *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Descreva brevemente o problema"
          placeholderTextColor={C.placeholder}
          maxLength={100}
        />

        <Text style={styles.label}>Categoria *</Text>
        <View style={styles.categoriesGrid}>
          {TICKET_CATEGORIES.map((cat) => {
            const selected = category === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.categoryChip,
                  selected && { backgroundColor: cat.color, borderColor: cat.color },
                  !selected && { borderColor: C.border },
                ]}
                onPress={() => setCategory(cat.label)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: selected ? "rgba(255,255,255,0.25)" : cat.bg }]}>
                  <Feather name={cat.icon} size={14} color={selected ? "#fff" : cat.color} />
                </View>
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Descrição *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descreva detalhadamente o que aconteceu..."
          placeholderTextColor={C.placeholder}
          multiline
          numberOfLines={6}
          maxLength={1000}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/1000</Text>
      </ScrollView>
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
  submitBtn: { backgroundColor: C.tint, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 70, alignItems: "center" },
  submitText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  content: { padding: 20, gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: C.text, fontFamily: "Inter_400Regular",
  },
  textArea: { minHeight: 120, paddingTop: 12 },
  charCount: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "right" },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, backgroundColor: C.surface,
  },
  categoryIconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  categoryText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  categoryTextSelected: { color: "#fff", fontFamily: "Inter_600SemiBold" },
});
