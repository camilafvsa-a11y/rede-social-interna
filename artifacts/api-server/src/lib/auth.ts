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
  if (user.appBanned) {
    res.status(403).json({ error: "Sua conta foi banida. Entre em contato com o administrador." });
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

export function isBannedFromPosting(user: any): boolean {
  if (!user.bannedUntil) return false;
  return new Date(user.bannedUntil) > new Date();
}

export function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    tag: user.tag,
    extraTags: user.extraTags ?? [],
    workTags: user.workTags ?? [],
    role: user.role,
    cpf: user.cpf,
    phone: user.phone,
    birthDate: user.birthDate,
    admissionDate: user.admissionDate,
    sector: user.sector,
    unit: user.unit,
    position: user.position,
    hasKids: user.hasKids ?? null,
    kidsCount: user.kidsCount ?? null,
    imageTermAccepted: user.imageTermAccepted ?? null,
    bannedUntil: user.bannedUntil?.toISOString?.() ?? user.bannedUntil ?? null,
    appBanned: user.appBanned ?? false,
    onboardingCompleted: user.onboardingCompleted,
    needsPasswordReset: user.needsPasswordReset ?? false,
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
