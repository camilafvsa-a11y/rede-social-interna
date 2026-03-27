import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const dmConversationsTable = pgTable("dm_conversations", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  user2Id: integer("user2_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.user1Id, t.user2Id)]);

export type DmConversation = typeof dmConversationsTable.$inferSelect;

export const dmMessagesTable = pgTable("dm_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => dmConversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

export type DmMessage = typeof dmMessagesTable.$inferSelect;
