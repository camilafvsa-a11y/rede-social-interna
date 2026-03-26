import { Router } from "express";
import { db, notificationsTable, pushTokensTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.post("/register-push", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { token, platform } = req.body;

  if (!token || !platform) {
    res.status(400).json({ error: "token and platform required" });
    return;
  }

  const existing = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.token, token))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushTokensTable)
      .set({ userId: user.id, platform, updatedAt: new Date() })
      .where(eq(pushTokensTable.token, token));
  } else {
    await db.insert(pushTokensTable).values({ userId: user.id, token, platform });
  }

  res.json({ success: true });
});

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(
    notifs.map((n) => ({
      ...n,
      data: n.data ? (() => { try { return JSON.parse(n.data!); } catch { return {}; } })() : {},
      createdAt: n.createdAt?.toISOString?.() ?? n.createdAt,
    }))
  );
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));
  res.json({ count: notifs.length });
});

router.post("/read/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
  res.json({ success: true });
});

router.post("/read-all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, user.id));
  res.json({ success: true });
});

export default router;
