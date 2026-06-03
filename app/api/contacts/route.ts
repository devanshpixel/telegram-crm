import { createContact, listChats } from "@/lib/db/service";
import { apiError, apiOk } from "@/lib/api-error";

export async function GET() {
  try {
    return apiOk(listChats());
  } catch (e) {
    console.error(e);
    return apiError("Failed to load contacts", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name?.trim() || !body.username?.trim()) {
      return apiError("Name and username are required");
    }
    const profile = createContact({
      name: body.name.trim(),
      username: body.username.trim(),
      phone: body.phone,
      email: body.email,
      company: body.company,
      location: body.location,
      revenue: body.revenue,
      isOnline: body.isOnline,
    });
    return apiOk(profile, 201);
  } catch (e) {
    console.error(e);
    return apiError("Failed to create contact", 500);
  }
}
