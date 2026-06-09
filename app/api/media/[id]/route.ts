import { getMediaById, deleteMedia } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const mediaId = Number(id);
    if (!Number.isInteger(mediaId) || mediaId <= 0) return apiError("Invalid media id");

    const media = getMediaById(mediaId);
    if (!media) return apiError("Media not found", 404);

    return apiOk(media);
  } catch (e) {
    console.error("Get media error:", e);
    return apiError("Failed to get media", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const mediaId = Number(id);
    if (!Number.isInteger(mediaId) || mediaId <= 0) return apiError("Invalid media id");

    const deleted = deleteMedia(mediaId);
    if (!deleted) return apiError("Media not found", 404);

    return apiOk({ success: true });
  } catch (e) {
    console.error("Delete media error:", e);
    return apiError("Failed to delete media", 500);
  }
}
