import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

type Settings = {
  default_password: string;
  min_password_length: string;
  require_number: string;
  require_letter: string;
  force_reset_on_first_login: string;
};

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 118 : insets.bottom;
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["security-settings"],
    queryFn: () => api.get("/security-settings"),
  });

  const [form, setForm] = useState<Settings | null>(null);

  React.useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (data: Partial<Settings>) => api.patch("/security-settings", data),
    onSuccess: (updated) => {
      setForm(updated);
      qc.invalidateQueries({ queryKey: ["security-settings"] });
      Alert.alert("Salvo", "Configurações de segurança atualizadas com sucesso.");
    },
    onError: (e: any) => Alert.alert("Erro", e.message),
  });

  if (isLoading || !form) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Configurações de Segurança</Text>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const minLen = parseInt(form.min_password_length) || 6;
  const requireNumber = form.require_number === "true";
  const requireLetter = form.require_letter === "true";
  const forceReset = form.force_reset_on_first_login === "true";

  function update(key: keyof Settings, value: string) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Configurações de Segurança</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>

        {/* Banner info */}
        <View style={styles.infoBanner}>
          <Feather name="shield" size={20} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Política de Senhas</Text>
            <Text style={styles.infoBannerDesc}>Configure as regras aplicadas a novos usuários e ao fluxo de primeiro acesso.</Text>
          </View>
        </View>

        {/* Default password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Senha Padrão de Primeiro Acesso</Text>
          <Text style={styles.sectionDesc}>Senha enviada aos novos colaboradores no convite. Deve ser trocada no primeiro acesso.</Text>
          <View style={styles.inputWrap}>
            <Feather name="lock" size={16} color={C.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.default_password}
              onChangeText={(v) => update("default_password", v)}
              placeholder="Senha padrão"
              placeholderTextColor={C.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Password rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regras de Senha</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Comprimento mínimo</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => update("min_password_length", String(Math.max(4, minLen - 1)))}
              >
                <Feather name="minus" size={16} color={C.text} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{minLen} caracteres</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => update("min_password_length", String(Math.min(20, minLen + 1)))}
              >
                <Feather name="plus" size={16} color={C.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Exigir ao menos um número</Text>
              <Text style={styles.fieldDesc}>Ex: senha123</Text>
            </View>
            <Switch
              value={requireNumber}
              onValueChange={(v) => update("require_number", String(v))}
              trackColor={{ false: C.border, true: "#2563EB" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Exigir ao menos uma letra</Text>
              <Text style={styles.fieldDesc}>Ex: 123abc</Text>
            </View>
            <Switch
              value={requireLetter}
              onValueChange={(v) => update("require_letter", String(v))}
              trackColor={{ false: C.border, true: "#2563EB" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* First login behavior */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primeiro Acesso</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Forçar troca de senha no primeiro login</Text>
              <Text style={styles.fieldDesc}>Novos usuários devem criar sua própria senha antes de acessar o app</Text>
            </View>
            <Switch
              value={forceReset}
              onValueChange={(v) => update("force_reset_on_first_login", String(v))}
              trackColor={{ false: C.border, true: "#2563EB" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <Feather name="eye" size={15} color={C.tint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Regras ativas</Text>
            <Text style={styles.previewRule}>• Mínimo {minLen} caracteres</Text>
            {requireNumber && <Text style={styles.previewRule}>• Ao menos 1 número</Text>}
            {requireLetter && <Text style={styles.previewRule}>• Ao menos 1 letra</Text>}
            {forceReset && <Text style={styles.previewRule}>• Troca obrigatória no primeiro acesso</Text>}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saveMut.isPending && { opacity: 0.7 }]}
          onPress={() => saveMut.mutate(form)}
          disabled={saveMut.isPending}
          activeOpacity={0.8}
        >
          {saveMut.isPending
            ? <ActivityIndicator color="#fff" />
            : <><Feather name="check" size={18} color="#fff" /><Text style={styles.saveBtnText}>Salvar configurações</Text></>
          }
        </TouchableOpacity>
      </ScrollView>
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
  content: { padding: 16, gap: 16 },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1D4ED8", marginBottom: 2 },
  infoBannerDesc: { fontSize: 13, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 18 },
  section: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 14,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  sectionDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: -8 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text, padding: 0 },
  field: { gap: 10 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  fieldDesc: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center", backgroundColor: C.surface,
  },
  counterValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, minWidth: 100, textAlign: "center" },
  switchRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 4,
  },
  previewCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  previewTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#059669", marginBottom: 6 },
  previewRule: { fontSize: 13, color: "#047857", fontFamily: "Inter_400Regular", marginTop: 2 },
  saveBtn: {
    backgroundColor: C.tint, borderRadius: 14, height: 52,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
