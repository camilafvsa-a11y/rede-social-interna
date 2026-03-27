import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workTagsTable = pgTable("work_tags", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("#6B7280"),
  bg: text("bg").notNull().default("#F3F4F6"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkTag = typeof workTagsTable.$inferSelect;
