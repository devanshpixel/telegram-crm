import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/src/lib/telegram/sendMessage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contactId = Number(body.contactId);
    const text = String(body.text ?? "").trim();
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }
    const result = await sendTelegramMessage(contactId, text);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message, code: "SEND_FAILED" }, { status: 500 });
  }
}
