import { Router } from "express";
import { db, tagsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { tipo } = req.query as { tipo?: string };
  let tags = await db.select().from(tagsTable).orderBy(asc(tagsTable.sortOrder), asc(tagsTable.nome));
  if (tipo) tags = tags.filter((t) => t.tipo === tipo);
  tags = tags.filter((t) => t.isActive);
  res.json(tags);
});

router.get("/all", requireAdmin, async (req, res) => {
  const tags = await db.select().from(tagsTable).orderBy(asc(tagsTable.tipo), asc(tagsTable.sortOrder), asc(tagsTable.nome));
  res.json(tags);
});

router.post("/", requireAdmin, async (req, res) => {
  const { tipo, nome, sortOrder } = req.body;
  if (!tipo || !nome) {
    res.status(400).json({ error: "tipo e nome são obrigatórios" });
    return;
  }
  const [created] = await db.insert(tagsTable).values({
    tipo,
    nome: nome.trim(),
    sortOrder: sortOrder ?? 0,
    isActive: true,
  }).returning();
  res.json(created);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, sortOrder, isActive } = req.body;
  const updates: any = {};
  if (nome !== undefined) updates.nome = nome.trim();
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (isActive !== undefined) updates.isActive = isActive;
  const [updated] = await db.update(tagsTable).set(updates).where(eq(tagsTable.id, parseInt(id))).returning();
  if (!updated) { res.status(404).json({ error: "Tag não encontrada" }); return; }
  res.json(updated);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(tagsTable).where(eq(tagsTable.id, parseInt(id)));
  res.json({ success: true });
});

export default router;
