import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Atenção", "Por favor, preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>BF</Text>
          </View>
          <Text style={styles.appName}>Beija-flor</Text>
          <Text style={styles.subtitle}>Rede Social Interna</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={C.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.placeholder}
              secureTextEntry={!showPassword}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.footerText}>
            Acesso restrito a colaboradores autorizados
          </Text>
          <Text style={styles.footerText}>Grupo Beija-flor © 2025</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoArea: { alignItems: "center", marginBottom: 48 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.tint,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  appName: {
    fontSize: 28, fontFamily: "Inter_700Bold",
    color: C.text, marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  form: { gap: 4 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 6 },
  input: {
    backgroundColor: C.inputBg,
    borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 16, fontFamily: "Inter_400Regular",
    color: C.text, marginBottom: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2,
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  eyeBtn: {
    width: 52, height: 52, backgroundColor: C.inputBg, borderWidth: 1,
    borderColor: C.inputBorder, borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  eyeText: { fontSize: 18 },
  loginBtn: {
    backgroundColor: C.tint, borderRadius: 14,
    paddingVertical: 17, alignItems: "center",
    marginTop: 28,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: { alignItems: "center", marginTop: 40, gap: 4 },
  footerText: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
});
