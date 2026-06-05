import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

declare global {
  var __telegramClient: TelegramClient | undefined;
}

function createClient(): TelegramClient {
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

  return new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export function getTelegramClient(): TelegramClient {
  if (!global.__telegramClient) {
    global.__telegramClient = createClient();
  }
  return global.__telegramClient;
}
