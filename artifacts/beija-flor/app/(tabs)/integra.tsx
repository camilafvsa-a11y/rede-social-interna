import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

const TERMS = [
  {
    key: "image_voice_authorization",
    title: "Termo de Autorização de Uso de Imagem e Voz",
    icon: "camera",
    content: `Ao participar de ações, campanhas, eventos, gravações, entrevistas, fotografias ou quaisquer produções realizadas pelo Grupo Beija-flor, o participante autoriza, de forma gratuita, definitiva e por prazo indeterminado, o uso de sua imagem, nome e voz em materiais institucionais, publicitários, promocionais e informativos do Grupo Beija-flor.

Essa autorização abrange, sem limitação, a veiculação em:

• Redes sociais
• Site institucional
• Aplicativos
• Materiais impressos
• Vídeos, áudios e peças digitais
• Campanhas publicitárias em qualquer mídia atual ou futura

O uso poderá ocorrer no Brasil e no exterior, sem que disso decorra qualquer direito a remuneração, compensação ou indenização.

O participante declara estar ciente de que:

• A autorização é concedida de forma espontânea;
• Não haverá limitação de tempo ou território para uso do material;
• O Grupo Beija-flor poderá editar, adaptar ou combinar o conteúdo com outros materiais, respeitando sempre a integridade e a boa imagem do participante;
• Esta autorização não caracteriza vínculo empregatício ou contratual de qualquer natureza.

Ao participar das ações do Grupo Beija-flor, o participante declara estar de acordo com os termos acima.`,
  },
];

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TermCard({ term, acceptance, onAccept }: { term: typeof TERMS[0]; acceptance: any; onAccept: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [checked, setChecked] = useState(false);
  const isSigned = !!acceptance;

  async function handleAccept() {
    if (!checked) {
      Alert.alert("Atenção", "Marque a caixa de confirmação para aceitar o termo.");
      return;
    }
    Alert.alert(
      "Confirmar aceitação",
      "Você confirma que leu e aceita este termo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar", onPress: async () => {
            setAccepting(true);
            try {
              await api.post("/terms/accept", { termKey: term.key, termTitle: term.title });
              onAccept();
            } catch (e: any) {
              Alert.alert("Erro", e.message);
            } finally {
              setAccepting(false);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={[styles.card, isSigned && styles.cardSigned]}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, isSigned && styles.iconWrapSigned]}>
          <Feather name={term.icon as any} size={20} color={isSigned ? "#fff" : C.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{term.title}</Text>
          {isSigned ? (
            <View style={styles.signedRow}>
              <Feather name="check-circle" size={13} color="#059669" />
              <Text style={styles.signedText}>
                Aceito em {formatDateTime(acceptance.acceptedAt)}
              </Text>
            </View>
          ) : (
            <View style={styles.pendingRow}>
              <Feather name="clock" size={13} color={C.warning} />
              <Text style={styles.pendingText}>Aguardando sua assinatura</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Document content */}
      {expanded && (
        <View style={styles.docSection}>
          <View style={styles.docDivider} />
          <ScrollView style={styles.docScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Text style={styles.docText}>{term.content}</Text>
          </ScrollView>

          {!isSigned && (
            <View style={styles.acceptSection}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setChecked(!checked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Feather name="check" size={13} color="#fff" />}
                </View>
                <Text style={styles.checkLabel}>
                  Li e concordo com todos os termos acima
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, (!checked || accepting) && styles.acceptBtnDisabled]}
                onPress={handleAccept}
                disabled={!checked || accepting}
                activeOpacity={0.8}
              >
                {accepting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                    <Feather name="edit-3" size={15} color="#fff" />
                    <Text style={styles.acceptBtnText}>Assinar Termo</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          )}

          {isSigned && (
            <View style={styles.signedBanner}>
              <Feather name="shield" size={16} color="#059669" />
              <Text style={styles.signedBannerText}>
                Você já aceitou os termos{"\n"}
                <Text style={styles.signedBannerDate}>Em {formatDateTime(acceptance.acceptedAt)}</Text>
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function IntegraScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: acceptances = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["my-terms"],
    queryFn: () => api.get("/terms/my"),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  function getAcceptance(key: string) {
    return acceptances.find((a: any) => a.termKey === key) || null;
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Integra</Text>
        <View style={styles.headerBadge}>
          <Feather name="file-text" size={14} color={C.tint} />
          <Text style={styles.headerBadgeText}>Documentos</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Central de Documentos</Text>
            <Text style={styles.bannerDesc}>
              Leia e assine os documentos necessários para sua integração ao Grupo Beija-flor.
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Progresso dos termos</Text>
            <Text style={styles.progressCount}>
              {acceptances.length}/{TERMS.length} assinados
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${TERMS.length > 0 ? (acceptances.length / TERMS.length) * 100 : 0}%` }
              ]}
            />
          </View>
        </View>

        {/* Terms list */}
        <Text style={styles.sectionLabel}>Termos e Documentos</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 40 }} />
        ) : (
          TERMS.map((term) => (
            <TermCard
              key={term.key}
              term={term}
              acceptance={getAcceptance(term.key)}
              onAccept={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["my-terms"] });
              }}
            />
          ))
        )}
      </ScrollView>
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
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  headerBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },

  content: { padding: 16, gap: 14 },

  /* Banner */
  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.tint, borderRadius: 16, padding: 16,
  },
  bannerEmoji: { fontSize: 28 },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  bannerDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", lineHeight: 18 },

  /* Progress */
  progressCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  progressTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  progressCount: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.tint },
  progressBar: {
    height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: C.tint, borderRadius: 3 },

  sectionLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.6,
  },

  /* Term card */
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardSigned: { borderColor: "#bbf7d0" },

  cardHeader: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center",
  },
  iconWrapSigned: { backgroundColor: C.tint },

  cardTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text,
    lineHeight: 20, marginBottom: 4,
  },
  signedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  signedText: { fontSize: 12, color: "#059669", fontFamily: "Inter_500Medium" },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pendingText: { fontSize: 12, color: C.warning, fontFamily: "Inter_500Medium" },

  expandBtn: { padding: 4, marginTop: 2 },

  /* Document content */
  docSection: { paddingHorizontal: 14, paddingBottom: 14 },
  docDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  docScroll: {
    maxHeight: 240,
    backgroundColor: C.surfaceAlt,
    borderRadius: 10, padding: 12,
  },
  docText: {
    fontSize: 13, color: C.text, fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },

  /* Accept */
  acceptSection: { marginTop: 12, gap: 10 },
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  checkLabel: {
    flex: 1, fontSize: 13, color: C.text,
    fontFamily: "Inter_500Medium", lineHeight: 18,
  },
  acceptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 12, paddingVertical: 13,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  acceptBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  acceptBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  /* Signed banner */
  signedBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f0fdf4", borderRadius: 10,
    padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  signedBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#166534" },
  signedBannerDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#166534" },
});
