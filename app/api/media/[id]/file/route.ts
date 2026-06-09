import path from "path";
import fs from "fs";
import { getMediaById } from "@/lib/db/service";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
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
