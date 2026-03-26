import { Router } from "express";
import { db, usersTable, termAcceptancesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { allowedEmailsTable } from "@workspace/db";

const router = Router();

// ─── Helper: escape CSV field ───────────────────────────────────────────────
function csvField(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: any[]): string {
  return fields.map(csvField).join(",");
}

function formatBan(bannedUntil: Date | null): string {
  if (!bannedUntil) return "";
  const d = new Date(bannedUntil);
  if (d.getFullYear() >= 9990) return "Permanente";
  return d.toLocaleDateString("pt-BR");
}

// ─── Export CSV ─────────────────────────────────────────────────────────────
router.get("/export-csv", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);

  const allAcceptances = await db.select().from(termAcceptancesTable);
  const acceptancesByUser = new Map<number, typeof allAcceptances>();
  for (const acc of allAcceptances) {
    if (!acceptancesByUser.has(acc.userId)) acceptancesByUser.set(acc.userId, []);
    acceptancesByUser.get(acc.userId)!.push(acc);
  }

  const headers = [
    "Nome", "Email", "Perfil", "Tag Principal", "Tags Extras",
    "CPF", "Data de Nascimento", "Data de Contratação",
    "Banido do App", "Banido de Postar até",
    "Assinou Termo de Imagem", "Data Assinatura Imagem",
    "Onboarding Completo", "Cadastrado em",
  ];

  const rows = users.map((u) => {
    const userAcceptances = acceptancesByUser.get(u.id) ?? [];
    const imageAcc = userAcceptances.find((a) => a.termKey === "image_voice_authorization");
    const ROLE_LABELS: Record<string, string> = {
      user: "Colaborador", moderator: "Moderador",
      admin: "Administrador", master_admin: "Master Admin",
    };

    return csvRow([
      u.name,
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      u.tag ?? "",
      (u.extraTags ?? []).join("; "),
      u.cpf ?? "",
      u.birthDate ?? "",
      u.admissionDate ?? "",
      u.appBanned ? "Sim" : "Não",
      formatBan(u.bannedUntil),
      imageAcc ? "Sim" : "Não",
      imageAcc ? new Date(imageAcc.acceptedAt).toLocaleDateString("pt-BR") : "",
      u.onboardingCompleted ? "Sim" : "Não",
      new Date(u.createdAt).toLocaleDateString("pt-BR"),
    ]);
  });

  const csv = [csvRow(headers), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="colaboradores_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + csv); // BOM for Excel compatibility
});

// ─── Import CSV ─────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim()); current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

router.post("/import-csv", requireAdmin, async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== "string") {
    res.status(400).json({ error: "CSV text required in body.csv field" });
    return;
  }

  const rows = parseCSV(csv);
  if (rows.length === 0) {
    res.status(400).json({ error: "CSV vazio ou sem dados" });
    return;
  }

  const ROLE_MAP: Record<string, string> = {
    "colaborador": "user", "usuário": "user", "usuario": "user", "user": "user",
    "moderador": "moderator", "moderator": "moderator",
    "administrador": "admin", "admin": "admin",
  };

  const TAG_MAP: Record<string, string> = {
    "posto": "posto", "churrascaria": "churrascaria",
    "marketing": "marketing", "adm": "adm", "adm.": "adm",
    "sócio": "socio", "socio": "socio",
    "gerente": "gerente",
  };

  function randPass(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const name = row["nome"] || row["name"] || "";
    const email = (row["email"] || "").toLowerCase().trim();
    const roleRaw = (row["perfil"] || row["role"] || "colaborador").toLowerCase().trim();
    const tagRaw = (row["tag principal"] || row["tag"] || "").toLowerCase().trim();
    const tempPass = row["senha temporária"] || row["senha"] || row["password"] || randPass();

    if (!name || !email) {
      results.errors.push(`Linha ignorada: nome ou email ausente (${JSON.stringify(row)})`);
      results.skipped++;
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.errors.push(`Email inválido: ${email}`);
      results.skipped++;
      continue;
    }

    const role = (ROLE_MAP[roleRaw] ?? "user") as any;
    const tag = (TAG_MAP[tagRaw] ?? null) as any;

    const [existing] = await db
      .select()
      .from(allowedEmailsTable)
      .where(eq(allowedEmailsTable.email, email))
      .limit(1);

    if (existing) {
      results.skipped++;
      continue;
    }

    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      results.skipped++;
      continue;
    }

    await db.insert(allowedEmailsTable).values({ name, email, tag, role, temporaryPassword: tempPass });
    results.created++;
  }

  res.json({
    success: true,
    created: results.created,
    skipped: results.skipped,
    errors: results.errors.slice(0, 20),
    total: rows.length,
  });
});

export default router;
