import { Router } from "express";
import { db, channelsTable, channelAllowedPostersTable, channelReadsTable, postsTable, usersTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
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
    coverImageUrl: ch.coverImageUrl || null,
    color: ch.color || null,
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
    const userTags = [user.tag, ...(user.workTags || [])].filter(Boolean);
    return userTags.some((t) => tags.includes(t));
  });

  res.json(accessible.map((ch) => formatChannel(ch)));
});

router.post("/", requireAdmin, async (req, res) => {
  const { name, description, icon, allowedTags, isInternalComm, coverImageUrl, color } = req.body;
  const [ch] = await db.insert(channelsTable).values({
    name,
    description,
    icon,
    allowedTags: JSON.stringify(allowedTags || []),
    isInternalComm: isInternalComm || false,
    coverImageUrl: coverImageUrl || null,
    color: color || null,
  }).returning();
  res.json(formatChannel(ch));
});

// ── Unread channel tracking (must be before /:id) ────────────────────────────

router.get("/unread-ids", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const allChannels = await db.select().from(channelsTable);
  const accessible = allChannels.filter((ch) => {
    if (user.role === "admin" || user.role === "master_admin") return true;
    const tags = JSON.parse(ch.allowedTags || "[]");
    if (tags.length === 0) return true;
    const userTags: string[] = [
      ...(user.tag ? [user.tag] : []),
      ...(Array.isArray(user.workTags) ? user.workTags : []),
    ];
    return tags.some((t: string) => userTags.includes(t));
  });

  const reads = await db.select().from(channelReadsTable).where(eq(channelReadsTable.userId, user.id));
  const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));

  const unreadIds: number[] = [];
  for (const ch of accessible) {
    const lastRead = readMap.get(ch.id);
    if (!lastRead) {
      const [post] = await db.select().from(postsTable).where(eq(postsTable.channelId, ch.id)).limit(1);
      if (post) unreadIds.push(ch.id);
    } else {
      const [newPost] = await db.select().from(postsTable)
        .where(and(eq(postsTable.channelId, ch.id), gt(postsTable.createdAt, lastRead))).limit(1);
      if (newPost) unreadIds.push(ch.id);
    }
  }

  res.json({ unreadIds });
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const [ch] = await db.select().from(channelsTable).where(eq(channelsTable.id, parseInt(id))).limit(1);
  if (!ch) { res.status(404).json({ error: "Channel not found" }); return; }
  res.json(formatChannel(ch));
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, icon, allowedTags, isInternalComm, coverImageUrl, color } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  if (allowedTags !== undefined) updates.allowedTags = JSON.stringify(allowedTags);
  if (isInternalComm !== undefined) updates.isInternalComm = isInternalComm;
  if (coverImageUrl !== undefined) updates.coverImageUrl = coverImageUrl || null;
  if (color !== undefined) updates.color = color || null;
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

router.post("/:id/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const channelId = parseInt(id);

  await db.insert(channelReadsTable)
    .values({ userId: user.id, channelId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [channelReadsTable.userId, channelReadsTable.channelId],
      set: { lastReadAt: new Date() },
    });

  res.json({ success: true });
});

export default router;
