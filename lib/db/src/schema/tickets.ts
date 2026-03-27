import { pgTable, serial, text, timestamp, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "closed"]);

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("open"),
  category: text("category").notNull(),
  authorId: integer("author_id").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  authorId: integer("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TicketMessage = typeof ticketMessagesTable.$inferSelect;

export const ticketHandlersTable = pgTable("ticket_handlers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.category)]);

export type TicketHandler = typeof ticketHandlersTable.$inferSelect;
