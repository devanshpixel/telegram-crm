import path from "path";
import fs from "fs";
import { getMediaById, isMediaUnlocked } from "@/lib/db/service";
import { NextResponse } from "next/server";

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

    if (!isUnlocked) {
      return NextResponse.json({ error: "Media not unlocked" }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), "uploads", "media", media.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${media.originalName}"`,
      },
    });
  } catch (e) {
    console.error("Serve media error:", e);
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 });
  }
}
