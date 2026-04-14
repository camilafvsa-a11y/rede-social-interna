import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  icon: text("icon"),
  priority: text("priority").notNull().default("medium"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  routePath: text("route_path"),
  data: text("data"),
  read: boolean("read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PushToken = typeof pushTokensTable.$inferSelect;
