import { Router } from "express";
import { db, termAcceptancesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

router.get("/my", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const acceptances = await db
    .select()
    .from(termAcceptancesTable)
    .where(eq(termAcceptancesTable.userId, user.id))
    .orderBy(desc(termAcceptancesTable.acceptedAt));

  res.json(acceptances.map((a) => ({
    id: a.id,
    termKey: a.termKey,
    termTitle: a.termTitle,
    acceptedAt: a.acceptedAt?.toISOString?.() ?? a.acceptedAt,
  })));
});

router.post("/accept", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { termKey, termTitle } = req.body;
  if (!termKey || !termTitle) {
    res.status(400).json({ error: "termKey and termTitle are required" });
    return;
  }

  const existing = await db
    .select()
    .from(termAcceptancesTable)
    .where(and(eq(termAcceptancesTable.userId, user.id), eq(termAcceptancesTable.termKey, termKey)))
    .limit(1);

  if (existing.length > 0) {
    res.json({
      id: existing[0].id,
      termKey: existing[0].termKey,
      termTitle: existing[0].termTitle,
      acceptedAt: existing[0].acceptedAt?.toISOString?.() ?? existing[0].acceptedAt,
    });
    return;
  }

  const [acceptance] = await db
    .insert(termAcceptancesTable)
    .values({ userId: user.id, termKey, termTitle })
    .returning();

  res.json({
    id: acceptance.id,
    termKey: acceptance.termKey,
    termTitle: acceptance.termTitle,
    acceptedAt: acceptance.acceptedAt?.toISOString?.() ?? acceptance.acceptedAt,
  });
});

router.get("/admin/user/:userId", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const acceptances = await db
    .select()
    .from(termAcceptancesTable)
    .where(eq(termAcceptancesTable.userId, userId))
    .orderBy(desc(termAcceptancesTable.acceptedAt));
  res.json(acceptances.map((a) => ({
    id: a.id,
    termKey: a.termKey,
    termTitle: a.termTitle,
    acceptedAt: a.acceptedAt?.toISOString?.() ?? a.acceptedAt,
  })));
});

router.get("/admin/all", requireAdmin, async (req, res) => {
  const acceptances = await db
    .select()
    .from(termAcceptancesTable)
    .orderBy(desc(termAcceptancesTable.acceptedAt));

  const enriched = await Promise.all(
    acceptances.map(async (a) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, a.userId))
        .limit(1);
      return {
        id: a.id,
        termKey: a.termKey,
        termTitle: a.termTitle,
        acceptedAt: a.acceptedAt?.toISOString?.() ?? a.acceptedAt,
        user: user ? formatUserBasic(user) : { id: a.userId, name: "Usuário removido", role: "user" },
      };
    })
  );

  res.json(enriched);
});

export default router;
