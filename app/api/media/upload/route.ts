import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { createMedia } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

const MIME_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_EXT_MAP));

const BLURABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contactId = Number(formData.get("contactId"));
    const price = Number(formData.get("price") || 0);

    if (!Number.isInteger(contactId) || contactId <= 0) {
      return apiError("Valid contactId is required");
    }

    if (!file) {
      return apiError("File is required");
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return apiError(`Unsupported media type: ${file.type}`, 415);
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return apiError(`File exceeds maximum size of ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)}MB`, 413);
    }

    if (price < 0) {
      return apiError("Price cannot be negative");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = MIME_EXT_MAP[file.type] || "bin";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "uploads", "media");

    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    if (BLURABLE_TYPES.has(file.type)) {
      try {
        const blurredFilename = `${filename}_blurred.${ext}`;
        await sharp(buffer).blur(20).toFile(path.join(uploadDir, blurredFilename));
      } catch (blurError) {
        console.warn("Blur generation failed, continuing without preview:", blurError);
      }
    }

    const media = await createMedia({
      contactId,
      filename,
      originalName: file.name,
      mimeType: file.type,
      fileSize: buffer.length,
      price,
    });

    return apiOk(media, 201);
  } catch (e) {
    console.error("Upload error:", e);
    return apiError("Upload failed", 500);
  }
}
