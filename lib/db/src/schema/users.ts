import { pgTable, serial, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userTagEnum = pgEnum("user_tag", ["marketing", "adm", "socio", "posto", "churrascaria", "gerente"]);
export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin", "master_admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  tag: userTagEnum("tag"),
  role: userRoleEnum("role").notNull().default("user"),
  birthDate: text("birth_date"),
  admissionDate: text("admission_date"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  acceptedTerms: boolean("accepted_terms").notNull().default(false),
  readDocuments: boolean("read_documents").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const allowedEmailsTable = pgTable("allowed_emails", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  tag: userTagEnum("tag"),
  role: userRoleEnum("role").notNull().default("user"),
  temporaryPassword: text("temporary_password").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type AllowedEmail = typeof allowedEmailsTable.$inferSelect;
