import { Router } from "express";
import { db, workTagsTable, usersTable, channelsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const tags = await db.select().from(workTagsTable).orderBy(workTagsTable.createdAt);
  res.json(tags);
});

router.post("/admin", requireAdmin, async (req, res) => {
  const { key, label, color, bg } = req.body;
  if (!label?.trim()) { res.status(400).json({ error: "Label obrigatório" }); return; }
  const tagKey = key || label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!tagKey) { res.status(400).json({ error: "Chave inválida" }); return; }

  const existing = await db.select().from(workTagsTable).where(eq(workTagsTable.key, tagKey)).limit(1);
  if (existing.length) { res.status(400).json({ error: "Tag já existe" }); return; }

  const [created] = await db.insert(workTagsTable).values({
    key: tagKey,
    label: label.trim(),
    color: color || "#6B7280",
    bg: bg || "#F3F4F6",
  }).returning();
  res.json(created);
});

router.patch("/admin/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { label, color, bg } = req.body;
  const [tag] = await db.select().from(workTagsTable).where(eq(workTagsTable.id, parseInt(id))).limit(1);
  if (!tag) { res.status(404).json({ error: "Tag não encontrada" }); return; }
  const updates: any = {};
  if (label !== undefined) updates.label = label.trim();
  if (color !== undefined) updates.color = color;
  if (bg !== undefined) updates.bg = bg;
  const [updated] = await db.update(workTagsTable).set(updates).where(eq(workTagsTable.id, parseInt(id))).returning();
  res.json(updated);
});

router.delete("/admin/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const [tag] = await db.select().from(workTagsTable).where(eq(workTagsTable.id, parseInt(id))).limit(1);
  if (!tag) { res.status(404).json({ error: "Tag não encontrada" }); return; }

  const tagKey = tag.key;

  await db.execute(
    sql`UPDATE users SET work_tags = array_remove(work_tags, ${tagKey}) WHERE work_tags IS NOT NULL AND ${tagKey} = ANY(work_tags)`
  );

  const allChannels = await db.select().from(channelsTable);
  for (const ch of allChannels) {
    const tags: string[] = JSON.parse(ch.allowedTags || "[]");
    if (tags.includes(tagKey)) {
      await db.update(channelsTable)
        .set({ allowedTags: JSON.stringify(tags.filter((t) => t !== tagKey)) })
        .where(eq(channelsTable.id, ch.id));
    }
  }

  await db.delete(workTagsTable).where(eq(workTagsTable.id, parseInt(id)));
  res.json({ success: true });
});

export default router;
