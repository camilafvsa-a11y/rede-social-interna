import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
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

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${day} de ${MONTHS_SHORT[month - 1]}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const [updating, setUpdating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const isAdmin = user?.role === "admin" || user?.role === "master_admin";
  const tagStyle = user?.tag ? (C.tagColors as any)[user.tag] : null;

  const { data: birthdays = [] } = useQuery<any[]>({
    queryKey: ["birthdays-preview"],
    queryFn: () => api.get("/birthdays?days=30"),
    staleTime: 5 * 60 * 1000,
  });

  const todayBirthdays = birthdays.filter((b: any) => b.daysUntil === 0);
  const upcomingBirthdays = birthdays.filter((b: any) => b.daysUntil > 0).slice(0, 3);
  const previewList = todayBirthdays.length > 0 ? todayBirthdays.slice(0, 3) : upcomingBirthdays;

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUpdating(true);
      try {
        const updated = await api.post(`/users/${user?.id}/avatar`, { avatarUrl: result.assets[0].uri });
        updateUser(updated);
      } catch (e: any) {
        Alert.alert("Erro", e.message);
      } finally {
        setUpdating(false);
      }
    }
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "Não informado";
    const [year, month, day] = dateStr.split("-").map(Number);
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${day} de ${months[month - 1]} de ${year}`;
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
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
        <TouchableOpacity onPress={changeAvatar} activeOpacity={0.8} style={styles.avatarContainer}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Feather name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.roleBadge]}>
            <Text style={styles.roleText}>{ROLE_LABELS[user?.role || "user"]}</Text>
          </View>
          {tagStyle && user?.tag && (
            <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
              <Text style={[styles.tagText, { color: tagStyle.text }]}>{TAG_LABELS[user.tag]}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Aniversários do Time ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aniversários do Time</Text>
        <TouchableOpacity
          style={styles.birthdayCard}
          onPress={() => router.push("/birthdays" as any)}
          activeOpacity={0.85}
        >
          {/* Card header */}
          <View style={styles.birthdayCardHeader}>
            <View style={styles.birthdayIconBox}>
              <Text style={styles.birthdayIconEmoji}>🎂</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.birthdayCardTitle}>Aniversários do Time</Text>
              <Text style={styles.birthdayCardSub}>
                {todayBirthdays.length > 0
                  ? `🎉 ${todayBirthdays.length} aniversário${todayBirthdays.length > 1 ? "s" : ""} hoje!`
                  : upcomingBirthdays.length > 0
                    ? `${upcomingBirthdays.length} próximos em 30 dias`
                    : "Nenhum aniversário em 30 dias"}
              </Text>
            </View>
            <View style={styles.birthdayVerTodos}>
              <Text style={styles.birthdayVerTodosText}>Ver todos</Text>
              <Feather name="chevron-right" size={14} color={C.tint} />
            </View>
          </View>

          {/* Preview list */}
          {previewList.length > 0 && (
            <View style={styles.birthdayPreviewList}>
              {previewList.map((b: any, i: number) => (
                <View key={b.id} style={[styles.birthdayPreviewRow, i > 0 && styles.birthdayPreviewBorder]}>
                  {b.avatarUrl ? (
                    <Image source={{ uri: b.avatarUrl }} style={styles.birthdayAvatar} />
                  ) : (
                    <View style={[styles.birthdayAvatarFallback, b.daysUntil === 0 && { backgroundColor: "#059669" }]}>
                      <Text style={styles.birthdayAvatarInitial}>{b.name?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.birthdayPreviewName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.birthdayPreviewDate}>
                    {b.daysUntil === 0
                      ? "🎉 Hoje!"
                      : b.birthDate
                        ? formatDayMonth(b.birthDate)
                        : `em ${b.daysUntil}d`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {previewList.length === 0 && (
            <View style={styles.birthdayEmptyRow}>
              <Text style={styles.birthdayEmptyText}>Nenhum aniversário nos próximos 30 dias</Text>
            </View>
          )}
        </TouchableOpacity>
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
          <TouchableOpacity style={styles.actionRow} onPress={changeAvatar} activeOpacity={0.8}>
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
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold" },
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
  infoCard: { backgroundColor: C.surface, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  infoLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium", marginTop: 1 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  actionText: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FECACA" },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.danger },

  /* Birthday card */
  birthdayCard: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1.5, borderColor: "#BFDBFE",
    overflow: "hidden",
    shadowColor: "#2563EB", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  birthdayCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight,
    backgroundColor: "#EFF6FF",
  },
  birthdayIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center", justifyContent: "center",
  },
  birthdayIconEmoji: { fontSize: 22 },
  birthdayCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E40AF" },
  birthdayCardSub: { fontSize: 12, color: "#3B82F6", fontFamily: "Inter_400Regular", marginTop: 2 },
  birthdayVerTodos: { flexDirection: "row", alignItems: "center", gap: 2 },
  birthdayVerTodosText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },

  /* Preview list */
  birthdayPreviewList: { paddingVertical: 4 },
  birthdayPreviewRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  birthdayPreviewBorder: { borderTopWidth: 1, borderTopColor: C.borderLight },
  birthdayAvatar: { width: 34, height: 34, borderRadius: 17 },
  birthdayAvatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
  },
  birthdayAvatarInitial: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  birthdayPreviewName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  birthdayPreviewDate: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },

  birthdayEmptyRow: { padding: 14, alignItems: "center" },
  birthdayEmptyText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular" },
});
