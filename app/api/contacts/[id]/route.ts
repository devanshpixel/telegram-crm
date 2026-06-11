import {
  deleteContact,
  getContactProfile,
  updateContact,
} from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = parseId(id);
    if (!contactId) return apiError("Invalid contact id");

    const profile = await getContactProfile(contactId);
    if (!profile) return apiError("Contact not found", 404);
    return apiOk(profile);
  } catch (e) {
    console.error(e);
    return apiError("Failed to load contact", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = parseId(id);
    if (!contactId) return apiError("Invalid contact id");

    const body = await request.json();
    const profile = await updateContact(contactId, {
      name: body.name,
      username: body.username,
      phone: body.phone,
      email: body.email,
      company: body.company,
      location: body.location,
      revenue: body.revenue,
      revenueTrend: body.revenueTrend,
      leadScore: body.leadScore,
      leadStatus: body.leadStatus,
      isOnline: body.isOnline,
      ppvCount: body.ppvCount,
    });

    if (!profile) return apiError("Contact not found", 404);
    return apiOk(profile);
  } catch (e) {
    console.error(e);
    return apiError("Failed to update contact", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = parseId(id);
    if (!contactId) return apiError("Invalid contact id");

    const deleted = await deleteContact(contactId);
    if (!deleted) return apiError("Contact not found", 404);
    return apiOk({ success: true });
  } catch (e) {
    console.error(e);
    return apiError("Failed to delete contact", 500);
  }
}
