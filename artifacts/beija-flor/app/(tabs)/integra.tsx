import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Termos que requerem assinatura ────────────────────────────────────────
const TERMS = [
  {
    key: "image_voice_authorization",
    title: "Termo de Autorização de Uso de Imagem e Voz",
    icon: "camera" as const,
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

// ─── Políticas e documentos (sem assinatura) ──────────────────────────────
const POLICY_SECTIONS = [
  {
    section: "Código de Conduta",
    icon: "shield" as const,
    color: "#2563EB",
    colorBg: "#EFF6FF",
    items: [
      {
        key: "anticorrupcao",
        title: "Tolerância Zero Contra Corrupção",
        desc: "Trabalhamos de forma isenta e leal. Não prometemos, damos, oferecemos, solicitamos ou concordamos em receber ou aceitar subornos.",
        icon: "shield-off" as const,
        required: true,
        content: `O Grupo Beija-flor tem tolerância zero contra corrupção.

Nossos Compromissos:
• Trabalhamos de forma isenta e leal
• Não prometemos, damos, oferecemos, solicitamos ou concordamos em receber ou aceitar subornos de qualquer espécie
• Denunciamos e adotamos medidas para impedir e prevenir a corrupção
• Desqualificamos automaticamente qualquer parceiro que ofereça privilégios ilícitos

Antes de Agir, Pergunte-se:
• O que eu pretendo fazer é legal?
• É ético?
• Está de acordo com a cultura do Grupo Beija-flor?

Se a resposta para qualquer uma dessas perguntas for não, não devemos adotar a conduta avaliada.`,
      },
      {
        key: "codigo_conduta",
        title: "Código de Conduta",
        desc: "Diretrizes de comportamento profissional",
        icon: "book-open" as const,
        required: true,
        content: `Nossa empresa valoriza um ambiente de trabalho respeitoso e inclusivo.

Princípios Básicos:
• Respeito: Trate todos os colegas com dignidade e respeito
• Integridade: Seja honesto e transparente em todas as interações
• Colaboração: Trabalhe em equipe e apoie seus colegas
• Profissionalismo: Mantenha uma postura profissional em todas as situações

Comportamentos Esperados:
• Comunicação clara e respeitosa
• Pontualidade em reuniões e compromissos
• Confidencialidade com informações sensíveis
• Disposição para aprender e ensinar

Políticas de Não-Discriminação:
Não toleramos qualquer forma de discriminação por raça, gênero, idade, orientação sexual, religião ou deficiência.`,
      },
      {
        key: "assedio",
        title: "Assédio Moral e Sexual",
        desc: "O Grupo não admite qualquer tipo de assédio moral ou sexual. Promovemos um ambiente seguro, sem discriminação.",
        icon: "alert-triangle" as const,
        required: true,
        content: `O Grupo Beija-flor não admite qualquer tipo de assédio moral e sexual.

Condutas Proibidas:
• Atitudes que prejudiquem o desempenho no ambiente de trabalho
• Condutas que afetem a dignidade gerando ambiente hostil, intimidador ou ofensivo
• Propostas ou insinuações sexuais verbais, gestuais ou físicas
• Prática de assédio sexual de qualquer natureza

Nosso Compromisso:
• Promovemos um ambiente seguro, sem discriminação, assédio, injustiça ou violência
• Respeitamos a privacidade de todos os colegas
• Somos contrários a todo tipo de preconceito (religião, cultura, raça, idade, gênero, orientação sexual, etc.)

Como Denunciar:
Estimulamos a denúncia através dos canais próprios.
Contato RH: (31) 98496-0448`,
      },
      {
        key: "conduta_profissional",
        title: "Conduta Profissional",
        desc: "Atuamos com integridade e respeitamos nosso horário de trabalho, contribuindo para o crescimento da empresa.",
        icon: "briefcase" as const,
        required: true,
        content: `Nossos Compromissos:
• Atuamos de acordo com os valores da nossa empresa
• Cuidamos da nossa reputação pessoal e profissional
• Respeitamos integralmente nosso horário de trabalho
• Durante o expediente, focamos nas atividades relacionadas ao trabalho

Respeito à Diversidade:
• Tratamos superiores, subordinados, fornecedores e clientes com dignidade e respeito
• Questões particulares e íntimas não devem interferir na rotina de trabalho
• Respeitamos a privacidade de todos

Em Caso de Dúvida:
Se não souber como agir, procure seu gestor ou o RH.

Contato RH: (31) 98496-0448`,
      },
      {
        key: "atendimento_cliente",
        title: "Relacionamento com Clientes",
        desc: "Conscientes de que atuamos como representantes diretos do Grupo, nos comprometemos a fornecer serviços de excelência.",
        icon: "users" as const,
        required: true,
        content: `Nossa Missão:
Queremos que nossos clientes tenham sempre a melhor experiência.

Princípios de Atendimento:
• Primamos pela transparência e cordialidade em todos os atendimentos
• Procuramos realizar atendimento rápido e cortês
• Asseguramos a plena satisfação dos clientes
• Mantemos comunicação clara, franca e confiável

Não é Permitido:
• Pedir ou sugerir o recebimento de gorjeta

Compromisso:
Caso identifiquemos insatisfação, procuramos compreender as razões de maneira respeitosa e corrigir falhas para garantir que os próximos atendimentos sejam satisfatórios.

Como representantes do Grupo Beija-flor, transformamos a visita de cada cliente em seu melhor momento.`,
      },
      {
        key: "parceiros",
        title: "Parceiros e Fornecedores",
        desc: "Elegemos parceiros com base em princípios éticos, idoneidade, qualidade, preço e entrega.",
        icon: "link" as const,
        required: false,
        content: `Critérios de Seleção:
Elegemos nossos parceiros e fornecedores com base em:

• Princípios éticos
• Idoneidade
• Qualidade
• Preço e entrega

Nosso Compromisso:
• Respeitamos e valorizamos nosso relacionamento com todos
• Nos empenhamos por mantê-lo o mais saudável possível
• Desqualificamos automaticamente qualquer parceiro que comprovadamente ofereça privilégios ilícitos

Resultado:
Isso nos leva à escolha dos parceiros mais qualificados e transparentes.`,
      },
      {
        key: "responsabilidade_social",
        title: "Responsabilidade Social",
        desc: "Apoiamos direitos humanos universais e temos consciência do nosso impacto ambiental.",
        icon: "globe" as const,
        required: false,
        content: `Direitos Humanos:
• Apoiamos os direitos humanos universais
• Garantimos direitos iguais de emprego
• Promovemos locais de trabalho seguros
• Respeitamos liberdade de expressão e associação
• Defendemos o direito de todos à educação

Práticas de Trabalho:
• Fazemos oposição a práticas desumanas ou ilegais
• Esperamos que fornecedores e parceiros façam o mesmo

Meio Ambiente:
• Temos consciência de nosso impacto sobre o meio ambiente
• Nos esforçamos para minimizar o impacto de nossas operações
• Investimos em sustentabilidade (usina fotovoltaica)`,
      },
      {
        key: "uniformes",
        title: "Uniformes e Apresentação",
        desc: "O uniforme deve ser usado em sua totalidade, sempre limpo e alinhado. Cuidar do uniforme é zelar pela nossa imagem.",
        icon: "tag" as const,
        required: true,
        content: `Uso Obrigatório:
• O uniforme deve ser usado em sua totalidade
• Sempre limpo e passado
• Crachá de identificação durante toda a jornada

Responsabilidades:
• Cuidar do uniforme e usá-lo sempre limpo e passado
• O uniforme é entregue na admissão
• Troca só mediante apresentação da peça a ser substituída
• Em caso de desligamento, todo uniforme deve ser devolvido

Não é Permitido:
• Alterações ou ajustes no uniforme por parte do colaborador
• Crachá deve estar sempre limpo (cordão pode ser lavado com sabonete)

Para colaboradores que manipulam alimentos:
• Unhas curtas e sem esmaltes
• Não usar perfume (optar por produtos sem odor)
• Manter barba feita
• Cabelos curtos ou presos
• Não usar acessórios ou maquiagem
• Usar touca ou boné`,
      },
      {
        key: "denuncias",
        title: "Denúncias e Ouvidoria",
        desc: "Todas as denúncias são investigadas. Garantimos privacidade e não aceitamos retaliações contra quem denuncia.",
        icon: "message-square" as const,
        required: true,
        content: `Processo de Denúncia:
• Todas as denúncias são investigadas
• Devem conter o máximo de detalhes possíveis com fatos e dados
• Qualquer parte envolvida pode ser chamada para prestar esclarecimentos

Seus Direitos:
• Privacidade e confidencialidade reservadas
• São inaceitáveis quaisquer formas de coação, punição ou retaliação
• Todos os envolvidos recebem informações sobre o resultado das investigações

Nosso Compromisso:
• Somos comprometidos com a verdade
• Cooperamos com investigações
• Não aceitamos atos contra profissionais que denunciam de boa-fé
• Repudiamos denúncias vazias, conspiratórias ou vingativas

Como Denunciar:
Contato RH: (31) 98496-0448`,
      },
    ],
  },
  {
    section: "Segurança",
    icon: "lock" as const,
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    items: [
      {
        key: "seguranca_info",
        title: "Política de Segurança da Informação",
        desc: "Protegendo nossos dados e sistemas",
        icon: "lock" as const,
        required: true,
        content: `A proteção dos dados é responsabilidade de todos.

Senhas e Acessos:
• Use senhas fortes (mínimo 12 caracteres)
• Ative autenticação de dois fatores
• Nunca compartilhe suas credenciais
• Troque suas senhas a cada 90 dias

Uso de Equipamentos:
• Mantenha seu computador bloqueado quando ausente
• Não instale softwares não autorizados
• Use apenas a VPN para acessar sistemas internos
• Reporte qualquer atividade suspeita

Dados Confidenciais:
• Não compartilhe informações sensíveis externamente
• Use sempre canais oficiais de comunicação
• Criptografe arquivos sensíveis`,
      },
    ],
  },
  {
    section: "Recursos Humanos",
    icon: "user-check" as const,
    color: "#D97706",
    colorBg: "#FFFBEB",
    items: [
      {
        key: "pontualidade",
        title: "Pontualidade e Registro de Ponto",
        desc: "Ser pontual e não faltar sem justificativa. Utilizamos registro biométrico diário.",
        icon: "clock" as const,
        required: true,
        content: `A pontualidade é fundamental para o bom funcionamento da equipe e do atendimento.

Nossas diretrizes:
• Seja pontual ao iniciar e encerrar sua jornada de trabalho
• Não falte sem justificativa prévia ou atestado médico
• Utilize o registro biométrico diário obrigatoriamente
• Em caso de atrasos ou faltas, comunique seu gestor imediatamente

Em caso de dúvidas sobre registro de ponto ou jornada:
Contato RH: (31) 98496-0448`,
      },
    ],
  },
];

// ─── Utilitários ───────────────────────────────────────────────────────────
function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Card de política (expansível) ────────────────────────────────────────
function PolicyCard({
  item,
  sectionColor,
  sectionColorBg,
}: {
  item: typeof POLICY_SECTIONS[0]["items"][0];
  sectionColor: string;
  sectionColorBg: string;
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
          <Feather name={item.icon} size={16} color={sectionColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.policyTitleRow}>
            <Text style={styles.policyTitle} numberOfLines={expanded ? undefined : 1}>
              {item.title}
            </Text>
            {item.required && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Obrigatório</Text>
              </View>
            )}
          </View>
          {!expanded && (
            <Text style={styles.policyDesc} numberOfLines={2}>{item.desc}</Text>
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
          <Text style={styles.policyContentText}>{item.content}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Card de termo (com assinatura) ───────────────────────────────────────
function TermCard({
  term,
  acceptance,
  onAccept,
}: {
  term: typeof TERMS[0];
  acceptance: any;
  onAccept: () => void;
}) {
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
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.termCard, isSigned && styles.termCardSigned]}>
      <TouchableOpacity
        style={styles.policyCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={[styles.policyIcon, { backgroundColor: isSigned ? "#EFF6FF" : "#FEE2E2" }]}>
          <Feather name={term.icon} size={16} color={isSigned ? C.tint : "#EF4444"} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.policyTitleRow}>
            <Text style={styles.policyTitle} numberOfLines={expanded ? undefined : 1}>
              {term.title}
            </Text>
            <View style={[styles.requiredBadge, isSigned && styles.signedBadge]}>
              {isSigned
                ? <Feather name="check" size={10} color="#059669" />
                : null}
              <Text style={[styles.requiredText, isSigned && { color: "#059669" }]}>
                {isSigned ? "Assinado" : "Pendente"}
              </Text>
            </View>
          </View>
          {isSigned
            ? <Text style={styles.signedSubtext}>
                Aceito em {formatDateTime(acceptance.acceptedAt)}
              </Text>
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
            <Text style={styles.policyContentText}>{term.content}</Text>
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
    </View>
  );
}

// ─── Tela Principal ────────────────────────────────────────────────────────
export default function IntegraScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 + 84 : 100;

  const { data: acceptances = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["my-terms"],
    queryFn: () => api.get("/terms/my"),
  });

  function getAcceptance(key: string) {
    return acceptances.find((a: any) => a.termKey === key) || null;
  }

  const totalDocs =
    TERMS.length +
    POLICY_SECTIONS.reduce((acc, s) => acc + s.items.length, 0);

  const signedCount = TERMS.filter((t) => getAcceptance(t.key)).length;

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

        {/* Progress bar */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Termos assinados</Text>
            <Text style={styles.progressCount}>{signedCount}/{TERMS.length}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${TERMS.length > 0 ? (signedCount / TERMS.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>

        {/* ── Seção: Termos (com assinatura) ── */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: "#EFF6FF" }]}>
            <Feather name="edit-3" size={14} color={C.tint} />
          </View>
          <Text style={styles.sectionTitle}>Termos para Assinar</Text>
        </View>

        <View style={styles.groupCard}>
          {isLoading
            ? <ActivityIndicator size="small" color={C.tint} style={{ margin: 16 }} />
            : TERMS.map((term, i) => (
              <React.Fragment key={term.key}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TermCard
                  term={term}
                  acceptance={getAcceptance(term.key)}
                  onAccept={() => {
                    refetch();
                    qc.invalidateQueries({ queryKey: ["my-terms"] });
                  }}
                />
              </React.Fragment>
            ))
          }
        </View>

        {/* ── Seções de Políticas ── */}
        {POLICY_SECTIONS.map((section) => (
          <View key={section.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: section.colorBg }]}>
                <Feather name={section.icon} size={14} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.section}</Text>
            </View>

            <View style={styles.groupCard}>
              {section.items.map((item, i) => (
                <React.Fragment key={item.key}>
                  {i > 0 && <View style={styles.itemDivider} />}
                  <PolicyCard
                    item={item}
                    sectionColor={section.color}
                    sectionColorBg={section.colorBg}
                  />
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  /* Header */
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

  /* Banner */
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.tint, borderRadius: 16, padding: 16, marginBottom: 4,
  },
  bannerEmoji: { fontSize: 26 },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 2 },
  bannerDesc: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular" },

  /* Progress */
  progressCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 4,
  },
  progressTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  progressCount: { fontSize: 13, fontFamily: "Inter_700Bold", color: C.tint },
  progressBar: { height: 6, backgroundColor: C.surfaceAlt, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: C.tint, borderRadius: 3 },

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

  /* Group card (contains list items) */
  groupCard: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  itemDivider: { height: 1, backgroundColor: C.borderLight, marginHorizontal: 14 },

  /* Policy card (inside group) */
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
});
