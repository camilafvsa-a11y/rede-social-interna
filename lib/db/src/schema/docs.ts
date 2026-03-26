import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const documentReadsTable = pgTable("document_reads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  documentKey: text("document_key").notNull(),
  readAt: timestamp("read_at").notNull().defaultNow(),
});

export const docReadCompletionsTable = pgTable("doc_read_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export type DocumentRead = typeof documentReadsTable.$inferSelect;
export type DocReadCompletion = typeof docReadCompletionsTable.$inferSelect;
