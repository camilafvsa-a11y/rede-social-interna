import { Router } from "express";
import { db, notificationsTable, pushTokensTable, usersTable } from "@workspace/db";
import { eq, desc, and, lt, gte, or, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { notifyBroadcast } from "../lib/notify.js";

const router = Router();

// ── Push token registration ───────────────────────────────────────────────────
router.post("/register-push", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { token, platform } = req.body;
  if (!token || !platform) { res.status(400).json({ error: "token and platform required" }); return; }
  const existing = await db.select().from(pushTokensTable).where(eq(pushTokensTable.token, token)).limit(1);
  if (existing.length > 0) {
    await db.update(pushTokensTable).set({ userId: user.id, platform, updatedAt: new Date() }).where(eq(pushTokensTable.token, token));
  } else {
    await db.insert(pushTokensTable).values({ userId: user.id, token, platform });
  }
  res.json({ success: true });
});

// ── GET /notifications — user's notifications, priority-sorted ───────────────
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const limit = parseInt(req.query.limit as string || "60");
  const offset = parseInt(req.query.offset as string || "0");

  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isArchived, false)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Sort: unread high-priority first, then rest by createdAt
  const parsed = notifs.map((n) => ({
    ...n,
    data: n.data ? (() => { try { return JSON.parse(n.data!); } catch { return {}; } })() : {},
    createdAt: n.createdAt?.toISOString?.() ?? n.createdAt,
    readAt: n.readAt?.toISOString?.() ?? null,
  }));

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = parsed.sort((a, b) => {
    if (!a.read && b.read) return -1;
    if (a.read && !b.read) return 1;
    if (!a.read && !b.read) {
      const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
      const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
      if (pa !== pb) return pa - pb;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  res.json(sorted);
});

// ── GET /notifications/unread-count ─────────────────────────────────────────
router.get("/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const notifs = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false), eq(notificationsTable.isArchived, false)));
  res.json({ count: notifs.length });
});

// ── POST /notifications/read/:id ─────────────────────────────────────────────
router.post("/read/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  await db.update(notificationsTable)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
  res.json({ success: true });
});

// ── POST /notifications/read-all ─────────────────────────────────────────────
router.post("/read-all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));
  res.json({ success: true });
});

// ── POST /notifications/archive/:id ─────────────────────────────────────────
router.post("/archive/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  await db.update(notificationsTable)
    .set({ isArchived: true, read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
  res.json({ success: true });
});

// ── POST /notifications/archive-all ─────────────────────────────────────────
router.post("/archive-all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ isArchived: true, read: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, true)));
  res.json({ success: true });
});

// ═══ ADMIN routes ════════════════════════════════════════════════════════════

// ── GET /notifications/admin — list all notifications with filters ───────────
router.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  const { type, userId, period, read, limit: lim = "80" } = req.query as Record<string, string>;
  let query = db.select({
    notif: notificationsTable,
    userName: usersTable.name,
  })
    .from(notificationsTable)
    .leftJoin(usersTable, eq(notificationsTable.userId, usersTable.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(parseInt(lim));

  const conditions: any[] = [];
  if (type) conditions.push(eq(notificationsTable.type, type));
  if (userId) conditions.push(eq(notificationsTable.userId, parseInt(userId)));
  if (read === "true") conditions.push(eq(notificationsTable.read, true));
  if (read === "false") conditions.push(eq(notificationsTable.read, false));
  if (period === "today") conditions.push(gte(notificationsTable.createdAt, new Date(Date.now() - 86400_000)));
  if (period === "week") conditions.push(gte(notificationsTable.createdAt, new Date(Date.now() - 7 * 86400_000)));

  const rows = conditions.length > 0
    ? await (query as any).where(and(...conditions))
    : await query;

  res.json(rows.map((r: any) => ({
    ...r.notif,
    userName: r.userName ?? "Usuário",
    data: r.notif.data ? (() => { try { return JSON.parse(r.notif.data!); } catch { return {}; } })() : {},
    createdAt: r.notif.createdAt?.toISOString?.() ?? r.notif.createdAt,
  })));
});

// ── GET /notifications/admin/stats ──────────────────────────────────────────
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  const all = await db.select().from(notificationsTable);
  const total = all.length;
  const unread = all.filter((n) => !n.read).length;
  const byType: Record<string, number> = {};
  for (const n of all) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }
  const today = all.filter((n) => n.createdAt && n.createdAt > new Date(Date.now() - 86400_000)).length;
  res.json({ total, unread, today, byType });
});

// ── POST /notifications/admin/broadcast — send to all users ─────────────────
router.post("/admin/broadcast", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  const { title, body, routePath } = req.body;
  if (!title?.trim() || !body?.trim()) { res.status(400).json({ error: "title and body required" }); return; }
  await notifyBroadcast({ title: title.trim(), body: body.trim(), authorId: user.id, routePath });
  res.json({ success: true });
});

export default router;
