import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const termAcceptancesTable = pgTable("term_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  termKey: text("term_key").notNull(),
  termTitle: text("term_title").notNull(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
});

export type TermAcceptance = typeof termAcceptancesTable.$inferSelect;
