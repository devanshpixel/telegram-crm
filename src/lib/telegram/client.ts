import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getDb } from "@/lib/db";

declare global {
  var __telegramClient: TelegramClient | undefined;
}

export async function loadSessionString(): Promise<string> {
  const envSession = process.env.TELEGRAM_SESSION;
  if (envSession && envSession.trim().length > 0) {
    console.log("[TELEGRAM] Using TELEGRAM_SESSION from environment");
    return envSession.trim();
  }
  const db = await getDb();
  const row = await db
    .prepare("SELECT session_string FROM telegram_sessions LIMIT 1")
    .get() as { session_string: string } | undefined;
  if (row?.session_string) {
    console.log("[TELEGRAM] Using session from telegram_sessions table");
    return row.session_string;
  }
  console.log("[TELEGRAM] No session found (env empty, table empty)");
  return "";
}

async function createClient(): Promise<TelegramClient> {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;

  if (!apiIdRaw || !apiHash) {
    throw new Error(
      "Missing Telegram credentials: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in the environment",
    );
  }

  const apiId = Number(apiIdRaw);
  if (Number.isNaN(apiId)) {
    throw new Error("Invalid TELEGRAM_API_ID: must be a numeric value");
  }

  const sessionString = await loadSessionString();
  return new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export async function getTelegramClient(): Promise<TelegramClient> {
  if (!global.__telegramClient) {
    global.__telegramClient = await createClient();
  }
  return global.__telegramClient;
}
