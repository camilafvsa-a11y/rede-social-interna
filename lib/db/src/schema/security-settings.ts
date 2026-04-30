import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const securitySettingsTable = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export type SecuritySetting = typeof securitySettingsTable.$inferSelect;
