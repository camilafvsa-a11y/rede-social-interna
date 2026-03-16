import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const C = Colors.light;

const ADMIN_SECTIONS = [
  { icon: "users", title: "Usuários", desc: "Gerenciar usuários e permissões", route: "/admin/users" },
  { icon: "mail", title: "E-mails Autorizados", desc: "Controlar quem pode acessar o app", route: "/admin/emails" },
  { icon: "hash", title: "Canais", desc: "Criar e editar canais", route: "/admin/channels" },
  { icon: "help-circle", title: "Responsáveis por Chamados", desc: "Gerenciar equipe de suporte", route: "/admin/ticket-handlers" },
  { icon: "flag", title: "Denúncias", desc: "Ver comentários reportados", route: "/admin/reports" },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Painel Admin</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: botPad + 20 }]}>
        <View style={styles.banner}>
          <Feather name="shield" size={24} color={C.tint} />
          <View>
            <Text style={styles.bannerTitle}>Painel de Administração</Text>
            <Text style={styles.bannerDesc}>Gerencie usuários, canais e configurações</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {ADMIN_SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.route}
              style={styles.card}
              onPress={() => router.push(section.route as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardIcon}>
                <Feather name={section.icon as any} size={22} color={C.tint} />
              </View>
              <Text style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.cardDesc}>{section.desc}</Text>
              <Feather name="chevron-right" size={16} color={C.textMuted} style={styles.cardArrow} />
            </TouchableOpacity>
          ))}
        </View>
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
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#f0fdf4", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text },
  bannerDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  grid: { gap: 10 },
  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  cardArrow: { position: "absolute", right: 16, top: 16 },
});
