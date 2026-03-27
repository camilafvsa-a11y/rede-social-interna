import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { db, usersTable, allowedEmailsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
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

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name, tag, role, birthDate, admissionDate,
    cpf, extraTags, workTags, bannedUntil, appBanned,
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
  if (extraTags !== undefined) updates.extraTags = extraTags;
  if (workTags !== undefined) updates.workTags = workTags;
  if (bannedUntil !== undefined) updates.bannedUntil = bannedUntil ? new Date(bannedUntil) : null;
  if (appBanned !== undefined) updates.appBanned = appBanned;

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

router.get("/admin/allowed-emails", requireAdmin, async (req, res) => {
  const emails = await db.select().from(allowedEmailsTable);
  res.json(emails.map((e) => ({ ...e, addedAt: e.addedAt?.toISOString?.() ?? e.addedAt })));
});

router.post("/admin/allowed-emails", requireAdmin, async (req, res) => {
  const { email, name, tag, role, temporaryPassword } = req.body;
  const [existing] = await db.select().from(allowedEmailsTable).where(eq(allowedEmailsTable.email, email.toLowerCase().trim())).limit(1);
  if (existing) {
    res.status(400).json({ error: "Email já existe" });
    return;
  }
  const [created] = await db.insert(allowedEmailsTable).values({
    email: email.toLowerCase().trim(),
    name,
    tag,
    role: role || "user",
    temporaryPassword,
  }).returning();
  res.json({ ...created, addedAt: created.addedAt?.toISOString?.() ?? created.addedAt });
});

router.delete("/admin/allowed-emails/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(allowedEmailsTable).where(eq(allowedEmailsTable.id, parseInt(id)));
  res.json({ success: true, message: "Removed" });
});

export default router;
