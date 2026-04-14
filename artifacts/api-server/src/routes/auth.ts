import { Router } from "express";
import { db, usersTable, allowedEmailsTable, onboardingStepsTable, companyValuesConfirmationsTable, imageTermChoicesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, simpleHash, formatUser } from "../lib/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email e senha são obrigatórios" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

  if (!user) {
    const [allowed] = await db.select().from(allowedEmailsTable).where(eq(allowedEmailsTable.email, email.toLowerCase().trim())).limit(1);
    if (!allowed) {
      res.status(403).json({ error: "Email não autorizado. Contate o administrador." });
      return;
    }
    if (simpleHash(password) !== simpleHash(allowed.temporaryPassword) && password !== allowed.temporaryPassword) {
      res.status(401).json({ error: "Senha incorreta" });
      return;
    }
    const [newUser] = await db.insert(usersTable).values({
      name: allowed.name,
      email: allowed.email,
      passwordHash: simpleHash(password),
      tag: allowed.tag,
      role: allowed.role,
      phone: allowed.phone,
      sector: allowed.sector,
      unit: allowed.unit,
      position: allowed.position,
    }).returning();
    // Mark invite as active and record creation time
    await db.update(allowedEmailsTable).set({
      status: "active",
      accountCreatedAt: new Date(),
    }).where(eq(allowedEmailsTable.id, allowed.id));
    res.json({ user: formatUser(newUser), token: String(newUser.id) });
    return;
  }

  if (user.passwordHash !== simpleHash(password) && user.passwordHash !== password) {
    res.status(401).json({ error: "Senha incorreta" });
    return;
  }

  if (user.appBanned) {
    res.status(403).json({ error: "Acesso bloqueado. Sua conta foi banida do aplicativo. Entre em contato com o administrador." });
    return;
  }

  res.json({ user: formatUser(user), token: String(user.id) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json(formatUser(user));
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

// ── Update profile (personal data step) ──────────────────────────────────────
router.put("/update-profile", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { name, cpf, phone, birthDate, admissionDate, sector, unit, position, avatarUrl } = req.body;

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (cpf !== undefined) updates.cpf = cpf;
  if (phone !== undefined) updates.phone = phone;
  if (birthDate !== undefined) updates.birthDate = birthDate;
  if (admissionDate !== undefined) updates.admissionDate = admissionDate;
  if (sector !== undefined) updates.sector = sector;
  if (unit !== undefined) updates.unit = unit;
  if (position !== undefined) updates.position = position;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
  res.json(formatUser(updated));
});

// ── Confirm company values read ───────────────────────────────────────────────
router.post("/company-values-confirm", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { context = "onboarding" } = req.body;

  await db.insert(companyValuesConfirmationsTable).values({
    userId: user.id,
    context,
  });

  await markStepComplete(user.id, "values");
  res.json({ success: true, confirmedAt: new Date().toISOString() });
});

// ── Image term choice (accept or refuse) ─────────────────────────────────────
router.post("/image-term-choice", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { accepted, context = "onboarding" } = req.body;

  if (typeof accepted !== "boolean") {
    res.status(400).json({ error: "accepted (boolean) é obrigatório" });
    return;
  }

  await db.insert(imageTermChoicesTable).values({
    userId: user.id,
    accepted,
    context,
  });

  await db.update(usersTable).set({ imageTermAccepted: accepted }).where(eq(usersTable.id, user.id));

  if (accepted) {
    await markStepComplete(user.id, "image_term");
  } else {
    await markStepComplete(user.id, "image_term_refused");
  }

  res.json({ success: true, accepted, decidedAt: new Date().toISOString() });
});

// ── Onboarding status ─────────────────────────────────────────────────────────
router.get("/onboarding-status", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const steps = await db.select()
    .from(onboardingStepsTable)
    .where(eq(onboardingStepsTable.userId, user.id))
    .orderBy(desc(onboardingStepsTable.completedAt));

  const completedSteps = steps.map((s) => s.step);
  const valuesConfirmed = await db.select().from(companyValuesConfirmationsTable)
    .where(eq(companyValuesConfirmationsTable.userId, user.id)).limit(1);
  const imageTermChoice = await db.select().from(imageTermChoicesTable)
    .where(eq(imageTermChoicesTable.userId, user.id))
    .orderBy(desc(imageTermChoicesTable.decidedAt)).limit(1);

  res.json({
    completedSteps,
    hasPhoto: !!user.avatarUrl,
    hasPersonalData: !!(user.cpf && user.phone && user.birthDate),
    hasConfirmedValues: valuesConfirmed.length > 0,
    imageTermAccepted: user.imageTermAccepted ?? null,
    imageTermDecided: imageTermChoice.length > 0,
    onboardingCompleted: user.onboardingCompleted,
  });
});

// ── Mark onboarding step complete ─────────────────────────────────────────────
router.post("/onboarding-step", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { step } = req.body;
  if (!step) { res.status(400).json({ error: "step é obrigatório" }); return; }
  await markStepComplete(user.id, step);
  res.json({ success: true, step });
});

// ── Complete onboarding ───────────────────────────────────────────────────────
router.post("/complete-onboarding", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { avatarUrl, acceptedTerms, readDocuments } = req.body;

  const [updated] = await db.update(usersTable).set({
    avatarUrl: avatarUrl || user.avatarUrl,
    acceptedTerms: acceptedTerms ?? user.acceptedTerms ?? false,
    readDocuments: readDocuments ?? user.readDocuments ?? false,
    onboardingCompleted: true,
  }).where(eq(usersTable.id, user.id)).returning();

  await markStepComplete(user.id, "complete");
  res.json(formatUser(updated));
});

async function markStepComplete(userId: number, step: string) {
  const existing = await db.select().from(onboardingStepsTable)
    .where(eq(onboardingStepsTable.userId, userId))
    .limit(100);
  if (!existing.some((s) => s.step === step)) {
    await db.insert(onboardingStepsTable).values({ userId, step });
  }
}

export default router;
