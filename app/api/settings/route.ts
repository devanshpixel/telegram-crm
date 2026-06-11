import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { nowIso } from "@/lib/db";

interface Settings {
  offerPrice: number;
  offerMessage: string;
  aiMode: "auto" | "casual" | "flirty" | "sales" | "premium";
  automatedReplies: boolean;
}

function getDefaultSettings(): Settings {
  return {
    offerPrice: parseInt(process.env.OFFER_PRICE || "499", 10),
    offerMessage:
      "Hey! You've been enjoying the chat so here's something special 🔥\n\nUnlock premium access for exclusive content, behind-the-scenes, and unlimited chat.",
    aiMode: "auto",
    automatedReplies: true,
  };
}

function getSettingsPath(): string {
  return path.join(process.cwd(), "data", "settings.json");
}

function readSettings(): Settings {
  const filePath = getSettingsPath();
  if (!existsSync(filePath)) {
    return getDefaultSettings();
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Settings;
  } catch {
    return getDefaultSettings();
  }
}

function writeSettings(s: Settings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Settings>;
    const current = readSettings();
    const updated: Settings = {
      offerPrice: body.offerPrice ?? current.offerPrice,
      offerMessage: body.offerMessage ?? current.offerMessage,
      aiMode: body.aiMode ?? current.aiMode,
      automatedReplies: body.automatedReplies ?? current.automatedReplies,
    };
    writeSettings(updated);
    const db = await getDb();
    if (body.offerPrice) {
      const ts = nowIso();
      await db
        .prepare("INSERT INTO purchases (contact_id, amount, note, kind, purchase_date, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(0, body.offerPrice, "price_update", "config", ts, ts);
    }
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
