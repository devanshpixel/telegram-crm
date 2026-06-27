import { NextResponse } from "next/server";
import {
  getBuyerIntelligence,
  getAllBuyerIntelligence,
  recalculateBuyerIntelligence,
} from "@/lib/db/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contactId");

    if (contactId) {
      const id = Number(contactId);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid contactId" }, { status: 400 });
      }
      await recalculateBuyerIntelligence(id);
      const data = await getBuyerIntelligence(id);
      if (!data) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    const summary = await getAllBuyerIntelligence();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Buyer intelligence failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
