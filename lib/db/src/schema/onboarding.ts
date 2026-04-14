import { pgTable, serial, text, timestamp, integer, boolean, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const onboardingStepsTable = pgTable("onboarding_steps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  step: varchar("step", { length: 50 }).notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const companyValuesConfirmationsTable = pgTable("company_values_confirmations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  confirmedAt: timestamp("confirmed_at").notNull().defaultNow(),
  context: varchar("context", { length: 20 }).notNull().default("onboarding"),
});

export const imageTermChoicesTable = pgTable("image_term_choices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accepted: boolean("accepted").notNull(),
  decidedAt: timestamp("decided_at").notNull().defaultNow(),
  context: varchar("context", { length: 20 }).notNull().default("onboarding"),
});

export const documentSignaturesTable = pgTable("document_signatures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  docKey: text("doc_key").notNull(),
  docTitle: text("doc_title").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  context: varchar("context", { length: 20 }).notNull().default("integra"),
  confirmationTextUsed: text("confirmation_text_used"),
  accepted: boolean("accepted").notNull().default(true),
});

export type OnboardingStep = typeof onboardingStepsTable.$inferSelect;
export type CompanyValuesConfirmation = typeof companyValuesConfirmationsTable.$inferSelect;
export type ImageTermChoice = typeof imageTermChoicesTable.$inferSelect;
export type DocumentSignature = typeof documentSignaturesTable.$inferSelect;
