import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getUserFromToken(token: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(token))).limit(1);
  return user || null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    if (user.role !== "admin" && user.role !== "master_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    tag: user.tag,
    role: user.role,
    birthDate: user.birthDate,
    admissionDate: user.admissionDate,
    onboardingCompleted: user.onboardingCompleted,
    acceptedTerms: user.acceptedTerms,
    readDocuments: user.readDocuments,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
  };
}

export function formatUserBasic(user: any) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    tag: user.tag,
    role: user.role,
  };
}
