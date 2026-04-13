import { Router } from "express";
import {
  db,
  gamificationRulesTable,
  gamificationEventsTable,
  gamificationDailyCountersTable,
  gamificationBlocksTable,
  leaderboardsTable,
  leaderboardParticipantsTable,
  leaderboardResultsTable,
  userProfileAchievementsTable,
  adminGamificationLogsTable,
  usersTable,
} from "@workspace/db";
import {
  eq, and, desc, asc, count, sql, gte, lte, isNull, isNotNull, inArray,
  or,
} from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date string in format YYYY-MM-DD adjusted to UTC-3 */
function todayUTC3(): string {
  const now = new Date();
  now.setHours(now.getHours() - 3);
  return now.toISOString().slice(0, 10);
}

async function logAdminAction(
  adminId: number,
  action: string,
  opts: { targetUserId?: number; targetLeaderboardId?: number; details?: any; oldValue?: string; newValue?: string } = {}
) {
  await db.insert(adminGamificationLogsTable).values({
    adminId,
    action,
    targetUserId: opts.targetUserId ?? null,
    targetLeaderboardId: opts.targetLeaderboardId ?? null,
    details: opts.details ?? {},
    oldValue: opts.oldValue ?? null,
    newValue: opts.newValue ?? null,
  });
}

// ─── GAMIFICATION ENGINE ─────────────────────────────────────────────────────

export type GamificationInput = {
  userId: number;
  actionType: "like" | "comment" | "doc_read" | "doc_sign";
  entityType?: "post" | "comment" | "doc";
  entityId?: number;
  commentContent?: string; // for comment anti-spam validation
  idempotencyKey: string;
};

export type GamificationResult = {
  awarded: number;
  blocked: boolean;
  blockReason?: string;
  eventId: number;
};

export async function processGamificationEvent(input: GamificationInput): Promise<GamificationResult> {
  const { userId, actionType, entityType, entityId, commentContent, idempotencyKey } = input;

  // 1. Idempotency — never double-process
  const [existing] = await db
    .select({ id: gamificationEventsTable.id })
    .from(gamificationEventsTable)
    .where(eq(gamificationEventsTable.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) {
    return { awarded: 0, blocked: true, blockReason: "duplicate", eventId: existing.id };
  }

  // 2. Get rule for this action type
  const [rule] = await db
    .select()
    .from(gamificationRulesTable)
    .where(eq(gamificationRulesTable.actionType, actionType))
    .limit(1);

  if (!rule || !rule.isActive) {
    const [evt] = await db.insert(gamificationEventsTable).values({
      userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
      pointsAwarded: 0, pointsBlocked: 0,
      status: "blocked", blockReason: "action_disabled",
      idempotencyKey,
    }).returning({ id: gamificationEventsTable.id });
    return { awarded: 0, blocked: true, blockReason: "action_disabled", eventId: evt.id };
  }

  // 3. Check if user is blocked for gamification
  const [block] = await db
    .select()
    .from(gamificationBlocksTable)
    .where(and(eq(gamificationBlocksTable.userId, userId), eq(gamificationBlocksTable.isActive, true)))
    .limit(1);
  if (block) {
    const [evt] = await db.insert(gamificationEventsTable).values({
      userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
      pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
      status: "blocked", blockReason: "user_blocked",
      idempotencyKey,
    }).returning({ id: gamificationEventsTable.id });
    return { awarded: 0, blocked: true, blockReason: "user_blocked", eventId: evt.id };
  }

  // 4. Get active leaderboards that include this action
  const activeLbs = await db
    .select()
    .from(leaderboardsTable)
    .where(eq(leaderboardsTable.status, "active"));
  const relevantLbs = activeLbs.filter((lb) => {
    const actions = (lb.validActions as string[]) ?? [];
    return actions.length === 0 || actions.includes(actionType);
  });

  // 5. Daily counter
  const today = todayUTC3();
  const [counter] = await db
    .select()
    .from(gamificationDailyCountersTable)
    .where(
      and(
        eq(gamificationDailyCountersTable.userId, userId),
        eq(gamificationDailyCountersTable.actionType, actionType),
        eq(gamificationDailyCountersTable.date, today),
      )
    )
    .limit(1);

  const currentCount = counter?.count ?? 0;

  // 6. Daily limit
  if (rule.dailyLimit > 0 && currentCount >= rule.dailyLimit) {
    const [evt] = await db.insert(gamificationEventsTable).values({
      userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
      pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
      status: "blocked", blockReason: "daily_limit_reached",
      idempotencyKey,
    }).returning({ id: gamificationEventsTable.id });
    return { awarded: 0, blocked: true, blockReason: "daily_limit_reached", eventId: evt.id };
  }

  // 7. Cooldown check
  if (rule.cooldownSeconds > 0 && counter?.lastActionAt) {
    const elapsed = (Date.now() - new Date(counter.lastActionAt).getTime()) / 1000;
    if (elapsed < rule.cooldownSeconds) {
      const [evt] = await db.insert(gamificationEventsTable).values({
        userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
        pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
        status: "blocked", blockReason: "cooldown",
        idempotencyKey,
      }).returning({ id: gamificationEventsTable.id });
      return { awarded: 0, blocked: true, blockReason: "cooldown", eventId: evt.id };
    }
  }

  // 8. Comment-specific anti-spam
  if (actionType === "comment" && commentContent !== undefined) {
    const trimmed = commentContent.trim();

    // Min chars
    if (rule.minChars > 0 && trimmed.length < rule.minChars) {
      const [evt] = await db.insert(gamificationEventsTable).values({
        userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
        pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
        status: "blocked", blockReason: "too_short",
        idempotencyKey,
      }).returning({ id: gamificationEventsTable.id });
      return { awarded: 0, blocked: true, blockReason: "too_short", eventId: evt.id };
    }

    // Only emoji check
    const emojiOnly = /^[\p{Emoji}\s]+$/u.test(trimmed);
    if (emojiOnly) {
      const [evt] = await db.insert(gamificationEventsTable).values({
        userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
        pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
        status: "blocked", blockReason: "emoji_only",
        idempotencyKey,
      }).returning({ id: gamificationEventsTable.id });
      return { awarded: 0, blocked: true, blockReason: "emoji_only", eventId: evt.id };
    }

    // Blocked terms
    const blockedTerms = (rule.blockedTerms as string[]) ?? [];
    if (blockedTerms.length > 0) {
      const lower = trimmed.toLowerCase();
      const isBlocked = blockedTerms.some((t: string) => {
        const term = t.trim().toLowerCase();
        return term && (lower === term || lower.replace(/[^\w]/g, "") === term.replace(/[^\w]/g, ""));
      });
      if (isBlocked) {
        const [evt] = await db.insert(gamificationEventsTable).values({
          userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
          pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
          status: "blocked", blockReason: "blocked_term",
          idempotencyKey,
        }).returning({ id: gamificationEventsTable.id });
        return { awarded: 0, blocked: true, blockReason: "blocked_term", eventId: evt.id };
      }
    }

    // Max comments per post check
    if (rule.maxCommentsPerPost > 0 && entityId) {
      const [countRes] = await db
        .select({ c: count() })
        .from(gamificationEventsTable)
        .where(
          and(
            eq(gamificationEventsTable.userId, userId),
            eq(gamificationEventsTable.actionType, "comment"),
            eq(gamificationEventsTable.entityId, entityId),
            eq(gamificationEventsTable.status, "valid"),
          )
        );
      if (Number(countRes?.c ?? 0) >= rule.maxCommentsPerPost) {
        const [evt] = await db.insert(gamificationEventsTable).values({
          userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
          pointsAwarded: 0, pointsBlocked: rule.pointsPerAction,
          status: "blocked", blockReason: "max_comments_per_post",
          idempotencyKey,
        }).returning({ id: gamificationEventsTable.id });
        return { awarded: 0, blocked: true, blockReason: "max_comments_per_post", eventId: evt.id };
      }
    }
  }

  // 9. Compute points
  let points = rule.pointsPerAction;
  if (rule.useDecreasingPoints) {
    const vals = (rule.decreaseValues as number[]) ?? [];
    if (vals.length > 0) {
      points = currentCount < vals.length ? vals[currentCount] : 0;
    }
  }

  if (points === 0 && rule.dailyLimit > 0 && currentCount < rule.dailyLimit) {
    // points = 0 by config; award 0 but still valid
  }

  // 10. Insert valid event
  const [evt] = await db.insert(gamificationEventsTable).values({
    userId, actionType, entityType: entityType ?? null, entityId: entityId ?? null,
    pointsAwarded: points, pointsBlocked: 0,
    status: "valid",
    leaderboardId: relevantLbs[0]?.id ?? null,
    idempotencyKey,
  }).returning({ id: gamificationEventsTable.id });

  // 11. Update daily counter (upsert)
  await db
    .insert(gamificationDailyCountersTable)
    .values({ userId, actionType, date: today, count: 1, lastActionAt: new Date() })
    .onConflictDoUpdate({
      target: [
        gamificationDailyCountersTable.userId,
        gamificationDailyCountersTable.actionType,
        gamificationDailyCountersTable.date,
      ],
      set: {
        count: sql`${gamificationDailyCountersTable.count} + 1`,
        lastActionAt: new Date(),
      },
    });

  // 12. Update leaderboard participants for all relevant leaderboards
  if (points > 0 && relevantLbs.length > 0) {
    for (const lb of relevantLbs) {
      await db
        .insert(leaderboardParticipantsTable)
        .values({
          leaderboardId: lb.id,
          userId,
          totalPoints: points,
          totalActions: 1,
          blockedActions: 0,
          firstScoredAt: new Date(),
          lastUpdated: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            leaderboardParticipantsTable.leaderboardId,
            leaderboardParticipantsTable.userId,
          ],
          set: {
            totalPoints: sql`${leaderboardParticipantsTable.totalPoints} + ${points}`,
            totalActions: sql`${leaderboardParticipantsTable.totalActions} + 1`,
            lastUpdated: new Date(),
          },
        });
    }
  }

  return { awarded: points, blocked: false, eventId: evt.id };
}

// ─── SEED DEFAULT RULES ───────────────────────────────────────────────────────

async function seedRulesIfEmpty() {
  const existing = await db.select({ id: gamificationRulesTable.id }).from(gamificationRulesTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(gamificationRulesTable).values([
    {
      actionType: "like",
      label: "Curtir publicação",
      isActive: true,
      pointsPerAction: 5,
      dailyLimit: 20,
      cooldownSeconds: 2,
      minChars: 0,
      blockedTerms: [],
      maxCommentsPerPost: 0,
      useDecreasingPoints: true,
      decreaseValues: [5, 4, 3, 2, 1],
    },
    {
      actionType: "comment",
      label: "Comentar publicação",
      isActive: true,
      pointsPerAction: 10,
      dailyLimit: 10,
      cooldownSeconds: 30,
      minChars: 15,
      blockedTerms: ["ok", "top", "show", "bom dia", "boa tarde", "boa noite", "👍", "👏", "👌", "legal", "ótimo", "excelente"],
      maxCommentsPerPost: 2,
      useDecreasingPoints: false,
      decreaseValues: [],
    },
    {
      actionType: "doc_read",
      label: "Ler documento",
      isActive: true,
      pointsPerAction: 15,
      dailyLimit: 10,
      cooldownSeconds: 0,
      minChars: 0,
      blockedTerms: [],
      maxCommentsPerPost: 0,
      useDecreasingPoints: false,
      decreaseValues: [],
    },
    {
      actionType: "doc_sign",
      label: "Assinar documento",
      isActive: true,
      pointsPerAction: 20,
      dailyLimit: 5,
      cooldownSeconds: 0,
      minChars: 0,
      blockedTerms: [],
      maxCommentsPerPost: 0,
      useDecreasingPoints: false,
      decreaseValues: [],
    },
  ]);
}

// Init seed at startup
seedRulesIfEmpty().catch(console.error);

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /gamification/me — current user stats + active leaderboard position
router.get("/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const today = todayUTC3();

  // Active leaderboard
  const [activeLb] = await db
    .select()
    .from(leaderboardsTable)
    .where(and(eq(leaderboardsTable.status, "active"), eq(leaderboardsTable.isVisible, true)))
    .orderBy(desc(leaderboardsTable.createdAt))
    .limit(1);

  let myParticipant = null;
  let rank = null;

  if (activeLb) {
    const [mp] = await db
      .select()
      .from(leaderboardParticipantsTable)
      .where(
        and(
          eq(leaderboardParticipantsTable.leaderboardId, activeLb.id),
          eq(leaderboardParticipantsTable.userId, user.id),
        )
      )
      .limit(1);
    myParticipant = mp ?? null;

    if (myParticipant) {
      const [rankRes] = await db
        .select({ r: count() })
        .from(leaderboardParticipantsTable)
        .where(
          and(
            eq(leaderboardParticipantsTable.leaderboardId, activeLb.id),
            sql`${leaderboardParticipantsTable.totalPoints} > ${myParticipant.totalPoints}`,
          )
        );
      rank = Number(rankRes?.r ?? 0) + 1;
    }
  }

  // Daily counters today
  const dailyCounters = await db
    .select()
    .from(gamificationDailyCountersTable)
    .where(
      and(
        eq(gamificationDailyCountersTable.userId, user.id),
        eq(gamificationDailyCountersTable.date, today),
      )
    );

  // Rules for limits
  const rules = await db.select().from(gamificationRulesTable).where(eq(gamificationRulesTable.isActive, true));

  // Is user blocked?
  const [block] = await db
    .select()
    .from(gamificationBlocksTable)
    .where(and(eq(gamificationBlocksTable.userId, user.id), eq(gamificationBlocksTable.isActive, true)))
    .limit(1);

  // Achievements
  const achievements = await db
    .select()
    .from(userProfileAchievementsTable)
    .where(eq(userProfileAchievementsTable.userId, user.id))
    .orderBy(desc(userProfileAchievementsTable.finalizedAt))
    .limit(10);

  // Today's points
  const [todayPts] = await db
    .select({ pts: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)` })
    .from(gamificationEventsTable)
    .where(
      and(
        eq(gamificationEventsTable.userId, user.id),
        eq(gamificationEventsTable.status, "valid"),
        sql`date(${gamificationEventsTable.createdAt} - interval '3 hours') = ${today}`,
      )
    );

  const dailyMap: Record<string, number> = {};
  for (const c of dailyCounters) dailyMap[c.actionType] = c.count;

  res.json({
    leaderboard: activeLb ?? null,
    myPoints: myParticipant?.totalPoints ?? 0,
    myRank: rank,
    todayPoints: Number(todayPts?.pts ?? 0),
    isBlocked: !!block,
    dailyCounters: dailyMap,
    rules: rules.map((r) => ({
      actionType: r.actionType,
      label: r.label,
      pointsPerAction: r.pointsPerAction,
      dailyLimit: r.dailyLimit,
      todayCount: dailyMap[r.actionType] ?? 0,
      remaining: Math.max(0, r.dailyLimit - (dailyMap[r.actionType] ?? 0)),
    })),
    achievements,
  });
});

// GET /gamification/me/history — recent point events for current user
router.get("/me/history", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { limit = "30", offset = "0" } = req.query as any;

  const events = await db
    .select()
    .from(gamificationEventsTable)
    .where(eq(gamificationEventsTable.userId, user.id))
    .orderBy(desc(gamificationEventsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  res.json(events);
});

// GET /gamification/leaderboard/active — active leaderboard with top rankings
router.get("/leaderboard/active", requireAuth, async (_req, res) => {
  const [activeLb] = await db
    .select()
    .from(leaderboardsTable)
    .where(and(eq(leaderboardsTable.status, "active"), eq(leaderboardsTable.isVisible, true)))
    .orderBy(desc(leaderboardsTable.createdAt))
    .limit(1);

  if (!activeLb) {
    res.json({ leaderboard: null, rankings: [] });
    return;
  }

  const participants = await db
    .select()
    .from(leaderboardParticipantsTable)
    .where(eq(leaderboardParticipantsTable.leaderboardId, activeLb.id))
    .orderBy(
      desc(leaderboardParticipantsTable.totalPoints),
      asc(leaderboardParticipantsTable.firstScoredAt),
    )
    .limit(50);

  const userIds = participants.map((p) => p.userId);
  const users = userIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const rankings = participants.map((p, idx) => ({
    rank: idx + 1,
    userId: p.userId,
    user: p.userId in userMap ? formatUserBasic(userMap[p.userId]) : { id: p.userId, name: "Usuário" },
    totalPoints: p.totalPoints,
    totalActions: p.totalActions,
  }));

  res.json({ leaderboard: activeLb, rankings });
});

// GET /gamification/leaderboards — all visible leaderboards
router.get("/leaderboards", requireAuth, async (_req, res) => {
  const lbs = await db
    .select()
    .from(leaderboardsTable)
    .where(and(eq(leaderboardsTable.isVisible, true), eq(leaderboardsTable.status, "active")))
    .orderBy(desc(leaderboardsTable.createdAt));
  res.json(lbs);
});

// GET /gamification/leaderboards/:id/rankings — public leaderboard rankings
router.get("/leaderboards/:id/rankings", requireAuth, async (req, res) => {
  const lbId = parseInt(req.params.id);
  if (isNaN(lbId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [lb] = await db
    .select()
    .from(leaderboardsTable)
    .where(and(eq(leaderboardsTable.id, lbId), eq(leaderboardsTable.isVisible, true)))
    .limit(1);
  if (!lb) { res.status(404).json({ error: "Not found" }); return; }

  const participants = await db
    .select()
    .from(leaderboardParticipantsTable)
    .where(eq(leaderboardParticipantsTable.leaderboardId, lbId))
    .orderBy(desc(leaderboardParticipantsTable.totalPoints), asc(leaderboardParticipantsTable.firstScoredAt))
    .limit(100);

  const userIds = participants.map((p) => p.userId);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const rankings = participants.map((p, idx) => ({
    rank: idx + 1,
    userId: p.userId,
    user: p.userId in userMap ? formatUserBasic(userMap[p.userId]) : { id: p.userId, name: "Usuário" },
    totalPoints: p.totalPoints,
    totalActions: p.totalActions,
  }));

  res.json(rankings);
});

// GET /gamification/my-stats — compact stats card for current user
router.get("/my-stats", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const today = todayUTC3();

  const [block] = await db
    .select()
    .from(gamificationBlocksTable)
    .where(and(eq(gamificationBlocksTable.userId, user.id), eq(gamificationBlocksTable.isActive, true)))
    .limit(1);

  const dailyCounters = await db
    .select()
    .from(gamificationDailyCountersTable)
    .where(and(eq(gamificationDailyCountersTable.userId, user.id), eq(gamificationDailyCountersTable.date, today)));

  const todayActions = dailyCounters.reduce((s, c) => s + c.count, 0);

  const [totalPts] = await db
    .select({ pts: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)` })
    .from(gamificationEventsTable)
    .where(and(eq(gamificationEventsTable.userId, user.id), eq(gamificationEventsTable.status, "valid")));

  const [todayPts] = await db
    .select({ pts: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)` })
    .from(gamificationEventsTable)
    .where(
      and(
        eq(gamificationEventsTable.userId, user.id),
        eq(gamificationEventsTable.status, "valid"),
        sql`date(${gamificationEventsTable.createdAt} - interval '3 hours') = ${today}`,
      )
    );

  res.json({
    totalPoints: Number(totalPts?.pts ?? 0),
    todayPoints: Number(todayPts?.pts ?? 0),
    todayActions,
    isBlocked: !!block,
  });
});

// GET /gamification/my-events — recent events for current user
router.get("/my-events", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { limit = "20", offset = "0" } = req.query as any;

  const events = await db
    .select()
    .from(gamificationEventsTable)
    .where(eq(gamificationEventsTable.userId, user.id))
    .orderBy(desc(gamificationEventsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  res.json(events);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Rules ──

router.get("/admin/rules", requireAdmin, async (_req, res) => {
  const rules = await db.select().from(gamificationRulesTable).orderBy(asc(gamificationRulesTable.id));
  res.json(rules);
});

router.patch("/admin/rules/:id", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { id } = req.params;
  const {
    isActive, pointsPerAction, dailyLimit, cooldownSeconds,
    minChars, blockedTerms, maxCommentsPerPost,
    useDecreasingPoints, decreaseValues,
  } = req.body;

  const [old] = await db.select().from(gamificationRulesTable).where(eq(gamificationRulesTable.id, parseInt(id))).limit(1);
  if (!old) { res.status(404).json({ error: "Rule not found" }); return; }

  const update: any = { updatedAt: new Date() };
  if (isActive !== undefined) update.isActive = isActive;
  if (pointsPerAction !== undefined) update.pointsPerAction = pointsPerAction;
  if (dailyLimit !== undefined) update.dailyLimit = dailyLimit;
  if (cooldownSeconds !== undefined) update.cooldownSeconds = cooldownSeconds;
  if (minChars !== undefined) update.minChars = minChars;
  if (blockedTerms !== undefined) update.blockedTerms = blockedTerms;
  if (maxCommentsPerPost !== undefined) update.maxCommentsPerPost = maxCommentsPerPost;
  if (useDecreasingPoints !== undefined) update.useDecreasingPoints = useDecreasingPoints;
  if (decreaseValues !== undefined) update.decreaseValues = decreaseValues;

  const [updated] = await db.update(gamificationRulesTable).set(update).where(eq(gamificationRulesTable.id, parseInt(id))).returning();
  await logAdminAction(admin.id, "changed_rule", {
    details: { ruleId: id, fields: Object.keys(update) },
    oldValue: JSON.stringify(old),
    newValue: JSON.stringify(updated),
  });
  res.json(updated);
});

// ── Leaderboards ──

router.get("/admin/leaderboards", requireAdmin, async (_req, res) => {
  const lbs = await db.select().from(leaderboardsTable).orderBy(desc(leaderboardsTable.createdAt));
  res.json(lbs);
});

router.post("/admin/leaderboards", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const {
    name, description, startDate, endDate, status,
    validActions, isVisible, tiebreakRule, showsProfileAchievement,
  } = req.body;

  if (!name || !startDate || !endDate) {
    res.status(400).json({ error: "name, startDate e endDate são obrigatórios" }); return;
  }

  const [lb] = await db.insert(leaderboardsTable).values({
    name,
    description: description ?? null,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: status ?? "draft",
    validActions: validActions ?? [],
    isVisible: isVisible ?? true,
    tiebreakRule: tiebreakRule ?? "first_to_score",
    showsProfileAchievement: showsProfileAchievement ?? true,
    createdBy: admin.id,
  }).returning();

  await logAdminAction(admin.id, "created_leaderboard", {
    targetLeaderboardId: lb.id,
    details: { name },
  });
  res.json(lb);
});

router.patch("/admin/leaderboards/:id", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { id } = req.params;
  const body = req.body;

  const [old] = await db.select().from(leaderboardsTable).where(eq(leaderboardsTable.id, parseInt(id))).limit(1);
  if (!old) { res.status(404).json({ error: "Leaderboard not found" }); return; }

  const update: any = { updatedAt: new Date() };
  const fields = ["name", "description", "startDate", "endDate", "status", "validActions", "isVisible", "tiebreakRule", "showsProfileAchievement"];
  for (const f of fields) {
    if (body[f] !== undefined) {
      if (f === "startDate" || f === "endDate") update[f] = new Date(body[f]);
      else update[f] = body[f];
    }
  }

  const [updated] = await db.update(leaderboardsTable).set(update).where(eq(leaderboardsTable.id, parseInt(id))).returning();

  // If ending, freeze results
  if (body.status === "ended" && old.status !== "ended") {
    await finalizeLeaderboard(parseInt(id), updated, admin.id);
  }

  await logAdminAction(admin.id, "updated_leaderboard", {
    targetLeaderboardId: parseInt(id),
    oldValue: old.status,
    newValue: body.status ?? old.status,
  });
  res.json(updated);
});

async function finalizeLeaderboard(lbId: number, lb: any, adminId: number) {
  const participants = await db
    .select()
    .from(leaderboardParticipantsTable)
    .where(eq(leaderboardParticipantsTable.leaderboardId, lbId))
    .orderBy(
      desc(leaderboardParticipantsTable.totalPoints),
      asc(leaderboardParticipantsTable.firstScoredAt),
    );

  if (participants.length === 0) return;

  // Insert frozen results
  await db.insert(leaderboardResultsTable).values(
    participants.map((p, idx) => ({
      leaderboardId: lbId,
      userId: p.userId,
      rank: idx + 1,
      totalPoints: p.totalPoints,
      totalActions: p.totalActions,
    }))
  );

  // Award profile achievements for top 3
  if (lb.showsProfileAchievement) {
    const top3 = participants.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      const p = top3[i];
      await db.insert(userProfileAchievementsTable).values({
        userId: p.userId,
        leaderboardId: lbId,
        rank: i + 1,
        competitionName: lb.name,
        totalPoints: p.totalPoints,
        finalizedAt: new Date(),
      });
    }
  }

  await logAdminAction(adminId, "finalized_leaderboard", {
    targetLeaderboardId: lbId,
    details: { participantCount: participants.length, winner: participants[0]?.userId },
  });
}

// Duplicate leaderboard
router.post("/admin/leaderboards/:id/duplicate", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { id } = req.params;
  const [src] = await db.select().from(leaderboardsTable).where(eq(leaderboardsTable.id, parseInt(id))).limit(1);
  if (!src) { res.status(404).json({ error: "Leaderboard not found" }); return; }

  const [copy] = await db.insert(leaderboardsTable).values({
    name: `${src.name} (cópia)`,
    description: src.description ?? null,
    startDate: src.startDate,
    endDate: src.endDate,
    status: "draft",
    validActions: src.validActions,
    isVisible: false,
    tiebreakRule: src.tiebreakRule,
    showsProfileAchievement: src.showsProfileAchievement,
    createdBy: admin.id,
  }).returning();

  res.json(copy);
});

// Get leaderboard rankings (admin)
router.get("/admin/leaderboards/:id/rankings", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const participants = await db
    .select()
    .from(leaderboardParticipantsTable)
    .where(eq(leaderboardParticipantsTable.leaderboardId, parseInt(id)))
    .orderBy(
      desc(leaderboardParticipantsTable.totalPoints),
      asc(leaderboardParticipantsTable.firstScoredAt),
    );

  const userIds = participants.map((p) => p.userId);
  const users = userIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  res.json(participants.map((p, idx) => ({
    rank: idx + 1,
    userId: p.userId,
    user: p.userId in userMap ? formatUserBasic(userMap[p.userId]) : { id: p.userId, name: "Usuário" },
    totalPoints: p.totalPoints,
    totalActions: p.totalActions,
    blockedActions: p.blockedActions,
    lastUpdated: p.lastUpdated,
  })));
});

// ── Dashboard ──

router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const today = todayUTC3();

  // Total points ever generated
  const [totalPtsRes] = await db
    .select({ v: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)` })
    .from(gamificationEventsTable)
    .where(eq(gamificationEventsTable.status, "valid"));

  // Actions today
  const [todayActionsRes] = await db
    .select({ v: count() })
    .from(gamificationEventsTable)
    .where(sql`date(${gamificationEventsTable.createdAt} - interval '3 hours') = ${today}`);

  // Blocked actions today
  const [blockedTodayRes] = await db
    .select({ v: count() })
    .from(gamificationEventsTable)
    .where(
      and(
        eq(gamificationEventsTable.status, "blocked"),
        sql`date(${gamificationEventsTable.createdAt} - interval '3 hours') = ${today}`,
      )
    );

  // Active competitions
  const [activeCompRes] = await db
    .select({ v: count() })
    .from(leaderboardsTable)
    .where(eq(leaderboardsTable.status, "active"));

  // Blocked users
  const [blockedUsersRes] = await db
    .select({ v: count() })
    .from(gamificationBlocksTable)
    .where(eq(gamificationBlocksTable.isActive, true));

  // Action breakdown today
  const actionBreakdown = await db
    .select({
      actionType: gamificationEventsTable.actionType,
      total: count(),
      points: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)`,
    })
    .from(gamificationEventsTable)
    .where(
      and(
        eq(gamificationEventsTable.status, "valid"),
        sql`date(${gamificationEventsTable.createdAt} - interval '3 hours') = ${today}`,
      )
    )
    .groupBy(gamificationEventsTable.actionType);

  // Users who hit daily limit today
  const rules = await db.select().from(gamificationRulesTable);
  const rulesMap = Object.fromEntries(rules.map((r) => [r.actionType, r]));
  const limitHitters = await db
    .select()
    .from(gamificationDailyCountersTable)
    .where(eq(gamificationDailyCountersTable.date, today));
  const hitLimit = limitHitters.filter((c) => {
    const r = rulesMap[c.actionType];
    return r && r.dailyLimit > 0 && c.count >= r.dailyLimit;
  });

  res.json({
    totalPoints: Number(totalPtsRes?.v ?? 0),
    todayActions: Number(todayActionsRes?.v ?? 0),
    blockedToday: Number(blockedTodayRes?.v ?? 0),
    activeCompetitions: Number(activeCompRes?.v ?? 0),
    blockedUsers: Number(blockedUsersRes?.v ?? 0),
    usersAtDailyLimit: [...new Set(hitLimit.map((c) => c.userId))].length,
    actionBreakdown,
  });
});

// ── User Management ──

router.get("/admin/users", requireAdmin, async (req, res) => {
  const { search, leaderboardId } = req.query as any;

  let users = await db.select().from(usersTable).orderBy(asc(usersTable.name));
  if (search) {
    const q = search.toLowerCase();
    users = users.filter((u) =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }

  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) { res.json([]); return; }

  // Blocks
  const blocks = await db
    .select()
    .from(gamificationBlocksTable)
    .where(and(eq(gamificationBlocksTable.isActive, true), inArray(gamificationBlocksTable.userId, userIds)));
  const blockMap = Object.fromEntries(blocks.map((b) => [b.userId, b]));

  // Participants for a specific leaderboard
  let participantMap: Record<number, any> = {};
  if (leaderboardId) {
    const parts = await db
      .select()
      .from(leaderboardParticipantsTable)
      .where(
        and(
          eq(leaderboardParticipantsTable.leaderboardId, parseInt(leaderboardId)),
          inArray(leaderboardParticipantsTable.userId, userIds),
        )
      );
    participantMap = Object.fromEntries(parts.map((p) => [p.userId, p]));
  }

  // Total all-time points per user
  const ptRows = await db
    .select({
      userId: gamificationEventsTable.userId,
      pts: sql<number>`coalesce(sum(${gamificationEventsTable.pointsAwarded}),0)`,
    })
    .from(gamificationEventsTable)
    .where(
      and(
        eq(gamificationEventsTable.status, "valid"),
        inArray(gamificationEventsTable.userId, userIds),
      )
    )
    .groupBy(gamificationEventsTable.userId);
  const ptMap = Object.fromEntries(ptRows.map((r) => [r.userId, Number(r.pts)]));

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      tag: u.tag,
      role: u.role,
      totalPoints: ptMap[u.id] ?? 0,
      leaderboardPoints: participantMap[u.id]?.totalPoints ?? null,
      isBlocked: !!blockMap[u.id],
      block: blockMap[u.id] ?? null,
    }))
  );
});

router.post("/admin/users/:userId/block", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { userId } = req.params;
  const { reason, notes } = req.body;

  const [existing] = await db
    .select()
    .from(gamificationBlocksTable)
    .where(and(eq(gamificationBlocksTable.userId, parseInt(userId)), eq(gamificationBlocksTable.isActive, true)))
    .limit(1);
  if (existing) { res.status(400).json({ error: "Usuário já está bloqueado" }); return; }

  const [block] = await db.insert(gamificationBlocksTable).values({
    userId: parseInt(userId),
    reason: reason || "Motivo não especificado",
    blockedBy: admin.id,
    notes: notes ?? null,
  }).returning();

  await logAdminAction(admin.id, "blocked_user", {
    targetUserId: parseInt(userId),
    details: { reason, notes },
  });
  res.json(block);
});

router.post("/admin/users/:userId/unblock", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { userId } = req.params;

  await db
    .update(gamificationBlocksTable)
    .set({ isActive: false, unblockedAt: new Date(), unblockedBy: admin.id })
    .where(and(eq(gamificationBlocksTable.userId, parseInt(userId)), eq(gamificationBlocksTable.isActive, true)));

  await logAdminAction(admin.id, "unblocked_user", { targetUserId: parseInt(userId) });
  res.json({ success: true });
});

// Manual point adjustment
router.post("/admin/users/:userId/adjust", requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  const { userId } = req.params;
  const { points, reason, leaderboardId: lbId } = req.body;

  if (typeof points !== "number") { res.status(400).json({ error: "points must be a number" }); return; }

  const key = `manual_${admin.id}_${userId}_${Date.now()}`;
  const [evt] = await db.insert(gamificationEventsTable).values({
    userId: parseInt(userId),
    actionType: "manual_adjustment",
    pointsAwarded: points > 0 ? points : 0,
    pointsBlocked: 0,
    status: "manual",
    blockReason: reason ?? null,
    leaderboardId: lbId ?? null,
    idempotencyKey: key,
    metadata: { adminId: admin.id, reason },
  }).returning();

  // Update leaderboard participant if specified
  if (lbId && points !== 0) {
    await db
      .insert(leaderboardParticipantsTable)
      .values({
        leaderboardId: lbId,
        userId: parseInt(userId),
        totalPoints: points,
        totalActions: 0,
        blockedActions: 0,
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: [leaderboardParticipantsTable.leaderboardId, leaderboardParticipantsTable.userId],
        set: {
          totalPoints: sql`${leaderboardParticipantsTable.totalPoints} + ${points}`,
          lastUpdated: new Date(),
        },
      });
  }

  await logAdminAction(admin.id, "adjusted_points", {
    targetUserId: parseInt(userId),
    details: { points, reason, lbId },
    newValue: String(points),
  });

  res.json(evt);
});

// ── Events History (admin) ──

router.get("/admin/events", requireAdmin, async (req, res) => {
  const {
    userId, actionType, status, leaderboardId,
    from, to, limit = "50", offset = "0",
  } = req.query as any;

  const conditions: any[] = [];
  if (userId) conditions.push(eq(gamificationEventsTable.userId, parseInt(userId)));
  if (actionType) conditions.push(eq(gamificationEventsTable.actionType, actionType));
  if (status) conditions.push(eq(gamificationEventsTable.status, status));
  if (leaderboardId) conditions.push(eq(gamificationEventsTable.leaderboardId, parseInt(leaderboardId)));
  if (from) conditions.push(gte(gamificationEventsTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(gamificationEventsTable.createdAt, new Date(to)));

  const events = await db
    .select()
    .from(gamificationEventsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(gamificationEventsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const userIds = [...new Set(events.map((e) => e.userId))];
  const users = userIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  res.json(
    events.map((e) => ({
      ...e,
      user: e.userId in userMap ? formatUserBasic(userMap[e.userId]) : { id: e.userId, name: "Usuário" },
    }))
  );
});

// ── Admin Logs ──

router.get("/admin/logs", requireAdmin, async (req, res) => {
  const { limit = "50", offset = "0" } = req.query as any;
  const logs = await db
    .select()
    .from(adminGamificationLogsTable)
    .orderBy(desc(adminGamificationLogsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const adminIds = [...new Set(logs.map((l) => l.adminId))];
  const admins = adminIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, adminIds))
    : [];
  const adminMap = Object.fromEntries(admins.map((u) => [u.id, u]));

  res.json(
    logs.map((l) => ({
      ...l,
      admin: l.adminId in adminMap ? formatUserBasic(adminMap[l.adminId]) : { id: l.adminId, name: "Admin" },
    }))
  );
});

export default router;
