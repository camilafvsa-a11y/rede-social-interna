import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  allowedTags: text("allowed_tags").notNull().default("[]"),
  isInternalComm: boolean("is_internal_comm").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channelsTable).omit({ id: true, createdAt: true });
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;

export const channelAllowedPostersTable = pgTable("channel_allowed_posters", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type ChannelAllowedPoster = typeof channelAllowedPostersTable.$inferSelect;
