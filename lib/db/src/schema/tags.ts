import { pgTable, serial, text, boolean, integer, pgEnum } from "drizzle-orm/pg-core";

export const tagTypeEnum = pgEnum("tag_type", ["unidade", "setor", "cargo"]);

export const tagsTable = pgTable("tags", {
  id: serial("id").primaryKey(),
  tipo: tagTypeEnum("tipo").notNull(),
  nome: text("nome").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export type Tag = typeof tagsTable.$inferSelect;
export type InsertTag = typeof tagsTable.$inferInsert;
