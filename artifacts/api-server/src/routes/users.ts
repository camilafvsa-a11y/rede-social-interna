import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { db, usersTable, allowedEmailsTable, onboardingStepsTable, companyValuesConfirmationsTable, imageTermChoicesTable, documentSignaturesTable, securitySettingsTable } from "@workspace/db";
import { eq, ilike, or, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, simpleHash, formatUser, formatUserBasic } from "../lib/auth.js";

const UPLOADS_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  const { tag, search } = req.query as { tag?: string; search?: string };
  let users = await db.select().from(usersTable);

  if (tag) {
    users = users.filter((u) => u.tag === tag);
  }
  if (search) {
    const s = search.toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }

  res.json(users.map(formatUser));
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (id === "admin") { res.status(404).json({ error: "Not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(id))).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

// ── PATCH /users/:id — admin edit user ────────────────────────────────────────
router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, tag, role, birthDate, admissionDate,
    cpf, phone, sector, unit, position,
    extraTags, workTags, bannedUntil, appBanned,
    avatarUrl, onboardingCompleted,
  } = req.body;
  const currentUser = (req as any).user;
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(id))).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.role === "master_admin" && currentUser.role !== "master_admin") {
    res.status(403).json({ error: "Não é possível editar o administrador mestre" });
    return;
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (tag !== undefined) updates.tag = tag || null;
  if (role !== undefined) {
    if (target.role === "master_admin") {
      res.status(403).json({ error: "Não é possível alterar o papel do administrador mestre" });
      return;
    }
    updates.role = role;
  }
  if (birthDate !== undefined) updates.birthDate = birthDate;
  if (admissionDate !== undefined) updates.admissionDate = admissionDate;
  if (cpf !== undefined) updates.cpf = cpf;
  if (phone !== undefined) updates.phone = phone;
  if (sector !== undefined) updates.sector = sector;
  if (unit !== undefined) updates.unit = unit;
  if (position !== undefined) updates.position = position;
  if (extraTags !== undefined) updates.extraTags = extraTags;
  if (workTags !== undefined) updates.workTags = workTags;
  if (bannedUntil !== undefined) updates.bannedUntil = bannedUntil ? new Date(bannedUntil) : null;
  if (appBanned !== undefined) updates.appBanned = appBanned;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (onboardingCompleted !== undefined) updates.onboardingCompleted = onboardingCompleted;
  if ((req.body as any).hasKids !== undefined) updates.hasKids = (req.body as any).hasKids;
  if ((req.body as any).kidsCount !== undefined) updates.kidsCount = (req.body as any).kidsCount;
  if ((req.body as any).needsPasswordReset !== undefined) updates.needsPasswordReset = (req.body as any).needsPasswordReset;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, parseInt(id))).returning();
  res.json(formatUser(updated));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  if (currentUser.role !== "master_admin") {
    res.status(403).json({ error: "Apenas o master admin pode excluir usuários permanentemente" });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(id))).limit(1);
  if (!target) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  if (target.role === "master_admin") {
    res.status(403).json({ error: "Não é possível excluir o master admin" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, parseInt(id)));
  res.json({ success: true });
});

// ── POST /users/:id/reset-password — reset to default password ───────────────
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(id))).limit(1);
  if (!target) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  if (target.role === "master_admin") {
    res.status(403).json({ error: "Não é possível resetar a senha do master admin" });
    return;
  }

  const settings = await db.select().from(securitySettingsTable);
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;
  const defaultPassword = settingsMap["default_password"] || "Beija2024";

  const [updated] = await db.update(usersTable)
    .set({ passwordHash: simpleHash(defaultPassword), needsPasswordReset: true })
    .where(eq(usersTable.id, parseInt(id)))
    .returning();

  res.json({ success: true, user: formatUser(updated), message: `Senha redefinida para a senha padrão` });
});

router.post("/:id/avatar", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { avatarUrl, base64, filename } = req.body;
  const currentUser = (req as any).user;
  if (currentUser.id !== parseInt(id) && currentUser.role !== "admin" && currentUser.role !== "master_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let finalUrl: string | undefined = avatarUrl;

  if (base64 && filename) {
    try {
      const raw = base64.includes(",") ? base64.split(",")[1] : base64;
      const buffer = Buffer.from(raw, "base64");
      if (buffer.length > 8 * 1024 * 1024) {
        res.status(413).json({ error: "Imagem muito grande (máx 8 MB)" });
        return;
      }
      const safeName = `avatar_${id}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      writeFileSync(join(UPLOADS_DIR, safeName), buffer);
      finalUrl = `/api/uploads/${safeName}`;
    } catch {
      res.status(400).json({ error: "Falha ao processar imagem" });
      return;
    }
  }

  if (!finalUrl) {
    res.status(400).json({ error: "avatarUrl ou base64+filename são obrigatórios" });
    return;
  }

  const [updated] = await db.update(usersTable).set({ avatarUrl: finalUrl }).where(eq(usersTable.id, parseInt(id))).returning();
  res.json(formatUser(updated));
});

// ── GET /users/:id/onboarding-status ─────────────────────────────────────────
router.get("/:id/onboarding-status", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const steps = await db.select().from(onboardingStepsTable).where(eq(onboardingStepsTable.userId, userId));
  const valuesConf = await db.select().from(companyValuesConfirmationsTable).where(eq(companyValuesConfirmationsTable.userId, userId)).limit(1);
  const imageChoice = await db.select().from(imageTermChoicesTable).where(eq(imageTermChoicesTable.userId, userId)).orderBy(desc(imageTermChoicesTable.decidedAt)).limit(1);
  const sigs = await db.select().from(documentSignaturesTable).where(eq(documentSignaturesTable.userId, userId));

  res.json({
    user: formatUser(user),
    completedSteps: steps.map((s) => s.step),
    hasPhoto: !!user.avatarUrl,
    hasPersonalData: !!(user.cpf && user.phone && user.birthDate),
    hasConfirmedValues: valuesConf.length > 0,
    valuesConfirmedAt: valuesConf[0]?.confirmedAt?.toISOString?.() ?? null,
    imageTermAccepted: user.imageTermAccepted ?? null,
    imageTermDecidedAt: imageChoice[0]?.decidedAt?.toISOString?.() ?? null,
    signatures: sigs.map((s) => ({ ...s, signedAt: s.signedAt?.toISOString?.() ?? s.signedAt })),
    onboardingCompleted: user.onboardingCompleted,
  });
});

// ── Allowed emails (invite management) ────────────────────────────────────────
router.get("/admin/allowed-emails", requireAdmin, async (req, res) => {
  const emails = await db.select().from(allowedEmailsTable).orderBy(desc(allowedEmailsTable.addedAt));
  res.json(emails.map((e) => ({
    ...e,
    addedAt: e.addedAt?.toISOString?.() ?? e.addedAt,
    invitedAt: e.invitedAt?.toISOString?.() ?? e.invitedAt,
    resentAt: e.resentAt?.toISOString?.() ?? e.resentAt,
    accountCreatedAt: e.accountCreatedAt?.toISOString?.() ?? e.accountCreatedAt,
  })));
});

router.post("/admin/allowed-emails", requireAdmin, async (req, res) => {
  const { email, name, tag, role, temporaryPassword, phone, sector, unit, position } = req.body;
  const currentUser = (req as any).user;

  if (!email || !name || !temporaryPassword) {
    res.status(400).json({ error: "email, name e temporaryPassword são obrigatórios" });
    return;
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (existingUser) {
    res.status(400).json({ error: "Já existe uma conta com este e-mail" });
    return;
  }

  const [existing] = await db.select().from(allowedEmailsTable).where(eq(allowedEmailsTable.email, email.toLowerCase().trim())).limit(1);
  if (existing) {
    res.status(400).json({ error: "Email já está cadastrado como convite" });
    return;
  }

  const [created] = await db.insert(allowedEmailsTable).values({
    email: email.toLowerCase().trim(),
    name,
    tag,
    role: role || "user",
    temporaryPassword,
    phone: phone || null,
    sector: sector || null,
    unit: unit || null,
    position: position || null,
    status: "pending",
    invitedBy: currentUser.id,
    invitedAt: new Date(),
  }).returning();

  res.json({
    ...created,
    addedAt: created.addedAt?.toISOString?.() ?? created.addedAt,
    invitedAt: created.invitedAt?.toISOString?.() ?? created.invitedAt,
  });
});

router.put("/admin/allowed-emails/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, tag, role, temporaryPassword, phone, sector, unit, position, status } = req.body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (tag !== undefined) updates.tag = tag || null;
  if (role !== undefined) updates.role = role;
  if (temporaryPassword !== undefined) updates.temporaryPassword = temporaryPassword;
  if (phone !== undefined) updates.phone = phone;
  if (sector !== undefined) updates.sector = sector;
  if (unit !== undefined) updates.unit = unit;
  if (position !== undefined) updates.position = position;
  if (status !== undefined) updates.status = status;

  const [updated] = await db.update(allowedEmailsTable).set(updates).where(eq(allowedEmailsTable.id, parseInt(id))).returning();
  if (!updated) { res.status(404).json({ error: "Convite não encontrado" }); return; }
  res.json({ ...updated, addedAt: updated.addedAt?.toISOString?.() ?? updated.addedAt });
});

router.post("/admin/allowed-emails/:id/resend", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const [invite] = await db.select().from(allowedEmailsTable).where(eq(allowedEmailsTable.id, parseInt(id))).limit(1);
  if (!invite) { res.status(404).json({ error: "Convite não encontrado" }); return; }

  const [updated] = await db.update(allowedEmailsTable).set({
    status: "pending",
    resentAt: new Date(),
  }).where(eq(allowedEmailsTable.id, parseInt(id))).returning();

  res.json({ success: true, resentAt: updated.resentAt?.toISOString?.() ?? null });
});

router.delete("/admin/allowed-emails/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.update(allowedEmailsTable).set({ status: "inactive" }).where(eq(allowedEmailsTable.id, parseInt(id)));
  res.json({ success: true, message: "Convite cancelado" });
});

export default router;
