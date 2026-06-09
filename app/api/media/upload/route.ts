import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createMedia } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contactId = Number(formData.get("contactId"));
    const price = Number(formData.get("price") || 0);

    if (!file) return apiError("File is required");
    if (!Number.isInteger(contactId) || contactId <= 0) return apiError("Valid contactId is required");
    if (price < 0) return apiError("Price cannot be negative");

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "uploads", "media");

    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    const media = createMedia({
      contactId,
      filename,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: buffer.length,
      price,
    });

    return apiOk(media, 201);
  } catch (e) {
    console.error("Upload error:", e);
    return apiError("Upload failed", 500);
  }
}
