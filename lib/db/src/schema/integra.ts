import { pgTable, serial, text, timestamp, integer, boolean, varchar } from "drizzle-orm/pg-core";

export const integraItemsTable = pgTable("integra_items", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),
  sectionName: varchar("section_name", { length: 100 }),
  sectionIcon: varchar("section_icon", { length: 50 }),
  sectionColor: varchar("section_color", { length: 20 }),
  sectionColorBg: varchar("section_color_bg", { length: 20 }),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: text("subtitle"),
  content: text("content"),
  pdfUrl: text("pdf_url"),
  requiresSign: boolean("requires_sign").notNull().default(false),
  requiresRead: boolean("requires_read").notNull().default(true),
  docKey: varchar("doc_key", { length: 100 }).notNull().unique(),
  iconName: varchar("icon_name", { length: 50 }).default("file-text"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IntegraItem = typeof integraItemsTable.$inferSelect;
export type NewIntegraItem = typeof integraItemsTable.$inferInsert;
