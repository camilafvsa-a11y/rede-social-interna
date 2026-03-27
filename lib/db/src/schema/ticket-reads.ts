import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ticketsTable } from "./tickets";

export const ticketReadsTable = pgTable("ticket_reads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.ticketId)]);

export type TicketRead = typeof ticketReadsTable.$inferSelect;
