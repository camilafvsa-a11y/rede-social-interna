import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const UPLOADS_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MAX_SIZE = 30 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "mov", "webm", "avi",
  "pdf",
]);

router.post("/", requireAuth, async (req, res) => {
  const { base64, filename } = req.body;
  if (!base64 || !filename) {
    res.status(400).json({ error: "base64 e filename são obrigatórios" });
    return;
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXT.has(ext)) {
    res.status(400).json({ error: "Tipo de arquivo não permitido" });
    return;
  }

  let buffer: Buffer;
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    buffer = Buffer.from(raw, "base64");
  } catch {
    res.status(400).json({ error: "Base64 inválido" });
    return;
  }

  if (buffer.length > MAX_SIZE) {
    res.status(413).json({ error: "Arquivo muito grande (máx 30 MB)" });
    return;
  }

  const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = join(UPLOADS_DIR, safeName);
  writeFileSync(filePath, buffer);

  res.json({ url: `/api/uploads/${safeName}` });
});

export default router;
