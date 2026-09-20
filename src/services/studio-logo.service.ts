import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import {
  SettingsServiceError,
  getStudioSettings,
} from "./settings.service.js";

const logosDir = path.join(process.cwd(), "uploads", "logos");

function ensureLogosDir() {
  fs.mkdirSync(logosDir, { recursive: true });
}

function extensionFor(mimetype: string, originalName: string) {
  const fromName = path.extname(originalName).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/jpeg") return ".jpg";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/gif") return ".gif";
  return ".bin";
}

export async function uploadStudioLogo(
  studioId: number,
  file: Express.Multer.File,
) {
  if (!file?.buffer?.length) {
    throw new SettingsServiceError("Logo file is required.", 400);
  }
  if (!file.mimetype.startsWith("image/")) {
    throw new SettingsServiceError("Logo must be an image file.", 400);
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new SettingsServiceError("Logo must be 2MB or smaller.", 400);
  }

  ensureLogosDir();
  const ext = extensionFor(file.mimetype, file.originalname);
  const filename = `${studioId}-${Date.now()}${ext}`;
  const absolute = path.join(logosDir, filename);
  fs.writeFileSync(absolute, file.buffer);

  const logoUrl = `/uploads/logos/${filename}`;

  const existing = await db
    .select({ logoUrl: studios.logoUrl })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  const previous = existing[0]?.logoUrl;
  if (previous?.startsWith("/uploads/logos/")) {
    const prevPath = path.join(process.cwd(), previous.replace(/^\//, ""));
    if (fs.existsSync(prevPath)) {
      try {
        fs.unlinkSync(prevPath);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  await db.update(studios).set({ logoUrl }).where(eq(studios.id, studioId));
  return getStudioSettings(studioId);
}

export async function clearStudioLogo(studioId: number) {
  const existing = await db
    .select({ logoUrl: studios.logoUrl })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  const previous = existing[0]?.logoUrl;
  if (previous?.startsWith("/uploads/logos/")) {
    const prevPath = path.join(process.cwd(), previous.replace(/^\//, ""));
    if (fs.existsSync(prevPath)) {
      try {
        fs.unlinkSync(prevPath);
      } catch {
        // ignore
      }
    }
  }
  await db
    .update(studios)
    .set({ logoUrl: null })
    .where(eq(studios.id, studioId));
  return getStudioSettings(studioId);
}
