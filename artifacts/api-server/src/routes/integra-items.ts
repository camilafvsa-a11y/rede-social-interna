import { Router } from "express";
import { db, integraItemsTable } from "@workspace/db";
import { eq, asc, count, and, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

function generateDocKey(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
  return base || `doc_${Date.now()}`;
}

const router = Router();

const UPLOADS_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── GET /integra-items — list active items shown in Integra tab ─────────────
router.get("/", requireAuth, async (_req, res) => {
  const items = await db
    .select()
    .from(integraItemsTable)
    .where(and(eq(integraItemsTable.isActive, true), eq(integraItemsTable.showInIntegra, true)))
    .orderBy(
      asc(integraItemsTable.category),
      asc(integraItemsTable.sectionName),
      asc(integraItemsTable.sortOrder),
    );
  res.json(items);
});

// ─── GET /integra-items/onboarding — items shown in first-access onboarding ──
router.get("/onboarding", requireAuth, async (_req, res) => {
  const items = await db
    .select()
    .from(integraItemsTable)
    .where(and(eq(integraItemsTable.isActive, true), eq(integraItemsTable.showInOnboarding, true)))
    .orderBy(
      asc(integraItemsTable.requiresSign),
      asc(integraItemsTable.category),
      asc(integraItemsTable.sectionName),
      asc(integraItemsTable.sortOrder),
    );
  res.json(items);
});

// ─── GET /integra-items/total — count of items that count for progress ────────
router.get("/total", requireAuth, async (_req, res) => {
  const [{ value }] = await db
    .select({ value: count() })
    .from(integraItemsTable)
    .where(and(eq(integraItemsTable.isActive, true), eq(integraItemsTable.countsForProgress, true)));
  res.json({ total: Number(value) });
});

// ─── GET /integra-items/admin — list all items (active + inactive) ─────────
router.get("/admin", requireAdmin, async (_req, res) => {
  const items = await db
    .select()
    .from(integraItemsTable)
    .orderBy(
      asc(integraItemsTable.category),
      asc(integraItemsTable.sectionName),
      asc(integraItemsTable.sortOrder),
    );
  res.json(items);
});

// ─── GET /integra-items/sections — list distinct sections (admin) ─────────────
router.get("/sections", requireAdmin, async (_req, res) => {
  const items = await db
    .select({
      sectionName: integraItemsTable.sectionName,
      sectionIcon: integraItemsTable.sectionIcon,
      sectionColor: integraItemsTable.sectionColor,
      sectionColorBg: integraItemsTable.sectionColorBg,
    })
    .from(integraItemsTable)
    .where(isNotNull(integraItemsTable.sectionName))
    .orderBy(asc(integraItemsTable.sectionName));

  const seen = new Set<string>();
  const countMap = new Map<string, number>();
  for (const item of items) {
    if (item.sectionName) countMap.set(item.sectionName, (countMap.get(item.sectionName) || 0) + 1);
  }
  const sections = items.filter((item) => {
    if (!item.sectionName || seen.has(item.sectionName)) return false;
    seen.add(item.sectionName);
    return true;
  }).map((item) => ({ ...item, count: countMap.get(item.sectionName!) || 0 }));

  res.json(sections);
});

// ─── DELETE /integra-items/sections/:name — remove section from all docs ──────
router.delete("/sections/:name", requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (!name) { res.status(400).json({ error: "Section name required" }); return; }
  await db.update(integraItemsTable)
    .set({ sectionName: null, sectionIcon: null, sectionColor: null, sectionColorBg: null, updatedAt: new Date() })
    .where(eq(integraItemsTable.sectionName, name));
  res.json({ success: true });
});

// ─── POST /integra-items — create item (admin) ────────────────────────────────
router.post("/", requireAdmin, async (req, res) => {
  const {
    category, sectionName, sectionIcon, sectionColor, sectionColorBg,
    title, subtitle, content, pdfUrl, requiresSign, requiresRead,
    docKey: rawDocKey, iconName, sortOrder, isActive,
    docType, showInIntegra, showInOnboarding, countsForProgress,
  } = req.body;

  if (!category || !title) {
    res.status(400).json({ error: "category e title são obrigatórios" });
    return;
  }

  const baseKey = (rawDocKey || generateDocKey(title)).trim();
  let resolvedDocKey = baseKey;
  let suffix = 2;
  while (true) {
    const existing = await db
      .select({ id: integraItemsTable.id })
      .from(integraItemsTable)
      .where(eq(integraItemsTable.docKey, resolvedDocKey))
      .limit(1);
    if (existing.length === 0) break;
    resolvedDocKey = `${baseKey}_${suffix++}`;
  }

  const [item] = await db
    .insert(integraItemsTable)
    .values({
      category,
      sectionName: sectionName || null,
      sectionIcon: sectionIcon || null,
      sectionColor: sectionColor || null,
      sectionColorBg: sectionColorBg || null,
      title,
      subtitle: subtitle || null,
      content: content || null,
      pdfUrl: pdfUrl || null,
      requiresSign: !!requiresSign,
      requiresRead: requiresRead !== false,
      docKey: resolvedDocKey,
      iconName: iconName || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive !== false,
      docType: docType || "text",
      showInIntegra: showInIntegra !== false,
      showInOnboarding: showInOnboarding !== false,
      countsForProgress: countsForProgress !== false,
    })
    .returning();

  res.json(item);
});

// ─── PATCH /integra-items/:id — update item (admin) ──────────────────────────
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const {
    category, sectionName, sectionIcon, sectionColor, sectionColorBg,
    title, subtitle, content, pdfUrl, requiresSign, requiresRead,
    docKey, iconName, sortOrder, isActive,
    docType, showInIntegra, showInOnboarding, countsForProgress,
  } = req.body;

  const updates: Partial<typeof integraItemsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (category !== undefined) updates.category = category;
  if (sectionName !== undefined) updates.sectionName = sectionName || null;
  if (sectionIcon !== undefined) updates.sectionIcon = sectionIcon || null;
  if (sectionColor !== undefined) updates.sectionColor = sectionColor || null;
  if (sectionColorBg !== undefined) updates.sectionColorBg = sectionColorBg || null;
  if (title !== undefined) updates.title = title;
  if (subtitle !== undefined) updates.subtitle = subtitle || null;
  if (content !== undefined) updates.content = content || null;
  if (pdfUrl !== undefined) updates.pdfUrl = pdfUrl || null;
  if (requiresSign !== undefined) updates.requiresSign = !!requiresSign;
  if (requiresRead !== undefined) updates.requiresRead = !!requiresRead;
  if (docKey !== undefined) updates.docKey = docKey;
  if (iconName !== undefined) updates.iconName = iconName;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = !!isActive;
  if (docType !== undefined) updates.docType = docType;
  if (showInIntegra !== undefined) updates.showInIntegra = !!showInIntegra;
  if (showInOnboarding !== undefined) updates.showInOnboarding = !!showInOnboarding;
  if (countsForProgress !== undefined) updates.countsForProgress = !!countsForProgress;

  const [item] = await db
    .update(integraItemsTable)
    .set(updates)
    .where(eq(integraItemsTable.id, id))
    .returning();

  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }
  res.json(item);
});

// ─── DELETE /integra-items/:id — delete item (admin) ────────────────────────
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(integraItemsTable).where(eq(integraItemsTable.id, id));
  res.json({ success: true });
});

// ─── POST /integra-items/upload-pdf — upload PDF (admin) ─────────────────────
router.post("/upload-pdf", requireAdmin, async (req, res) => {
  const { base64, filename } = req.body;
  if (!base64 || !filename) {
    res.status(400).json({ error: "base64 and filename are required" });
    return;
  }

  const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = join(UPLOADS_DIR, safeName);

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > 12 * 1024 * 1024) {
    res.status(413).json({ error: "PDF muito grande (máx 12 MB)" });
    return;
  }

  writeFileSync(filePath, buffer);
  const baseUrl = process.env.API_BASE_URL || "";
  res.json({ url: `${baseUrl}/uploads/${safeName}` });
});

// ─── POST /integra-items/seed — seed default content (admin) ─────────────────
router.post("/seed", requireAdmin, async (_req, res) => {
  const existing = await db.select({ id: integraItemsTable.id }).from(integraItemsTable).limit(1);
  if (existing.length > 0) {
    res.json({ message: "Conteúdo já foi inicializado", skipped: true });
    return;
  }

  const seedItems: (typeof integraItemsTable.$inferInsert)[] = [
    // ── Termos ──────────────────────────────────────────────────────────────
    {
      category: "terms",
      title: "Termo de Autorização de Uso de Imagem e Voz",
      subtitle: "Autorização de uso de imagem para materiais do Grupo Beija-flor",
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
      requiresSign: true,
      requiresRead: true,
      docKey: "image_voice_authorization",
      iconName: "camera",
      sortOrder: 0,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },

    // ── Código de Conduta ────────────────────────────────────────────────────
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Tolerância Zero Contra Corrupção",
      subtitle: "Trabalhamos de forma isenta e leal. Não prometemos, damos, oferecemos, solicitamos ou concordamos em receber ou aceitar subornos.",
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
      requiresRead: true,
      docKey: "anticorrupcao",
      iconName: "shield-off",
      sortOrder: 0,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Código de Conduta",
      subtitle: "Diretrizes de comportamento profissional",
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
      requiresRead: true,
      docKey: "codigo_conduta",
      iconName: "book-open",
      sortOrder: 1,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Assédio Moral e Sexual",
      subtitle: "O Grupo não admite qualquer tipo de assédio moral ou sexual. Promovemos um ambiente seguro, sem discriminação.",
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
      requiresRead: true,
      docKey: "assedio",
      iconName: "alert-triangle",
      sortOrder: 2,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Conduta Profissional",
      subtitle: "Atuamos com integridade e respeitamos nosso horário de trabalho, contribuindo para o crescimento da empresa.",
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
      requiresRead: true,
      docKey: "conduta_profissional",
      iconName: "briefcase",
      sortOrder: 3,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Relacionamento com Clientes",
      subtitle: "Conscientes de que atuamos como representantes diretos do Grupo, nos comprometemos a fornecer serviços de excelência.",
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
      requiresRead: true,
      docKey: "atendimento_cliente",
      iconName: "users",
      sortOrder: 4,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Parceiros e Fornecedores",
      subtitle: "Elegemos parceiros com base em princípios éticos, idoneidade, qualidade, preço e entrega.",
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
      requiresRead: false,
      docKey: "parceiros",
      iconName: "link",
      sortOrder: 5,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Responsabilidade Social",
      subtitle: "Apoiamos direitos humanos universais e temos consciência do nosso impacto ambiental.",
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
      requiresRead: false,
      docKey: "responsabilidade_social",
      iconName: "globe",
      sortOrder: 6,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Uniformes e Apresentação",
      subtitle: "O uniforme deve ser usado em sua totalidade, sempre limpo e alinhado. Cuidar do uniforme é zelar pela nossa imagem.",
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
      requiresRead: true,
      docKey: "uniformes",
      iconName: "tag",
      sortOrder: 7,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },
    {
      category: "conduct",
      sectionName: "Código de Conduta",
      sectionIcon: "shield",
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Denúncias e Ouvidoria",
      subtitle: "Todas as denúncias são investigadas. Garantimos privacidade e não aceitamos retaliações contra quem denuncia.",
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
      requiresRead: true,
      docKey: "denuncias",
      iconName: "message-square",
      sortOrder: 8,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },

    // ── Segurança ────────────────────────────────────────────────────────────
    {
      category: "conduct",
      sectionName: "Segurança",
      sectionIcon: "lock",
      sectionColor: "#7C3AED",
      sectionColorBg: "#F5F3FF",
      title: "Política de Segurança da Informação",
      subtitle: "Protegendo nossos dados e sistemas",
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
      requiresRead: true,
      docKey: "seguranca_info",
      iconName: "lock",
      sortOrder: 0,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },

    // ── Recursos Humanos ─────────────────────────────────────────────────────
    {
      category: "conduct",
      sectionName: "Recursos Humanos",
      sectionIcon: "user-check",
      sectionColor: "#D97706",
      sectionColorBg: "#FFFBEB",
      title: "Pontualidade e Registro de Ponto",
      subtitle: "Ser pontual e não faltar sem justificativa. Utilizamos registro biométrico diário.",
      content: `Compromissos:
• Ser pontual e não faltar ao trabalho sem justificativa
• Atestados médicos devem ser encaminhados ao coordenador ou RH no primeiro dia de afastamento

Registro de Ponto Biométrico:
Deve ser feito diariamente:

• No início da jornada de trabalho
• Na saída para intervalo
• No retorno do intervalo
• No final da jornada de trabalho

Importante:
Respeitamos integralmente nosso horário de trabalho, pois a jornada é a venda de nossa capacidade de produção. Durante o expediente, não realizamos atividades não relacionadas ao trabalho sem aprovação do gestor.`,
      requiresRead: true,
      docKey: "pontualidade",
      iconName: "clock",
      sortOrder: 0,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: true,
      countsForProgress: true,
    },

    // ── Nossos Valores ────────────────────────────────────────────────────────
    {
      category: "values",
      sectionName: null,
      sectionIcon: null,
      sectionColor: "#2563EB",
      sectionColorBg: "#EFF6FF",
      title: "Ética é Inegociável",
      subtitle: "Atuamos com integridade, lealdade e eficiência em nosso trabalho. A ética é a base de tudo que fazemos.",
      content: `• Trabalhamos de forma isenta e leal
• Temos tolerância zero contra corrupção
• Não aceitamos subornos de qualquer espécie
• Antes de agir, perguntamos: É legal? É ético? Está de acordo com nossa cultura?`,
      requiresSign: false,
      requiresRead: false,
      docKey: "valor_etica",
      iconName: "shield",
      sortOrder: 0,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
    {
      category: "values",
      sectionName: null,
      sectionIcon: null,
      sectionColor: "#DC2626",
      sectionColorBg: "#FEF2F2",
      title: "Comprometimento em Fazer o Bem",
      subtitle: "Nosso compromisso vai além dos negócios. Buscamos constantemente elevar os padrões de qualidade.",
      content: `• Garantimos a confiança em nosso combustível e excelência alimentar
• Nossa equipe é treinada para transformar cada visita em um momento especial
• Apoiamos direitos humanos universais e locais de trabalho seguros
• Temos consciência do impacto ambiental e trabalhamos para minimizá-lo`,
      requiresSign: false,
      requiresRead: false,
      docKey: "valor_comprometimento",
      iconName: "heart",
      sortOrder: 1,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
    {
      category: "values",
      sectionName: null,
      sectionIcon: null,
      sectionColor: "#7C3AED",
      sectionColorBg: "#F5F3FF",
      title: "Simplicidade e Respeito",
      subtitle: "Nossa característica mais marcante é a simplicidade. Respeitamos a diversidade e tratamos todos com dignidade.",
      content: `• Tratamos superiores, subordinados, fornecedores e clientes com dignidade
• Somos contrários a todo tipo de preconceito e discriminação
• Promovemos um ambiente seguro, sem assédio ou injustiça
• Respeitamos a privacidade de todos os colegas de trabalho`,
      requiresSign: false,
      requiresRead: false,
      docKey: "valor_simplicidade",
      iconName: "users",
      sortOrder: 2,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
    {
      category: "values",
      sectionName: null,
      sectionIcon: null,
      sectionColor: "#D97706",
      sectionColorBg: "#FFFBEB",
      title: "Trabalho em Equipe é Indispensável",
      subtitle: "Crescemos de forma sustentável nos adaptando a diversos momentos. Como o beija-flor, nos mantemos firmes em pleno voo.",
      content: `• Mais de 600 colaboradores engajados no mesmo propósito
• Mantemos um bom relacionamento entre colegas
• Cooperamos com investigações quando solicitado
• Nossa equipe é comprometida e treinada para servir com excelência`,
      requiresSign: false,
      requiresRead: false,
      docKey: "valor_trabalho_equipe",
      iconName: "star",
      sortOrder: 3,
      docType: "text",
      showInIntegra: true,
      showInOnboarding: false,
      countsForProgress: false,
    },
  ];

  await db.insert(integraItemsTable).values(seedItems);
  res.json({ message: "Conteúdo inicial criado com sucesso", count: seedItems.length });
});

export default router;
