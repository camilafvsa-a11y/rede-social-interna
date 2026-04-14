import { Router } from "express";
import { db, documentSignaturesTable, termAcceptancesTable, imageTermChoicesTable, companyValuesConfirmationsTable, usersTable, integraItemsTable } from "@workspace/db";
import { eq, desc, and, gte, lte, ilike, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

// ── POST /signatures/sign/:docKey — sign a document ──────────────────────────
router.post("/sign/:docKey", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { docKey } = req.params;
  const { context = "integra", accepted = true } = req.body;

  const [item] = await db.select().from(integraItemsTable).where(eq(integraItemsTable.docKey, docKey)).limit(1);
  if (!item) { res.status(404).json({ error: "Documento não encontrado" }); return; }

  const [existing] = await db.select().from(documentSignaturesTable)
    .where(and(eq(documentSignaturesTable.userId, user.id), eq(documentSignaturesTable.docKey, docKey)))
    .limit(1);

  if (existing) {
    res.json({ success: true, alreadySigned: true, signedAt: existing.signedAt?.toISOString?.() });
    return;
  }

  const [sig] = await db.insert(documentSignaturesTable).values({
    userId: user.id,
    docKey,
    docTitle: item.title,
    context,
    accepted,
    confirmationTextUsed: item.confirmationText || null,
  }).returning();

  res.json({ success: true, signedAt: sig.signedAt?.toISOString?.() });
});

// ── GET /signatures/my — current user's signatures ───────────────────────────
router.get("/my", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const sigs = await db.select().from(documentSignaturesTable)
    .where(eq(documentSignaturesTable.userId, user.id))
    .orderBy(desc(documentSignaturesTable.signedAt));

  const terms = await db.select().from(termAcceptancesTable)
    .where(eq(termAcceptancesTable.userId, user.id))
    .orderBy(desc(termAcceptancesTable.acceptedAt));

  const imageChoice = await db.select().from(imageTermChoicesTable)
    .where(eq(imageTermChoicesTable.userId, user.id))
    .orderBy(desc(imageTermChoicesTable.decidedAt)).limit(1);

  const valuesConf = await db.select().from(companyValuesConfirmationsTable)
    .where(eq(companyValuesConfirmationsTable.userId, user.id)).limit(1);

  res.json({
    signatures: sigs.map((s) => ({ ...s, signedAt: s.signedAt?.toISOString?.() ?? s.signedAt })),
    terms: terms.map((t) => ({ ...t, acceptedAt: t.acceptedAt?.toISOString?.() ?? t.acceptedAt })),
    imageTermChoice: imageChoice[0] ? { ...imageChoice[0], decidedAt: imageChoice[0].decidedAt?.toISOString?.() } : null,
    valuesConfirmed: valuesConf.length > 0,
    valuesConfirmedAt: valuesConf[0]?.confirmedAt?.toISOString?.() ?? null,
  });
});

// ── GET /signatures/admin — list all with filters ─────────────────────────────
router.get("/admin", requireAdmin, async (req, res) => {
  const { docKey, userId, from, to, type, accepted } = req.query as Record<string, string>;

  let sigs = await db.select({
    sig: documentSignaturesTable,
    user: usersTable,
  }).from(documentSignaturesTable)
    .leftJoin(usersTable, eq(documentSignaturesTable.userId, usersTable.id))
    .orderBy(desc(documentSignaturesTable.signedAt));

  let filtered = sigs;
  if (docKey) filtered = filtered.filter((r) => r.sig.docKey === docKey);
  if (userId) filtered = filtered.filter((r) => r.sig.userId === parseInt(userId));
  if (from) filtered = filtered.filter((r) => r.sig.signedAt >= new Date(from));
  if (to) filtered = filtered.filter((r) => r.sig.signedAt <= new Date(to));
  if (type === "signature") filtered = filtered.filter((r) => r.sig.accepted === true);
  if (type === "refused") filtered = filtered.filter((r) => r.sig.accepted === false);
  if (accepted === "true") filtered = filtered.filter((r) => r.sig.accepted === true);
  if (accepted === "false") filtered = filtered.filter((r) => r.sig.accepted === false);

  res.json(filtered.map((r) => ({
    id: r.sig.id,
    docKey: r.sig.docKey,
    docTitle: r.sig.docTitle,
    context: r.sig.context,
    accepted: r.sig.accepted,
    confirmationTextUsed: r.sig.confirmationTextUsed,
    signedAt: r.sig.signedAt?.toISOString?.() ?? r.sig.signedAt,
    user: r.user ? {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      cpf: r.user.cpf,
      phone: r.user.phone,
      sector: r.user.sector,
      unit: r.user.unit,
    } : null,
  })));
});

// ── GET /signatures/admin/export.csv ─────────────────────────────────────────
router.get("/admin/export.csv", requireAdmin, async (req, res) => {
  const { docKey } = req.query as { docKey?: string };

  let sigs = await db.select({
    sig: documentSignaturesTable,
    user: usersTable,
  }).from(documentSignaturesTable)
    .leftJoin(usersTable, eq(documentSignaturesTable.userId, usersTable.id))
    .orderBy(desc(documentSignaturesTable.signedAt));

  if (docKey) sigs = sigs.filter((r) => r.sig.docKey === docKey);

  const rows = [
    ["Nome", "Email", "CPF", "Telefone", "Setor", "Unidade", "Documento", "Data", "Hora", "Status", "Contexto"],
    ...sigs.map((r) => {
      const dt = r.sig.signedAt ? new Date(r.sig.signedAt) : null;
      return [
        r.user?.name ?? "",
        r.user?.email ?? "",
        r.user?.cpf ?? "",
        r.user?.phone ?? "",
        r.user?.sector ?? "",
        r.user?.unit ?? "",
        r.sig.docTitle,
        dt ? dt.toLocaleDateString("pt-BR") : "",
        dt ? dt.toLocaleTimeString("pt-BR") : "",
        r.sig.accepted ? "Assinado" : "Recusado",
        r.sig.context,
      ];
    }),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const bom = "\uFEFF";
  const filename = docKey ? `assinaturas_${docKey}.csv` : "assinaturas_geral.csv";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(bom + csv);
});

// ── GET /signatures/admin/image-terms ────────────────────────────────────────
router.get("/admin/image-terms", requireAdmin, async (req, res) => {
  const choices = await db.select({
    choice: imageTermChoicesTable,
    user: usersTable,
  }).from(imageTermChoicesTable)
    .leftJoin(usersTable, eq(imageTermChoicesTable.userId, usersTable.id))
    .orderBy(desc(imageTermChoicesTable.decidedAt));

  res.json(choices.map((r) => ({
    id: r.choice.id,
    accepted: r.choice.accepted,
    context: r.choice.context,
    decidedAt: r.choice.decidedAt?.toISOString?.() ?? r.choice.decidedAt,
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email, cpf: r.user.cpf } : null,
  })));
});

// ── GET /signatures/admin/values-confirmations ────────────────────────────────
router.get("/admin/values-confirmations", requireAdmin, async (req, res) => {
  const confs = await db.select({
    conf: companyValuesConfirmationsTable,
    user: usersTable,
  }).from(companyValuesConfirmationsTable)
    .leftJoin(usersTable, eq(companyValuesConfirmationsTable.userId, usersTable.id))
    .orderBy(desc(companyValuesConfirmationsTable.confirmedAt));

  res.json(confs.map((r) => ({
    id: r.conf.id,
    context: r.conf.context,
    confirmedAt: r.conf.confirmedAt?.toISOString?.() ?? r.conf.confirmedAt,
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
  })));
});

export default router;
