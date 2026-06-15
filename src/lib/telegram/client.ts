import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getDb } from "@/lib/db";

declare global {
  var __telegramClient: TelegramClient | undefined;
  var __activeSessionString: string | undefined;
}

export async function loadSessionString(): Promise<string> {
  // Task: Prioritize DB session as it's the one created by the dashboard login
  const db = await getDb();
  const row = await db
    .prepare("SELECT session_string FROM telegram_sessions LIMIT 1")
    .get() as { session_string: string } | undefined;
  if (row?.session_string) {
    console.log("[TELEGRAM] Using session from telegram_sessions table, length=" + row.session_string.length);
    return row.session_string;
  }

  const envSession = process.env.TELEGRAM_SESSION;
  if (envSession && envSession.trim().length > 0) {
    console.log("[TELEGRAM] Using TELEGRAM_SESSION from environment, length=" + envSession.trim().length);
    return envSession.trim();
  }
  
  console.log("[TELEGRAM] No session found (env empty, table empty)");
  return "";
}

async function createClient(sessionString: string): Promise<TelegramClient> {
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

  return new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export async function getTelegramClient(): Promise<TelegramClient> {
  const sessionString = await loadSessionString();
  
  if (global.__telegramClient) {
    if (global.__activeSessionString === sessionString) {
      return global.__telegramClient;
    }
    console.log("[TELEGRAM] Session changed, recreating client");
    try {
      await global.__telegramClient.disconnect();
    } catch {
      // ignore
    }
  }

  global.__activeSessionString = sessionString;
  global.__telegramClient = await createClient(sessionString);
  return global.__telegramClient;
}
