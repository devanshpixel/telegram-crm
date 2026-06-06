import { Api } from "telegram";
import { getDb, nowIso } from "@/lib/db";
import { getTelegramClient } from "./client";

const pendingCodes = new Map<string, string>();

function getApiCredentials(): { apiId: number; apiHash: string } {
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

  return { apiId, apiHash };
}

async function ensureConnected(): Promise<void> {
  const client = getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

function saveSessionString(sessionString: string): void {
  const db = getDb();
  const ts = nowIso();
  const existing = db
    .prepare("SELECT id FROM telegram_sessions LIMIT 1")
    .get() as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE telegram_sessions SET session_string = ?, updated_at = ? WHERE id = ?",
    ).run(sessionString, ts, existing.id);
    return;
  }

  db.prepare(
    "INSERT INTO telegram_sessions (session_string, created_at, updated_at) VALUES (?, ?, ?)",
  ).run(sessionString, ts, ts);
}

export async function sendCode(
  phone: string,
): Promise<{ isCodeViaApp: boolean }> {
  await ensureConnected();
  const client = getTelegramClient();
  const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
    getApiCredentials(),
    phone,
  );
  pendingCodes.set(phone, phoneCodeHash);
  return { isCodeViaApp };
}

export async function verifyCode(
  phone: string,
  code: string,
): Promise<void> {
  const phoneCodeHash = pendingCodes.get(phone);
  if (!phoneCodeHash) {
    throw new Error(
      "No pending verification for this phone. Call sendCode first.",
    );
  }

  await ensureConnected();
  const client = getTelegramClient();

  try {
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      }),
    );

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error("Telegram account registration is required for this number");
    }
  } catch (err: unknown) {
    const error = err as { errorMessage?: string };
    if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
      throw new Error("Two-factor authentication is enabled on this account");
    }
    throw err;
  } finally {
    pendingCodes.delete(phone);
  }

  const sessionString = client.session.save() as unknown as string;
  if (!sessionString) {
    throw new Error("Failed to save Telegram session after sign-in");
  }

  saveSessionString(sessionString);
}
