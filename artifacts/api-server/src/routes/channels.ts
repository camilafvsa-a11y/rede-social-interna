import { Router } from "express";
import { db, channelsTable, channelAllowedPostersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

function formatChannel(ch: any, postCount = 0) {
  return {
    id: ch.id,
    name: ch.name,
    description: ch.description,
    icon: ch.icon,
    allowedTags: JSON.parse(ch.allowedTags || "[]"),
    isInternalComm: ch.isInternalComm,
    postCount,
    createdAt: ch.createdAt?.toISOString?.() ?? ch.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const channels = await db.select().from(channelsTable);

  const accessible = channels.filter((ch) => {
    if (user.role === "admin" || user.role === "master_admin") return true;
    const tags = JSON.parse(ch.allowedTags || "[]");
    if (tags.length === 0) return true;
    return user.tag && tags.includes(user.tag);
  });

  res.json(accessible.map((ch) => formatChannel(ch)));
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, description, icon, allowedTags, isInternalComm } = req.body;
  const [ch] = await db.insert(channelsTable).values({
    name,
    description,
    icon,
    allowedTags: JSON.stringify(allowedTags || []),
    isInternalComm: isInternalComm || false,
  }).returning();
  res.json(formatChannel(ch));
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const [ch] = await db.select().from(channelsTable).where(eq(channelsTable.id, parseInt(id))).limit(1);
  if (!ch) { res.status(404).json({ error: "Channel not found" }); return; }
  res.json(formatChannel(ch));
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, icon, allowedTags, isInternalComm } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  if (allowedTags !== undefined) updates.allowedTags = JSON.stringify(allowedTags);
  if (isInternalComm !== undefined) updates.isInternalComm = isInternalComm;
  const [ch] = await db.update(channelsTable).set(updates).where(eq(channelsTable.id, parseInt(id))).returning();
  res.json(formatChannel(ch));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(channelsTable).where(eq(channelsTable.id, parseInt(id)));
  res.json({ success: true, message: "Deleted" });
});

router.get("/:id/can-post", requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  if (user.role === "admin" || user.role === "master_admin") {
    res.json({ canPost: true }); return;
  }
  const [ch] = await db.select().from(channelsTable).where(eq(channelsTable.id, parseInt(id))).limit(1);
  if (!ch) { res.json({ canPost: false }); return; }

  if (ch.isInternalComm) {
    const [poster] = await db.select().from(channelAllowedPostersTable)
      .where(and(eq(channelAllowedPostersTable.channelId, parseInt(id)), eq(channelAllowedPostersTable.userId, user.id)))
      .limit(1);
    res.json({ canPost: !!poster }); return;
  }
  res.json({ canPost: true });
});

router.post("/:id/allowed-posters", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  await db.insert(channelAllowedPostersTable).values({ channelId: parseInt(id), userId }).onConflictDoNothing();
  res.json({ success: true, message: "Added" });
});

router.delete("/:id/allowed-posters", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  await db.delete(channelAllowedPostersTable)
    .where(and(eq(channelAllowedPostersTable.channelId, parseInt(id)), eq(channelAllowedPostersTable.userId, userId)));
  res.json({ success: true, message: "Removed" });
});

export default router;
