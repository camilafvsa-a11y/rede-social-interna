import { Router } from "express";
import { db, usersTable, allowedEmailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    }).returning();
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

router.post("/complete-onboarding", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { avatarUrl, acceptedTerms, readDocuments } = req.body;

  if (!acceptedTerms || !readDocuments) {
    res.status(400).json({ error: "Você deve aceitar os termos e ler os documentos" });
    return;
  }

  const [updated] = await db.update(usersTable).set({
    avatarUrl: avatarUrl || user.avatarUrl,
    acceptedTerms: true,
    readDocuments: true,
    onboardingCompleted: true,
  }).where(eq(usersTable.id, user.id)).returning();

  res.json(formatUser(updated));
});

export default router;
