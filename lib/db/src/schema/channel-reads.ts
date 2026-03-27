import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { channelsTable } from "./channels";

export const channelReadsTable = pgTable("channel_reads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.channelId)]);

export type ChannelRead = typeof channelReadsTable.$inferSelect;
