import { Router } from "express";
import { db, documentReadsTable, docReadCompletionsTable, usersTable, integraItemsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";
import { processGamificationEvent } from "./gamification.js";

const router = Router();

const FALLBACK_TOTAL = 15;

async function getDynamicTotal(): Promise<number> {
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(integraItemsTable)
      .where(and(eq(integraItemsTable.isActive, true), eq(integraItemsTable.countsForProgress, true)));
    const n = Number(value);
    return n > 0 ? n : FALLBACK_TOTAL;
  } catch {
    return FALLBACK_TOTAL;
  }
}

router.get("/my", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const reads = await db
    .select({ documentKey: documentReadsTable.documentKey })
    .from(documentReadsTable)
    .where(eq(documentReadsTable.userId, user.id));

  const completions = await db
    .select({ count: count() })
    .from(docReadCompletionsTable)
    .where(eq(docReadCompletionsTable.userId, user.id));

  const totalDocs = await getDynamicTotal();
  res.json({
    readKeys: reads.map((r) => r.documentKey),
    completionCount: Number(completions[0]?.count ?? 0),
    totalDocs,
  });
});

router.post("/mark", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { documentKey } = req.body;

  if (!documentKey) {
    res.status(400).json({ error: "documentKey is required" });
    return;
  }

  const existing = await db
    .select()
    .from(documentReadsTable)
    .where(and(eq(documentReadsTable.userId, user.id), eq(documentReadsTable.documentKey, documentKey)))
    .limit(1);

  const isNew = existing.length === 0;
  if (isNew) {
    await db.insert(documentReadsTable).values({ userId: user.id, documentKey });
  }

  // Gamification: award points only for first-time reads
  if (isNew) {
    setImmediate(async () => {
      try {
        await processGamificationEvent({
          userId: user.id,
          actionType: "doc_read",
          entityType: "doc",
          idempotencyKey: `doc_read_${user.id}_${documentKey}`,
        });
      } catch (e) {
        console.error("[Gamification doc_read]", e);
      }
    });
  }

  const totalRead = await db
    .select({ count: count() })
    .from(documentReadsTable)
    .where(eq(documentReadsTable.userId, user.id));

  const readCount = Number(totalRead[0]?.count ?? 0);
  const totalDocs = await getDynamicTotal();

  if (readCount >= totalDocs) {
    const already = await db
      .select({ id: docReadCompletionsTable.id })
      .from(docReadCompletionsTable)
      .where(eq(docReadCompletionsTable.userId, user.id))
      .limit(1);
    if (already.length === 0) {
      await db.insert(docReadCompletionsTable).values({ userId: user.id });
    }
  }

  const completions = await db
    .select({ count: count() })
    .from(docReadCompletionsTable)
    .where(eq(docReadCompletionsTable.userId, user.id));

  const allReads = await db
    .select({ documentKey: documentReadsTable.documentKey })
    .from(documentReadsTable)
    .where(eq(documentReadsTable.userId, user.id));

  res.json({
    readKeys: allReads.map((r) => r.documentKey),
    completionCount: Number(completions[0]?.count ?? 0),
    totalDocs,
  });
});

router.get("/admin", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  const totalDocs = await getDynamicTotal();

  const result = await Promise.all(
    users.map(async (u) => {
      const reads = await db
        .select({ count: count() })
        .from(documentReadsTable)
        .where(eq(documentReadsTable.userId, u.id));

      const completions = await db
        .select({ count: count() })
        .from(docReadCompletionsTable)
        .where(eq(docReadCompletionsTable.userId, u.id));

      const readCount = Number(reads[0]?.count ?? 0);
      const completionCount = Number(completions[0]?.count ?? 0);
      const percentage = Math.min(100, Math.round((readCount / totalDocs) * 100));

      return {
        user: formatUserBasic(u),
        readCount,
        completionCount,
        percentage,
        totalDocs,
      };
    })
  );

  res.json(result);
});

router.delete("/reset/:userId", requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  await db.delete(documentReadsTable).where(eq(documentReadsTable.userId, targetId));
  await db.delete(docReadCompletionsTable).where(eq(docReadCompletionsTable.userId, targetId));

  res.json({ success: true });
});

export default router;
