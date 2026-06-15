import { NextResponse } from "next/server";
import { getSetting, updateSetting } from "@/lib/db/service";
import { getDb, nowIso } from "@/lib/db";

interface Settings {
  offerPrice: number;
  offerMessage: string;
  aiMode: "auto" | "casual" | "flirty" | "sales" | "premium";
  automatedReplies: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  offerPrice: 499,
  offerMessage:
    "Hey! You've been enjoying the chat so here's something special 🔥\n\nUnlock premium access for exclusive content, behind-the-scenes, and unlimited chat.",
  aiMode: "auto",
  automatedReplies: true,
};

async function getAllSettings(): Promise<Settings> {
  const [offerPrice, offerMessage, aiMode, automatedReplies] = await Promise.all([
    getSetting("offerPrice", DEFAULT_SETTINGS.offerPrice),
    getSetting("offerMessage", DEFAULT_SETTINGS.offerMessage),
    getSetting("aiMode", DEFAULT_SETTINGS.aiMode),
    getSetting("automatedReplies", DEFAULT_SETTINGS.automatedReplies),
  ]);

  return {
    offerPrice,
    offerMessage,
    aiMode,
    automatedReplies,
  };
}

export async function GET() {
  return NextResponse.json(await getAllSettings());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Settings>;
    
    if (body.offerPrice !== undefined) await updateSetting("offerPrice", body.offerPrice);
    if (body.offerMessage !== undefined) await updateSetting("offerMessage", body.offerMessage);
    if (body.aiMode !== undefined) await updateSetting("aiMode", body.aiMode);
    if (body.automatedReplies !== undefined) await updateSetting("automatedReplies", body.automatedReplies);

    const updated = await getAllSettings();
    
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
