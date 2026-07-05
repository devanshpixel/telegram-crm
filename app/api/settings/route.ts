import { NextResponse } from "next/server";
import { getSetting, updateSetting } from "@/lib/db/service";

interface Settings {
  offerPrice: number;
  offerMessage: string;
  aiMode: "auto" | "casual" | "flirty" | "sales" | "premium";
  automatedReplies: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  offerPrice: 49,
  offerMessage:
    "Hey! You've been enjoying the chat so here's something special 🔥\n\nUnlock premium access for exclusive content, behind-the-scenes, and unlimited chat.",
  aiMode: "auto",
  automatedReplies: false,
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

const VALID_AI_MODES: Settings["aiMode"][] = ["auto", "casual", "flirty", "sales", "premium"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Settings>;

    if (body.offerPrice !== undefined) {
      if (typeof body.offerPrice !== "number" || !Number.isFinite(body.offerPrice) || body.offerPrice <= 0) {
        return NextResponse.json({ error: "offerPrice must be a positive number" }, { status: 400 });
      }
      await updateSetting("offerPrice", Math.round(body.offerPrice));
    }
    if (body.offerMessage !== undefined) {
      const msg = String(body.offerMessage).trim();
      if (!msg) {
        return NextResponse.json({ error: "offerMessage must not be empty" }, { status: 400 });
      }
      await updateSetting("offerMessage", msg);
    }
    if (body.aiMode !== undefined) {
      if (!VALID_AI_MODES.includes(body.aiMode)) {
        return NextResponse.json({ error: "aiMode is invalid" }, { status: 400 });
      }
      await updateSetting("aiMode", body.aiMode);
    }
    if (body.automatedReplies !== undefined) {
      await updateSetting("automatedReplies", Boolean(body.automatedReplies));
    }

    const updated = await getAllSettings();
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
