import { Router } from "express";
import { db, documentReadsTable, docReadCompletionsTable, usersTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

const TOTAL_DOCS = 16;

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

  res.json({
    readKeys: reads.map((r) => r.documentKey),
    completionCount: Number(completions[0]?.count ?? 0),
    totalDocs: TOTAL_DOCS,
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

  if (existing.length === 0) {
    await db.insert(documentReadsTable).values({ userId: user.id, documentKey });
  }

  const totalRead = await db
    .select({ count: count() })
    .from(documentReadsTable)
    .where(eq(documentReadsTable.userId, user.id));

  const readCount = Number(totalRead[0]?.count ?? 0);

  if (readCount >= TOTAL_DOCS) {
    await db.insert(docReadCompletionsTable).values({ userId: user.id });
  }

  const completions = await db
    .select({ count: count() })
    .from(docReadCompletionsTable)
    .where(eq(docReadCompletionsTable.userId, user.id));

  res.json({
    readKeys: (await db
      .select({ documentKey: documentReadsTable.documentKey })
      .from(documentReadsTable)
      .where(eq(documentReadsTable.userId, user.id))).map((r) => r.documentKey),
    completionCount: Number(completions[0]?.count ?? 0),
    totalDocs: TOTAL_DOCS,
  });
});

router.get("/admin", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);

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
      const percentage = Math.round((readCount / TOTAL_DOCS) * 100);

      return {
        user: formatUserBasic(u),
        readCount,
        completionCount,
        percentage,
        totalDocs: TOTAL_DOCS,
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
