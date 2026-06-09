import path from "path";
import fs from "fs";
import { getMediaById, isMediaUnlocked } from "@/lib/db/service";
import { NextResponse } from "next/server";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/tiff", "image/gif"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const mediaId = Number(id);
    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
    }

    const media = getMediaById(mediaId);
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const contactIdParam = searchParams.get("contactId");
    const contactId = contactIdParam ? Number(contactIdParam) : undefined;

    const isUnlocked = contactId && Number.isInteger(contactId) && contactId > 0
      ? isMediaUnlocked(mediaId, contactId)
      : true;

    const uploadDir = path.join(process.cwd(), "uploads", "media");

    if (!isUnlocked) {
      const ext = media.filename.split(".").pop() || "bin";
      const blurredFilename = `${media.filename}_blurred.${ext}`;
      const blurredPath = path.join(uploadDir, blurredFilename);
      if (IMAGE_MIME_TYPES.includes(media.mimeType) && fs.existsSync(blurredPath)) {
        const buffer = fs.readFileSync(blurredPath);
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": media.mimeType,
            "Content-Length": String(buffer.length),
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    const filePath = path.join(uploadDir, media.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("Preview error:", e);
    return NextResponse.json({ error: "Failed to serve preview" }, { status: 500 });
  }
}
