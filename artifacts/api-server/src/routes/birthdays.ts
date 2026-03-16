import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { isNotNull } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { days = "30" } = req.query as { days?: string };
  const daysNum = parseInt(days);

  const users = await db.select().from(usersTable).where(isNotNull(usersTable.birthDate));
  const today = new Date();

  const withDays = users
    .filter((u) => u.birthDate)
    .map((u) => {
      const [year, month, day] = u.birthDate!.split("-").map(Number);
      const birthThisYear = new Date(today.getFullYear(), month - 1, day);
      let daysUntil = Math.ceil((birthThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        const birthNextYear = new Date(today.getFullYear() + 1, month - 1, day);
        daysUntil = Math.ceil((birthNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return {
        id: u.id, name: u.name, avatarUrl: u.avatarUrl, tag: u.tag,
        birthDate: u.birthDate!, daysUntil,
      };
    })
    .filter((u) => u.daysUntil <= daysNum)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  res.json(withDays);
});

export default router;
