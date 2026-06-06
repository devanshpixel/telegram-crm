import { NextResponse } from "next/server";
import { importContacts } from "@/src/lib/telegram/importContacts";

export async function POST() {
  try {
    const summary = await importContacts();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json(
      { error: message, code: "IMPORT_FAILED" },
      { status: 500 },
    );
  }
}
