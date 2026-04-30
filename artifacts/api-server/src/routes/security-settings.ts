import { Router } from "express";
import { db, securitySettingsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth.js";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  default_password: "Beija2024",
  min_password_length: "6",
  require_number: "false",
  require_letter: "false",
  force_reset_on_first_login: "true",
};

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(securitySettingsTable);
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// Password policy for authenticated users (onboarding) — excludes default_password
router.get("/password-policy", requireAuth, async (_req, res) => {
  const settings = await getSettings();
  const { default_password, ...policy } = settings;
  res.json(policy);
});

// Full settings — admin only
router.get("/", requireAdmin, async (_req, res) => {
  res.json(await getSettings());
});

router.patch("/", requireAdmin, async (req, res) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(securitySettingsTable)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: securitySettingsTable.key, set: { value: String(value) } });
  }
  res.json(await getSettings());
});

export default router;
