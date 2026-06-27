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

    const media = await getMediaById(mediaId);
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const contactIdParam = searchParams.get("contactId");
    if (!contactIdParam) {
      return NextResponse.json({ error: "contactId query parameter is required" }, { status: 400 });
    }
    const contactId = Number(contactIdParam);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Valid contactId is required" }, { status: 400 });
    }

    if (!(await isMediaUnlocked(mediaId, contactId))) {
      return NextResponse.json({ error: "Media not unlocked" }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), "uploads", "media", media.filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const safeName = media.originalName.replace(/["\r\n]/g, "_");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (e) {
    console.error("Serve media error:", e);
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 });
  }
}
