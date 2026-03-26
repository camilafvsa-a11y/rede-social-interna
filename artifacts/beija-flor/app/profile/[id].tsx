import React from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TAG_LABELS: Record<string, string> = {
  marketing: "Marketing", adm: "Administrativo", socio: "Sócio",
  posto: "Posto", churrascaria: "Churrascaria", gerente: "Gerente",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Colaborador", moderator: "Moderador",
  admin: "Administrador", master_admin: "Administrador Master",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Não informado";
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day} de ${months[month - 1]} de ${year}`;
}

export default function ProfileViewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get(`/users/${id}`),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const tagStyle = user?.tag ? (C.tagColors as any)[user.tag] : null;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Perfil</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={C.tint} />
        </View>
      ) : user ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 34 : 40 }]}>
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{ROLE_LABELS[user.role] || user.role}</Text>
              </View>
              {tagStyle && user.tag && (
                <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
                  <Text style={[styles.tagText, { color: tagStyle.text }]}>{TAG_LABELS[user.tag]}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="calendar" label="Aniversário" value={formatDate(user.birthDate)} />
              <InfoRow icon="briefcase" label="Data de admissão" value={formatDate(user.admissionDate)} last />
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.loading}>
          <Text style={styles.errorText}>Usuário não encontrado</Text>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Feather name={icon as any} size={16} color={C.tint} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  content: { padding: 16, gap: 16 },
  profileCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 24,
    alignItems: "center", borderWidth: 1, borderColor: C.border,
  },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.tint },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4 },
  email: { fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular", marginBottom: 12 },
  badgeRow: { flexDirection: "row", gap: 8 },
  roleBadge: { backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.tint },
  roleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: {},
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" },
  infoCard: { backgroundColor: C.surface, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  infoLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
});
