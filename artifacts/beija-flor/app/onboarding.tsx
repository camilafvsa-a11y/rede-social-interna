import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Image, Platform, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Etapas ────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "photo",    title: "Foto de Perfil",        description: "Adicione uma foto para que seus colegas possam te reconhecer" },
  { id: "docs",     title: "Documentos & Políticas", description: "Leia os documentos do Grupo Beija-flor para continuar" },
  { id: "terms",    title: "Termo de Imagem",        description: "Leia e assine o termo de uso de imagem e voz" },
];

// ─── Política ──────────────────────────────────────────────────────────────
type PolicyItem = {
  key: string;
  title: string;
  subtitle: string;
  content: string;
  required: boolean;
  icon: string;
};
type PolicySection = {
  section: string;
  icon: string;
  color: string;
  colorBg: string;
  items: PolicyItem[];
};

const POLICY_SECTIONS: PolicySection[] = [
  {
    section: "Código de Conduta",
    icon: "shield",
    color: "#2563EB",
    colorBg: "#EFF6FF",
    items: [
      {
        key: "anticorrupcao",
        title: "Tolerância Zero Contra Corrupção",
        subtitle: "Trabalhamos de forma isenta e leal, sem aceitar subornos de qualquer espécie.",
        required: true,
        icon: "shield-off",
        content: `O Grupo Beija-flor tem tolerância zero contra corrupção.

Nossos Compromissos:
• Trabalhamos de forma isenta e leal
• Não prometemos, damos, oferecemos, solicitamos ou concordamos em receber ou aceitar subornos de qualquer espécie
• Denunciamos e adotamos medidas para impedir e prevenir a corrupção

Antes de Agir, Pergunte-se:
• O que eu pretendo fazer é legal?
• É ético?
• Está de acordo com a cultura do Grupo Beija-flor?`,
      },
      {
        key: "codigo_conduta",
        title: "Código de Conduta",
        subtitle: "Diretrizes de comportamento profissional.",
        required: true,
        icon: "book-open",
        content: `Nossa empresa valoriza um ambiente de trabalho respeitoso e inclusivo.

Princípios Básicos:
• Respeito: Trate todos os colegas com dignidade
• Integridade: Seja honesto e transparente
• Colaboração: Trabalhe em equipe e apoie seus colegas
• Profissionalismo: Mantenha uma postura profissional

Políticas de Não-Discriminação:
Não toleramos qualquer forma de discriminação por raça, gênero, idade, orientação sexual, religião ou deficiência.`,
      },
      {
        key: "assedio",
        title: "Assédio Moral e Sexual",
        subtitle: "Ambiente seguro, sem discriminação nem violência.",
        required: true,
        icon: "alert-triangle",
        content: `O Grupo Beija-flor não admite qualquer tipo de assédio moral e sexual.

Condutas Proibidas:
• Atitudes que prejudiquem o desempenho no ambiente de trabalho
• Propostas ou insinuações sexuais verbais, gestuais ou físicas
• Ambiente hostil, intimidador ou ofensivo

Nosso Compromisso:
• Promovemos um ambiente seguro, sem discriminação
• Estimulamos denúncias: RH (31) 98496-0448`,
      },
      {
        key: "conduta_profissional",
        title: "Conduta Profissional",
        subtitle: "Integridade e respeito ao horário de trabalho.",
        required: true,
        icon: "briefcase",
        content: `Nossos Compromissos:
• Atuamos de acordo com os valores da empresa
• Cuidamos da nossa reputação pessoal e profissional
• Respeitamos integralmente nosso horário de trabalho
• Questões particulares não devem interferir na rotina

Em Caso de Dúvida:
Se não souber como agir, procure seu gestor ou o RH.
Contato RH: (31) 98496-0448`,
      },
      {
        key: "atendimento_cliente",
        title: "Relacionamento com Clientes",
        subtitle: "Excelência e transparência em cada atendimento.",
        required: true,
        icon: "users",
        content: `Nossa Missão:
Queremos que nossos clientes tenham sempre a melhor experiência.

Princípios de Atendimento:
• Transparência e cordialidade em todos os atendimentos
• Atendimento rápido e cortês
• Não é permitido pedir ou sugerir gorjeta

Como representantes do Grupo Beija-flor, transformamos cada visita em um momento especial.`,
      },
      {
        key: "uniformes",
        title: "Uniformes e Apresentação",
        subtitle: "Uniforme limpo, completo e crachá visível durante toda a jornada.",
        required: true,
        icon: "tag",
        content: `Uso Obrigatório:
• O uniforme deve ser usado em sua totalidade, sempre limpo e passado
• Crachá de identificação durante toda a jornada

Responsabilidades:
• Cuidar do uniforme e usá-lo sempre limpo
• O uniforme é entregue na admissão
• Em caso de desligamento, todo uniforme deve ser devolvido

Para colaboradores que manipulam alimentos:
• Unhas curtas e sem esmaltes
• Não usar perfume
• Manter barba feita / cabelos presos
• Usar touca ou boné`,
      },
      {
        key: "denuncias",
        title: "Denúncias e Ouvidoria",
        subtitle: "Investigamos todas as denúncias com privacidade e sem retaliação.",
        required: true,
        icon: "message-square",
        content: `Processo de Denúncia:
• Todas as denúncias são investigadas
• Qualquer parte envolvida pode ser chamada para prestar esclarecimentos

Seus Direitos:
• Privacidade e confidencialidade reservadas
• Sem retaliação contra quem denuncia de boa-fé

Como Denunciar:
Contato RH: (31) 98496-0448`,
      },
    ],
  },
  {
    section: "Segurança",
    icon: "lock",
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    items: [
      {
        key: "seguranca_info",
        title: "Política de Segurança da Informação",
        subtitle: "Protegendo nossos dados e sistemas.",
        required: true,
        icon: "lock",
        content: `A proteção dos dados é responsabilidade de todos.

Senhas e Acessos:
• Use senhas fortes
• Nunca compartilhe suas credenciais
• Reporte qualquer atividade suspeita

Dados Confidenciais:
• Não compartilhe informações sensíveis externamente
• Use sempre canais oficiais de comunicação`,
      },
    ],
  },
  {
    section: "Recursos Humanos",
    icon: "user-check",
    color: "#D97706",
    colorBg: "#FFFBEB",
    items: [
      {
        key: "pontualidade",
        title: "Pontualidade e Registro de Ponto",
        subtitle: "Ser pontual e registrar o ponto biométrico diariamente.",
        required: true,
        icon: "clock",
        content: `Compromissos:
• Ser pontual e não faltar ao trabalho sem justificativa
• Atestados médicos ao coordenador ou RH no 1.° dia de afastamento

Registro de Ponto Biométrico — deve ser feito diariamente:
• Entrada / Saída para intervalo / Retorno / Saída final

Contato RH: (31) 98496-0448`,
      },
    ],
  },
];

const TERM_CONTENT = `Ao participar de ações, campanhas, eventos, gravações, entrevistas, fotografias ou quaisquer produções realizadas pelo Grupo Beija-flor, o participante autoriza, de forma gratuita, definitiva e por prazo indeterminado, o uso de sua imagem, nome e voz em materiais institucionais, publicitários, promocionais e informativos do Grupo Beija-flor.

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
• O Grupo Beija-flor poderá editar, adaptar ou combinar o conteúdo com outros materiais;
• Esta autorização não caracteriza vínculo empregatício ou contratual.

Ao assinar, você declara que leu, compreendeu e aceita todos os termos acima.`;

// ─── Utils ─────────────────────────────────────────────────────────────────
const allPolicyKeys = POLICY_SECTIONS.flatMap((s) => s.items.map((i) => i.key));
const requiredKeys  = POLICY_SECTIONS.flatMap((s) => s.items.filter((i) => i.required).map((i) => i.key));

// ─── Sub-componente: Card de política ──────────────────────────────────────
function PolicyCard({
  item, color, colorBg, isRead, onToggle,
}: {
  item: PolicyItem;
  color: string;
  colorBg: string;
  isRead: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[pStyles.card, isRead && pStyles.cardRead]}>
      <TouchableOpacity
        style={pStyles.cardHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={[pStyles.icon, { backgroundColor: colorBg }]}>
          <Feather name={item.icon as any} size={15} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={pStyles.titleRow}>
            <Text style={pStyles.title} numberOfLines={expanded ? undefined : 1}>{item.title}</Text>
            {item.required && !isRead && (
              <View style={pStyles.reqBadge}>
                <Text style={pStyles.reqText}>Obrigatório</Text>
              </View>
            )}
            {isRead && (
              <View style={pStyles.doneBadge}>
                <Feather name="check" size={9} color="#059669" />
                <Text style={pStyles.doneText}>Lido</Text>
              </View>
            )}
          </View>
          {!expanded && (
            <Text style={pStyles.subtitle} numberOfLines={2}>{item.subtitle}</Text>
          )}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-right"}
          size={16}
          color={C.textMuted}
          style={{ marginLeft: 4, flexShrink: 0 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={pStyles.body}>
          <View style={pStyles.divider} />
          <Text style={pStyles.content}>{item.content}</Text>
          <TouchableOpacity
            style={[pStyles.readRow, isRead && pStyles.readRowDone]}
            onPress={onToggle}
            disabled={isRead}
            activeOpacity={0.8}
          >
            <View style={[pStyles.checkbox, isRead && pStyles.checkboxDone]}>
              {isRead && <Feather name="check" size={11} color="#fff" />}
            </View>
            <Text style={[pStyles.readLabel, isRead && pStyles.readLabelDone]}>
              {isRead ? "Marcado como lido" : "Marcar como lido"}
            </Text>
            {isRead && <Feather name="check-circle" size={13} color="#059669" />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const pStyles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    marginBottom: 8, overflow: "hidden",
  },
  cardRead: { borderColor: "#BBF7D0" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  subtitle: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  reqBadge: { backgroundColor: "#FEE2E2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  reqText: { fontSize: 9, color: "#DC2626", fontFamily: "Inter_600SemiBold" },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#DCFCE7", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  doneText: { fontSize: 9, color: "#059669", fontFamily: "Inter_600SemiBold" },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  content: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  readRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: C.border,
  },
  readRowDone: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxDone: { backgroundColor: "#059669", borderColor: "#059669" },
  readLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  readLabelDone: { color: "#059669" },
});

// ─── Tela principal ─────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);
  const [readKeys, setReadKeys]     = useState<Set<string>>(new Set());
  const [termChecked, setTermChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function toggleRead(key: string) {
    setReadKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const requiredDone = requiredKeys.every((k) => readKeys.has(k));
  const readCount    = readKeys.size;
  const totalCount   = allPolicyKeys.length;

  // ── Foto ─────────────────────────────────────────────────────────────────
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      try { await api.post(`/users/${user?.id}/avatar`, { avatarUrl: uri }); } catch {}
    }
  }

  // ── Finalizar onboarding ─────────────────────────────────────────────────
  async function completeOnboarding() {
    setLoading(true);
    try {
      for (const key of allPolicyKeys) {
        try { await api.post("/docs/mark", { documentKey: key }); } catch {}
      }
      try {
        await api.post("/terms/accept", {
          termKey:   "image_voice_authorization",
          termTitle: "Termo de Autorização de Uso de Imagem e Voz",
        });
        await api.post("/docs/mark", { documentKey: "image_voice_authorization" });
      } catch {}

      const updated = await api.post("/auth/complete-onboarding", {
        avatarUrl:     avatarUri,
        acceptedTerms: true,
        readDocuments: true,
      });
      updateUser(updated);
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Lógica de avanço ─────────────────────────────────────────────────────
  function canProceed() {
    if (currentStep === 0) return true;
    if (currentStep === 1) return requiredDone;
    if (currentStep === 2) return termChecked;
    return true;
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
    } else {
      setShowConfirmModal(true);
    }
  }

  const step = STEPS[currentStep];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header / progresso */}
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= currentStep && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>Passo {currentStep + 1} de {STEPS.length}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.description}</Text>

        {/* ── Passo 1: Foto ─────────────────────────────────────────────── */}
        {currentStep === 0 && (
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderIcon}>📷</Text>
                  <Text style={styles.avatarPlaceholderText}>Toque para escolher</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Você pode adicionar sua foto depois</Text>
          </View>
        )}

        {/* ── Passo 2: Documentos ───────────────────────────────────────── */}
        {currentStep === 1 && (
          <View style={{ gap: 0, marginTop: 8 }}>
            {/* Progresso de leitura */}
            <View style={styles.readProgress}>
              <Feather name="book-open" size={14} color={C.tint} />
              <Text style={styles.readProgressText}>
                {readCount} de {totalCount} lidos
              </Text>
              {requiredDone && (
                <View style={styles.allDoneBadge}>
                  <Feather name="check-circle" size={12} color="#059669" />
                  <Text style={styles.allDoneText}>Todos obrigatórios concluídos</Text>
                </View>
              )}
            </View>

            {POLICY_SECTIONS.map((sec) => (
              <View key={sec.section} style={{ marginBottom: 16 }}>
                {/* Cabeçalho da seção */}
                <View style={[styles.sectionHeader, { backgroundColor: sec.colorBg }]}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: sec.color + "22" }]}>
                    <Feather name={sec.icon as any} size={14} color={sec.color} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: sec.color }]}>{sec.section}</Text>
                </View>

                {sec.items.map((item) => (
                  <PolicyCard
                    key={item.key}
                    item={item}
                    color={sec.color}
                    colorBg={sec.colorBg}
                    isRead={readKeys.has(item.key)}
                    onToggle={() => toggleRead(item.key)}
                  />
                ))}
              </View>
            ))}

            {!requiredDone && (
              <View style={styles.hintBox}>
                <Feather name="info" size={13} color="#92400E" />
                <Text style={styles.hintText}>
                  Leia e marque todos os itens obrigatórios para continuar
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Passo 3: Termo de Imagem ──────────────────────────────────── */}
        {currentStep === 2 && (
          <View style={styles.documentSection}>
            <View style={styles.termHeaderCard}>
              <View style={styles.termHeaderIcon}>
                <Feather name="camera" size={20} color={C.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.termHeaderTitle}>Termo de Autorização</Text>
                <Text style={styles.termHeaderSub}>Uso de imagem e voz pelo Grupo Beija-flor</Text>
              </View>
            </View>

            <View style={styles.documentCard}>
              <ScrollView style={styles.documentScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <Text style={styles.documentText}>{TERM_CONTENT}</Text>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.checkRow, termChecked && styles.checkRowActive]}
              onPress={() => setTermChecked(!termChecked)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, termChecked && styles.checkboxChecked]}>
                {termChecked && <Feather name="check" size={13} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>Li e concordo com todos os termos acima</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
          onPress={nextStep}
          disabled={!canProceed() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextBtnText}>
                {currentStep === STEPS.length - 1 ? "Assinar e Entrar" : "Continuar"}
              </Text>
              <Feather name={currentStep === STEPS.length - 1 ? "edit-3" : "arrow-right"} size={16} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Modal de confirmação de assinatura ──────────────────────────── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Feather name="alert-triangle" size={20} color="#B45309" />
              </View>
              <Text style={styles.modalTitle}>Confirmar Assinatura</Text>
            </View>

            <View style={styles.modalWarning}>
              <Text style={styles.modalWarningText}>
                Ao assinar este termo, você autoriza o uso da sua imagem e voz pelo Grupo Beija-flor.
                Essa autorização{" "}
                <Text style={{ fontFamily: "Inter_700Bold" }}>não garante remuneração extra</Text>
                {" "}e poderá ser utilizada em materiais institucionais e redes sociais do grupo.
              </Text>
            </View>

            <View style={styles.modalUserCard}>
              <Feather name="user" size={14} color={C.textSecondary} />
              <Text style={styles.modalUserLabel}>Assinante:</Text>
              <Text style={styles.modalUserValue}>{user?.name || "—"}</Text>
            </View>

            <Text style={styles.modalConsent}>
              Ao confirmar, você declara que leu, compreendeu e aceita os termos em seu nome.
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => { setShowConfirmModal(false); completeOnboarding(); }}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                    <Feather name="check" size={15} color="#fff" />
                    <Text style={styles.modalConfirmText}>Assinar e Entrar</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  progressRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.tint },
  stepLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },

  /* Content */
  content: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 16, gap: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text },
  desc: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22 },

  /* Photo step */
  photoSection: { alignItems: "center", gap: 16, marginTop: 16 },
  avatarContainer: { width: 140, height: 140, borderRadius: 70, position: "relative" },
  avatar: { width: 140, height: 140, borderRadius: 70 },
  avatarPlaceholder: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: C.surfaceAlt, borderWidth: 2, borderColor: C.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  avatarPlaceholderIcon: { fontSize: 32 },
  avatarPlaceholderText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  avatarEditBadge: {
    position: "absolute", bottom: 4, right: 4,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  photoHint: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },

  /* Docs step */
  readProgress: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 12,
  },
  readProgressText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.tint, flex: 1 },
  allDoneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  allDoneText: { fontSize: 10, color: "#059669", fontFamily: "Inter_600SemiBold" },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 8, padding: 8, marginBottom: 6,
  },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  hintBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  hintText: { flex: 1, fontSize: 12, color: "#92400E", fontFamily: "Inter_400Regular", lineHeight: 18 },

  /* Terms step */
  documentSection: { gap: 14 },
  termHeaderCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  termHeaderIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.tint + "22", alignItems: "center", justifyContent: "center",
  },
  termHeaderTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.tint },
  termHeaderSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  documentCard: {
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  documentScroll: { maxHeight: 280, padding: 16 },
  documentText: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  checkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  checkRowActive: { borderColor: C.tint, backgroundColor: "#EFF6FF" },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  checkLabel: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },

  /* Footer */
  footer: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: C.background },
  nextBtn: {
    backgroundColor: C.tint, borderRadius: 12, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: C.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  /* Confirmation modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: { backgroundColor: C.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text },
  modalWarning: { backgroundColor: "#FEF9EC", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FDE68A" },
  modalWarningText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular", lineHeight: 20 },
  modalUserCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12,
  },
  modalUserLabel: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  modalUserValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  modalConsent: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, alignItems: "center",
  },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.tint, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  modalConfirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
