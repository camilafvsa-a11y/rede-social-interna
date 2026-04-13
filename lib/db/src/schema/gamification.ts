import { pgTable, serial, text, timestamp, boolean, integer, jsonb, date, unique } from "drizzle-orm/pg-core";

// ─── Gamification Rules ───────────────────────────────────────────────────────
// One row per action type; admin configures points, limits, cooldown, anti-spam
export const gamificationRulesTable = pgTable("gamification_rules", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull().unique(), // like | comment | doc_read | doc_sign
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  pointsPerAction: integer("points_per_action").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(10),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
  // comment-specific anti-spam
  minChars: integer("min_chars").notNull().default(0),
  blockedTerms: jsonb("blocked_terms").notNull().default([]), // string[]
  maxCommentsPerPost: integer("max_comments_per_post").notNull().default(3),
  // decreasing points config
  useDecreasingPoints: boolean("use_decreasing_points").notNull().default(false),
  decreaseValues: jsonb("decrease_values").notNull().default([]), // number[] — points for 1st, 2nd, 3rd…
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type GamificationRule = typeof gamificationRulesTable.$inferSelect;

// ─── Gamification Events ──────────────────────────────────────────────────────
// Immutable audit log of every action that was processed
export const gamificationEventsTable = pgTable("gamification_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type"), // post | comment | doc
  entityId: integer("entity_id"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  pointsBlocked: integer("points_blocked").notNull().default(0),
  status: text("status").notNull().default("valid"), // valid | blocked | cancelled | manual | error
  blockReason: text("block_reason"),
  leaderboardId: integer("leaderboard_id"),
  idempotencyKey: text("idempotency_key").unique(), // prevent double-processing
  metadata: jsonb("metadata").default({}), // extra context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GamificationEvent = typeof gamificationEventsTable.$inferSelect;

// ─── Daily Counters ───────────────────────────────────────────────────────────
// Tracks how many times a user did each action today
export const gamificationDailyCountersTable = pgTable("gamification_daily_counters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: text("action_type").notNull(),
  date: date("date").notNull(), // YYYY-MM-DD in UTC-3
  count: integer("count").notNull().default(0),
  lastActionAt: timestamp("last_action_at"),
}, (t) => [
  unique("daily_counter_unique").on(t.userId, t.actionType, t.date),
]);

export type GamificationDailyCounter = typeof gamificationDailyCountersTable.$inferSelect;

// ─── Gamification Blocks ──────────────────────────────────────────────────────
export const gamificationBlocksTable = pgTable("gamification_blocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  reason: text("reason").notNull(),
  blockedBy: integer("blocked_by").notNull(),
  blockedAt: timestamp("blocked_at").notNull().defaultNow(),
  unblockedAt: timestamp("unblocked_at"),
  unblockedBy: integer("unblocked_by"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
});

export type GamificationBlock = typeof gamificationBlocksTable.$inferSelect;

// ─── Leaderboards ─────────────────────────────────────────────────────────────
export const leaderboardsTable = pgTable("leaderboards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("draft"), // draft | active | paused | ended | archived
  validActions: jsonb("valid_actions").notNull().default([]), // string[] — which action types count
  isVisible: boolean("is_visible").notNull().default(true),
  tiebreakRule: text("tiebreak_rule").notNull().default("first_to_score"), // first_to_score | most_actions | fewest_blocked
  showsProfileAchievement: boolean("shows_profile_achievement").notNull().default(true),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Leaderboard = typeof leaderboardsTable.$inferSelect;

// ─── Leaderboard Participants ─────────────────────────────────────────────────
// Aggregated total per user per leaderboard (updated incrementally)
export const leaderboardParticipantsTable = pgTable("leaderboard_participants", {
  id: serial("id").primaryKey(),
  leaderboardId: integer("leaderboard_id").notNull(),
  userId: integer("user_id").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  totalActions: integer("total_actions").notNull().default(0),
  blockedActions: integer("blocked_actions").notNull().default(0),
  firstScoredAt: timestamp("first_scored_at"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
}, (t) => [
  unique("lb_participant_unique").on(t.leaderboardId, t.userId),
]);

export type LeaderboardParticipant = typeof leaderboardParticipantsTable.$inferSelect;

// ─── Leaderboard Results (frozen after end) ───────────────────────────────────
export const leaderboardResultsTable = pgTable("leaderboard_results", {
  id: serial("id").primaryKey(),
  leaderboardId: integer("leaderboard_id").notNull(),
  userId: integer("user_id").notNull(),
  rank: integer("rank").notNull(),
  totalPoints: integer("total_points").notNull(),
  totalActions: integer("total_actions").notNull().default(0),
  finalizedAt: timestamp("finalized_at").notNull().defaultNow(),
});

export type LeaderboardResult = typeof leaderboardResultsTable.$inferSelect;

// ─── User Profile Achievements ────────────────────────────────────────────────
// 1st/2nd/3rd place records shown on user profile
export const userProfileAchievementsTable = pgTable("user_profile_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  leaderboardId: integer("leaderboard_id").notNull(),
  rank: integer("rank").notNull(), // 1 | 2 | 3
  competitionName: text("competition_name").notNull(),
  totalPoints: integer("total_points").notNull().default(0),
  finalizedAt: timestamp("finalized_at").notNull(),
});

export type UserProfileAchievement = typeof userProfileAchievementsTable.$inferSelect;

// ─── Admin Gamification Logs ──────────────────────────────────────────────────
export const adminGamificationLogsTable = pgTable("admin_gamification_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  action: text("action").notNull(), // created_leaderboard | changed_rule | blocked_user | adjusted_points | etc.
  targetUserId: integer("target_user_id"),
  targetLeaderboardId: integer("target_leaderboard_id"),
  details: jsonb("details").default({}),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminGamificationLog = typeof adminGamificationLogsTable.$inferSelect;
