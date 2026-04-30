import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Modal,
} from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";
import { RichText } from "@/components/RichText";

const C = Colors.light;

// ─── IntegraItem type (matches DB) ─────────────────────────────────────────
type IntegraItem = {
  id: number;
  category: string;
  sectionName: string | null;
  sectionIcon: string | null;
  sectionColor: string | null;
  sectionColorBg: string | null;
  title: string;
  subtitle: string | null;
  content: string | null;
  pdfUrl: string | null;
  requiresSign: boolean;
  requiresRead: boolean;
  actionType: string;
  docKey: string;
  iconName: string | null;
  sortOrder: number;
  isActive: boolean;
  docType: string;
  showInIntegra: boolean;
  showInOnboarding: boolean;
  countsForProgress: boolean;
};

// ─── ValueItem shape ─────────────────────────────────────────────────────────
type ValueItem = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  colorBg: string;
  practices: string[];
};

function integraItemToValue(item: IntegraItem): ValueItem {
  const practices = (item.content || "")
    .split("\n")
    .filter((l) => l.startsWith("• ") || l.startsWith("- "))
    .map((l) => l.replace(/^[•\-]\s+/, "").trim())
    .filter(Boolean);
  return {
    key: item.docKey,
    title: item.title,
    desc: item.subtitle || "",
    icon: item.iconName || "heart",
    color: item.sectionColor || "#2563EB",
    colorBg: item.sectionColorBg || "#EFF6FF",
    practices,
  };
}

// ─── Nossos Valores (fallback static — used when DB has no values category) ──
const VALUES_DATA: ValueItem[] = [
  {
    key: "etica",
    title: "Ética é Inegociável",
    desc: "Atuamos com integridade, lealdade e eficiência em nosso trabalho. A ética é a base de tudo que fazemos, guiando nossas decisões e ações diárias.",
    icon: "shield" as const,
    color: "#2563EB",
    colorBg: "#EFF6FF",
    practices: [
      "Trabalhamos de forma isenta e leal",
      "Temos tolerância zero contra corrupção",
      "Não aceitamos subornos de qualquer espécie",
      "Antes de agir, perguntamos: É legal? É ético? Está de acordo com nossa cultura?",
    ],
  },
  {
    key: "comprometimento",
    title: "Comprometimento em Fazer o Bem",
    desc: "Nosso compromisso vai além dos negócios. Buscamos constantemente elevar os padrões de qualidade e transformar a experiência de cada cliente.",
    icon: "heart" as const,
    color: "#DC2626",
    colorBg: "#FEF2F2",
    practices: [
      "Garantimos a confiança em nosso combustível e excelência alimentar",
      "Nossa equipe é treinada para transformar cada visita em um momento especial",
      "Apoiamos direitos humanos universais e locais de trabalho seguros",
      "Temos consciência do impacto ambiental e trabalhamos para minimizá-lo",
    ],
  },
  {
    key: "simplicidade",
    title: "Simplicidade e Respeito",
    desc: "Nossa característica mais marcante é a simplicidade. Respeitamos a diversidade e tratamos todos com dignidade, criando um ambiente acolhedor.",
    icon: "users" as const,
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    practices: [
      "Tratamos superiores, subordinados, fornecedores e clientes com dignidade",
      "Somos contrários a todo tipo de preconceito e discriminação",
      "Promovemos um ambiente seguro, sem assédio ou injustiça",
      "Respeitamos a privacidade de todos os colegas de trabalho",
    ],
  },
  {
    key: "trabalho_equipe",
    title: "Trabalho em Equipe é Indispensável",
    desc: "Crescemos de forma sustentável nos adaptando a diversos momentos. Como o beija-flor, nos mantemos firmes em pleno voo, trabalhando juntos.",
    icon: "star" as const,
    color: "#D97706",
    colorBg: "#FFFBEB",
    practices: [
      "Mais de 600 colaboradores engajados no mesmo propósito",
      "Mantemos um bom relacionamento entre colegas",
      "Cooperamos com investigações quando solicitado",
      "Nossa equipe é comprometida e treinada para servir com excelência",
    ],
  },
];

// ─── Utilitários ─────────────────────────────────────────────────────────────
function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Gráfico circular de progresso ───────────────────────────────────────────
function CircularProgress({ percent, size = 110 }: { percent: number; size?: number }) {
  const sw = 10;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  const done = percent >= 100;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke={C.borderLight} strokeWidth={sw} fill="none" />
      <G rotation="-90" origin={`${cx}, ${cy}`}>
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={done ? "#059669" : C.tint}
          strokeWidth={sw} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ─── Checkbox de leitura ──────────────────────────────────────────────────────
function ReadCheckbox({
  isRead, onPress, loading, actionType,
}: { isRead: boolean; onPress: () => void; loading: boolean; actionType?: string }) {
  const isAceite = actionType === "aceite";
  const pendingLabel = isAceite ? "Li e concordo com este documento" : "Marcar como lido";
  const doneLabel = isAceite ? "Confirmado" : "Marcado como lido";

  return (
    <TouchableOpacity
      style={[styles.readCheckRow, isRead && styles.readCheckRowDone, isAceite && !isRead && styles.readCheckRowAceite]}
      onPress={onPress}
      disabled={isRead || loading}
      activeOpacity={0.8}
    >
      <View style={[styles.readCheck, isRead && styles.readCheckDone]}>
        {loading
          ? <ActivityIndicator size="small" color={C.tint} />
          : isRead
            ? <Feather name="check" size={12} color="#fff" />
            : null}
      </View>
      <Text style={[styles.readCheckLabel, isRead && styles.readCheckLabelDone]}>
        {isRead ? doneLabel : pendingLabel}
      </Text>
      {isRead && <Feather name="check-circle" size={14} color="#059669" />}
      {isAceite && !isRead && !loading && <Feather name="check-square" size={14} color="#D97706" />}
    </TouchableOpacity>
  );
}

// ─── Card de política ─────────────────────────────────────────────────────────
function PolicyCard({
  item, sectionColor, sectionColorBg, isRead, onMarkRead, markLoading,
}: {
  item: IntegraItem;
  sectionColor: string;
  sectionColorBg: string;
  isRead: boolean;
  onMarkRead: () => void;
  markLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.policyCard}>
      <TouchableOpacity
        style={styles.policyCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={[styles.policyIcon, { backgroundColor: sectionColorBg }]}>
          <Feather name={(item.iconName as any) || "file-text"} size={16} color={sectionColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.policyTitleRow}>
            <Text style={styles.policyTitle} numberOfLines={expanded ? undefined : 1}>
              {item.title}
            </Text>
            {/* Badge based on actionType + read status */}
            {(item.actionType === "aceite" || (item.actionType !== "assinatura" && item.requiresRead)) && !isRead && (
              <View style={styles.aceitePendenteBadge}>
                <Feather name="check-square" size={9} color="#D97706" />
                <Text style={styles.aceitePendenteText}>Confirmar</Text>
              </View>
            )}
            {(item.actionType === "aceite" || (item.actionType !== "assinatura" && item.requiresRead)) && isRead && (
              <View style={styles.readBadge}>
                <Feather name="check" size={9} color="#059669" />
                <Text style={styles.readBadgeText}>Aceito</Text>
              </View>
            )}
            {(item.actionType === "informativo" && !item.requiresRead) && !isRead && (
              <View style={styles.informativoBadgeApp}>
                <Feather name="eye" size={9} color="#6B7280" />
                <Text style={styles.informativoText}>Pendente</Text>
              </View>
            )}
            {(item.actionType === "informativo" && !item.requiresRead) && isRead && (
              <View style={styles.readBadge}>
                <Feather name="check" size={9} color="#059669" />
                <Text style={styles.readBadgeText}>Lido</Text>
              </View>
            )}
          </View>
          {!expanded && (
            <Text style={styles.policyDesc} numberOfLines={2}>{item.subtitle}</Text>
          )}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-right"}
          size={18}
          color={C.textMuted}
          style={{ marginLeft: 4, flexShrink: 0 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.policyContent}>
          <View style={styles.policyDivider} />
          <RichText content={item.content || ""} baseSize={13} />
          <View style={{ marginTop: 14 }}>
            <ReadCheckbox isRead={isRead} onPress={onMarkRead} loading={markLoading} />
          </View>
        </View>
      )}
    </View>
  );
}

function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "Não informado";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// ─── Card de termo ────────────────────────────────────────────────────────────
function TermCard({
  term, acceptance, onAccept, isRead, onMarkRead, userName, userCpf,
}: {
  term: IntegraItem;
  acceptance: any;
  onAccept: () => void;
  isRead: boolean;
  onMarkRead: () => void;
  userName?: string;
  userCpf?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isSigned = !!acceptance;

  useEffect(() => {
    if (isSigned && !isRead) {
      onMarkRead();
    }
  }, [isSigned]);

  async function handleAccept() {
    if (!checked) {
      Alert.alert("Atenção", "Marque a caixa de confirmação para aceitar o termo.");
      return;
    }
    setShowConfirmModal(true);
  }

  async function confirmSign() {
    setShowConfirmModal(false);
    setAccepting(true);
    try {
      await api.post("/terms/accept", { termKey: term.docKey, termTitle: term.title });
      onMarkRead();
      onAccept();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View style={[styles.termCard, isSigned && styles.termCardSigned]}>
      <TouchableOpacity
        style={styles.policyCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={[styles.policyIcon, { backgroundColor: isSigned ? "#EFF6FF" : "#FEE2E2" }]}>
          <Feather name={(term.iconName as any) || "file-text"} size={16} color={isSigned ? C.tint : "#EF4444"} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.policyTitleRow}>
            <Text style={styles.policyTitle} numberOfLines={expanded ? undefined : 1}>
              {term.title}
            </Text>
            <View style={[styles.requiredBadge, isSigned && styles.signedBadge]}>
              {isSigned ? <Feather name="check" size={10} color="#059669" /> : null}
              <Text style={[styles.requiredText, isSigned && { color: "#059669" }]}>
                {isSigned ? "Assinado" : "Pendente"}
              </Text>
            </View>
          </View>
          {isSigned
            ? <Text style={styles.signedSubtext}>Aceito em {formatDateTime(acceptance.acceptedAt)}</Text>
            : <Text style={styles.policyDesc} numberOfLines={1}>Toque para ler e assinar</Text>
          }
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-right"}
          size={18}
          color={C.textMuted}
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.policyContent}>
          <View style={styles.policyDivider} />
          <ScrollView style={styles.docScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <RichText content={term.content || ""} baseSize={13} />
          </ScrollView>

          {!isSigned && (
            <View style={{ marginTop: 12, gap: 10 }}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setChecked(!checked)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.checkLabel}>Li e concordo com todos os termos acima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, (!checked || accepting) && { opacity: 0.4 }]}
                onPress={handleAccept}
                disabled={!checked || accepting}
                activeOpacity={0.8}
              >
                {accepting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                    <Feather name="edit-3" size={14} color="#fff" />
                    <Text style={styles.acceptBtnText}>Assinar Termo</Text>
                  </>
                }
              </TouchableOpacity>
            </View>
          )}

          {isSigned && (
            <View style={styles.signedBanner}>
              <Feather name="shield" size={14} color="#059669" />
              <Text style={styles.signedBannerText}>
                Assinado em {formatDateTime(acceptance.acceptedAt)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Confirmation Modal ── */}
      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.termModalOverlay}>
          <View style={styles.termModalSheet}>
            <View style={styles.termModalHeader}>
              <View style={styles.termModalIconWrap}>
                <Feather name="alert-triangle" size={20} color="#B45309" />
              </View>
              <Text style={styles.termModalTitle}>Confirmar Assinatura</Text>
            </View>

            <View style={styles.termModalWarningBox}>
              <Text style={styles.termModalWarningText}>
                Ao assinar este termo, você autoriza o uso da sua imagem e voz pelo Grupo Beija-flor. Essa autorização{" "}
                <Text style={{ fontFamily: "Inter_700Bold" }}>não garante remuneração extra</Text>
                {" "}e poderá ser utilizada em materiais institucionais, publicitários e redes sociais do grupo.
              </Text>
            </View>

            <View style={styles.termModalUserCard}>
              <View style={styles.termModalUserRow}>
                <Feather name="user" size={14} color={C.textSecondary} />
                <Text style={styles.termModalUserLabel}>Nome:</Text>
                <Text style={styles.termModalUserValue}>{userName || "—"}</Text>
              </View>
              <View style={styles.termModalUserRow}>
                <Feather name="credit-card" size={14} color={C.textSecondary} />
                <Text style={styles.termModalUserLabel}>CPF:</Text>
                <Text style={styles.termModalUserValue}>{formatCpf(userCpf)}</Text>
              </View>
            </View>

            <Text style={styles.termModalConsentText}>
              Ao confirmar, você declara que leu, compreendeu e aceita todos os termos acima em seu nome.
            </Text>

            <View style={styles.termModalBtnRow}>
              <TouchableOpacity style={styles.termModalCancelBtn} onPress={() => setShowConfirmModal(false)} activeOpacity={0.8}>
                <Text style={styles.termModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.termModalConfirmBtn} onPress={confirmSign} activeOpacity={0.8}>
                <Feather name="check" size={15} color="#fff" />
                <Text style={styles.termModalConfirmText}>Assinar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Card de valores ──────────────────────────────────────────────────────────
function ValueCard({
  value, isRead, onMarkRead, markLoading,
}: {
  value: ValueItem;
  isRead: boolean;
  onMarkRead: () => void;
  markLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.valueCard, { borderLeftColor: value.color, backgroundColor: C.surface }]}>
      <TouchableOpacity
        style={styles.valueCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={[styles.valueIcon, { backgroundColor: value.colorBg }]}>
          <Feather name={value.icon as any} size={20} color={value.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.valueTitle, { flex: 1 }]}>{value.title}</Text>
            {isRead && (
              <View style={styles.readBadge}>
                <Feather name="check" size={9} color="#059669" />
                <Text style={styles.readBadgeText}>Lido</Text>
              </View>
            )}
          </View>
          <Text style={styles.valueDesc} numberOfLines={expanded ? undefined : 2}>
            {value.desc}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={C.textMuted}
          style={{ marginLeft: 6, flexShrink: 0 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.valueContent, { backgroundColor: value.colorBg }]}>
          <View style={styles.valueDivider} />
          <Text style={styles.practicesLabel}>Como praticamos:</Text>
          {value.practices.map((practice, i) => (
            <View key={i} style={styles.practiceRow}>
              <View style={[styles.practiceCheck, { backgroundColor: C.tint }]}>
                <Feather name="check" size={10} color="#fff" />
              </View>
              <Text style={styles.practiceText}>{practice}</Text>
            </View>
          ))}
          <View style={{ marginTop: 6 }}>
            <ReadCheckbox isRead={isRead} onPress={onMarkRead} loading={markLoading} />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function IntegraScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const [markingKey, setMarkingKey] = useState<string | null>(null);

  const { data: currentUser } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me"),
    staleTime: 60_000,
  });

  const { data: acceptances = [], isLoading: termsLoading, refetch: refetchTerms } = useQuery<any[]>({
    queryKey: ["my-terms"],
    queryFn: () => api.get("/terms/my"),
  });

  const { data: docsProgress, refetch: refetchDocs } = useQuery<{
    readKeys: string[];
    completionCount: number;
    totalDocs: number;
  }>({
    queryKey: ["my-docs-progress"],
    queryFn: () => api.get("/docs/my"),
    initialData: { readKeys: [], completionCount: 0, totalDocs: 15 },
  });

  const { data: integraItems = [], isLoading: itemsLoading } = useQuery<IntegraItem[]>({
    queryKey: ["integra-items"],
    queryFn: () => api.get("/integra-items"),
    staleTime: 60_000,
  });

  const readKeysSet = new Set(docsProgress?.readKeys ?? []);

  async function markRead(key: string) {
    if (readKeysSet.has(key)) return;
    setMarkingKey(key);
    try {
      await api.post("/docs/mark", { documentKey: key });
      await refetchDocs();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o progresso.");
    } finally {
      setMarkingKey(null);
    }
  }

  function getAcceptance(key: string) {
    return acceptances.find((a: any) => a.termKey === key) || null;
  }

  // Split items: values / terms (requiresSign) / policy sections
  const valueItems = integraItems.filter((i) => i.category === "values");
  const displayValues: ValueItem[] = valueItems.length > 0
    ? valueItems.map(integraItemToValue)
    : VALUES_DATA;

  const terms = integraItems.filter((i) => i.requiresSign && i.category !== "values");
  const policyItems = integraItems.filter((i) => !i.requiresSign && i.category !== "values");

  // Group policies by sectionName
  const sectionMap = new Map<string, { icon: string; color: string; colorBg: string; items: IntegraItem[] }>();
  for (const item of policyItems) {
    const sName = item.sectionName || item.category || "Outros";
    if (!sectionMap.has(sName)) {
      sectionMap.set(sName, {
        icon: item.sectionIcon || "file-text",
        color: item.sectionColor || C.tint,
        colorBg: item.sectionColorBg || "#EFF6FF",
        items: [],
      });
    }
    sectionMap.get(sName)!.items.push(item);
  }
  const sections = Array.from(sectionMap.entries()).map(([section, data]) => ({ section, ...data }));

  const signedCount = terms.filter((t) => getAcceptance(t.docKey)).length;
  const docsReadCount = readKeysSet.size;
  const totalDocs = docsProgress?.totalDocs ?? 15;
  const totalRead = Math.min(docsReadCount, totalDocs);
  const percent = totalDocs > 0 ? Math.round((totalRead / totalDocs) * 100) : 0;
  const completionCount = docsProgress?.completionCount ?? 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Integra</Text>
        <View style={styles.headerBadge}>
          <Feather name="file-text" size={13} color={C.tint} />
          <Text style={styles.headerBadgeText}>Central de Documentos</Text>
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
            <Text style={styles.bannerTitle}>Documentos & Políticas</Text>
            <Text style={styles.bannerDesc}>
              Leia, conheça e assine os documentos do Grupo Beija-flor.
            </Text>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressLeft}>
            <View style={{ position: "relative", width: 110, height: 110, alignItems: "center", justifyContent: "center" }}>
              <CircularProgress percent={percent} size={110} />
              <View style={styles.progressCenter}>
                <Text style={[styles.progressPercent, percent >= 100 && { color: "#059669" }]}>
                  {percent}%
                </Text>
                <Text style={styles.progressSmall}>lido</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressRight}>
            <Text style={styles.progressTitle}>Meu Progresso</Text>
            <View style={styles.progressStat}>
              <Feather name="file-text" size={14} color={C.tint} />
              <Text style={styles.progressStatText}>
                <Text style={styles.progressStatBold}>{totalRead}</Text>/{totalDocs} documentos lidos
              </Text>
            </View>
            {terms.length > 0 && (
              <View style={styles.progressStat}>
                <Feather name="edit-3" size={14} color={C.tint} />
                <Text style={styles.progressStatText}>
                  <Text style={styles.progressStatBold}>{signedCount}</Text>/{terms.length} termos assinados
                </Text>
              </View>
            )}
            {completionCount > 0 && (
              <View style={[styles.progressStat, { marginTop: 4 }]}>
                <Feather name="award" size={14} color="#D97706" />
                <Text style={[styles.progressStatText, { color: "#D97706" }]}>
                  <Text style={styles.progressStatBold}>{completionCount}×</Text> completou 100%
                </Text>
              </View>
            )}
            {percent >= 100 && (
              <View style={styles.progressDoneBadge}>
                <Feather name="check-circle" size={12} color="#059669" />
                <Text style={styles.progressDoneText}>Tudo lido!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Loading state */}
        {itemsLoading && (
          <ActivityIndicator size="large" color={C.tint} style={{ marginTop: 24 }} />
        )}

        {/* ── Termos para Assinar ── */}
        {terms.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="edit-3" size={14} color={C.tint} />
              </View>
              <Text style={styles.sectionTitle}>Termos para Assinar</Text>
            </View>

            <View style={styles.groupCard}>
              {termsLoading
                ? <ActivityIndicator size="small" color={C.tint} style={{ margin: 16 }} />
                : terms.map((term, i) => (
                  <React.Fragment key={term.docKey}>
                    {i > 0 && <View style={styles.itemDivider} />}
                    <TermCard
                      term={term}
                      acceptance={getAcceptance(term.docKey)}
                      isRead={readKeysSet.has(term.docKey)}
                      onMarkRead={() => markRead(term.docKey)}
                      onAccept={() => {
                        refetchTerms();
                        qc.invalidateQueries({ queryKey: ["my-terms"] });
                      }}
                      userName={currentUser?.name}
                      userCpf={currentUser?.cpf}
                    />
                  </React.Fragment>
                ))
              }
            </View>
          </>
        )}

        {/* ── Seções de Políticas (dinâmicas) ── */}
        {sections.map((section) => (
          <View key={section.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: section.colorBg }]}>
                <Feather name={section.icon as any} size={14} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.section}</Text>
            </View>

            <View style={styles.groupCard}>
              {section.items.map((item, i) => (
                <React.Fragment key={item.docKey}>
                  {i > 0 && <View style={styles.itemDivider} />}
                  <PolicyCard
                    item={item}
                    sectionColor={section.color}
                    sectionColorBg={section.colorBg}
                    isRead={readKeysSet.has(item.docKey)}
                    onMarkRead={() => markRead(item.docKey)}
                    markLoading={markingKey === item.docKey}
                  />
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* ── Nossos Valores ── */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="heart" size={14} color="#DC2626" />
          </View>
          <Text style={styles.sectionTitle}>Nossos Valores</Text>
        </View>

        <View style={styles.valueBanner}>
          <Feather name="zap" size={22} color="rgba(255,255,255,0.7)" />
          <Text style={styles.valueBannerText}>
            "Nossos valores servem como base para todas as nossas operações e interações. Eles orientam nossas ações diárias e definem quem somos."
          </Text>
        </View>

        {displayValues.map((value) => (
          <ValueCard
            key={value.key}
            value={value}
            isRead={readKeysSet.has(value.key)}
            onMarkRead={() => markRead(value.key)}
            markLoading={markingKey === value.key}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
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
    backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  headerBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.tint },

  content: { padding: 16, gap: 10 },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.tint, borderRadius: 16, padding: 16, marginBottom: 4,
  },
  bannerEmoji: { fontSize: 26 },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 2 },
  bannerDesc: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },

  /* Progress card */
  progressCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    flexDirection: "row", alignItems: "center", gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  progressLeft: { alignItems: "center" },
  progressCenter: {
    position: "absolute",
    alignItems: "center",
  },
  progressPercent: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: C.tint, lineHeight: 26,
  },
  progressSmall: { fontSize: 10, fontFamily: "Inter_500Medium", color: C.textMuted },
  progressRight: { flex: 1, gap: 6 },
  progressTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 2 },
  progressStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressStatText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
  progressStatBold: { fontFamily: "Inter_700Bold", color: C.text },
  progressDoneBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F0FDF4", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: "flex-start", marginTop: 2,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  progressDoneText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" },

  /* Section header */
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, marginBottom: 4, paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text },

  /* Group card */
  groupCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  itemDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 14 },

  /* Policy card */
  policyCard: { overflow: "hidden" },
  termCard: { overflow: "hidden" },
  termCardSigned: {},

  policyCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
  },
  policyIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  policyTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" },
  policyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  policyDesc: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 17 },
  signedSubtext: { fontSize: 12, color: "#059669", fontFamily: "Inter_500Medium" },

  /* Badges */
  requiredBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, flexShrink: 0,
  },
  requiredText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  signedBadge: { backgroundColor: "#F0FDF4" },
  readBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F0FDF4", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, flexShrink: 0, borderWidth: 1, borderColor: "#BBF7D0",
  },
  readBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#059669" },
  aceitePendenteBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FFFBEB", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, flexShrink: 0, borderWidth: 1, borderColor: "#FDE68A",
  },
  aceitePendenteText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  informativoBadgeApp: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F9FAFB", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, flexShrink: 0, borderWidth: 1, borderColor: "#E5E7EB",
  },
  informativoText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#6B7280" },

  /* Read checkbox row */
  readCheckRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  readCheckRowDone: {
    backgroundColor: "#F0FDF4", borderColor: "#BBF7D0",
  },
  readCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  readCheckDone: { backgroundColor: "#059669", borderColor: "#059669" },
  readCheckLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  readCheckLabelDone: { color: "#059669" },

  /* Policy content */
  policyContent: { paddingHorizontal: 14, paddingBottom: 14 },
  policyDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  policyContentText: {
    fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 21,
  },

  /* Term scrollable doc */
  docScroll: { maxHeight: 220, backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12 },

  /* Term sign */
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  checkLabel: { flex: 1, fontSize: 13, color: C.text, fontFamily: "Inter_500Medium", lineHeight: 18 },
  acceptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.tint, borderRadius: 10, paddingVertical: 12,
  },
  acceptBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  /* Signed banner */
  signedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, marginTop: 12,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  signedBannerText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#166534" },

  /* Value banner (quote) */
  valueBanner: {
    backgroundColor: C.tint, borderRadius: 14, padding: 18,
    alignItems: "center", gap: 10,
  },
  valueBannerText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff",
    textAlign: "center", lineHeight: 22,
  },

  /* Value cards */
  valueCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 4,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  valueCardHeader: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14,
  },
  valueIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  valueTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: C.text, marginBottom: 4,
  },
  valueDesc: {
    fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18,
  },
  valueContent: { paddingHorizontal: 14, paddingBottom: 16 },
  valueDivider: { height: 1, backgroundColor: C.borderLight, marginBottom: 12 },
  practicesLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
  },
  practiceRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8,
  },
  practiceCheck: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  practiceText: {
    flex: 1, fontSize: 13, color: C.text,
    fontFamily: "Inter_400Regular", lineHeight: 19,
  },

  /* ── Term Confirmation Modal ── */
  termModalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  termModalSheet: {
    backgroundColor: C.surface, borderRadius: 20, padding: 20,
    width: "100%", maxWidth: 400,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
  },
  termModalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  termModalIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center",
  },
  termModalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: C.text, flex: 1 },
  termModalWarningBox: {
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  termModalWarningText: { fontSize: 13, color: "#92400E", fontFamily: "Inter_400Regular", lineHeight: 19 },
  termModalUserCard: {
    backgroundColor: C.surfaceAlt, borderRadius: 10, padding: 12, gap: 8, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
  },
  termModalUserRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  termModalUserLabel: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_500Medium", width: 40 },
  termModalUserValue: { fontSize: 13, color: C.text, fontFamily: "Inter_600SemiBold", flex: 1 },
  termModalConsentText: {
    fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular",
    lineHeight: 15, marginBottom: 16, textAlign: "center",
  },
  termModalBtnRow: { flexDirection: "row", gap: 10 },
  termModalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, alignItems: "center",
  },
  termModalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  termModalConfirmBtn: {
    flex: 1.5, paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.tint, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  termModalConfirmText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
