import { Api, client as tgClient, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getDb, nowIso } from "@/lib/db";
import { getTelegramClient, loadSessionString } from "./client";

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
  const client = await getTelegramClient();
  if (!client.connected) {
    await client.connect();
  }
}

async function saveSessionString(sessionString: string): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const existing = await db
    .prepare("SELECT id FROM telegram_sessions LIMIT 1")
    .get() as { id: number } | undefined;

  if (existing) {
    await db.prepare(
      "UPDATE telegram_sessions SET session_string = ?, updated_at = ? WHERE id = ?",
    ).run(sessionString, ts, existing.id);
    return;
  }

  await db.prepare(
    "INSERT INTO telegram_sessions (session_string, created_at, updated_at) VALUES (?, ?, ?)",
  ).run(sessionString, ts, ts);
}

export async function sendCode(
  phone: string,
): Promise<{ isCodeViaApp: boolean }> {
  await ensureConnected();
  const client = await getTelegramClient();
  const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
    getApiCredentials(),
    phone,
  );

  const db = await getDb();
  const ts = nowIso();
  await db.prepare(
    "INSERT OR REPLACE INTO telegram_pending_codes (phone, phone_code_hash, created_at) VALUES (?, ?, ?)",
  ).run(phone, phoneCodeHash, ts);

  return { isCodeViaApp };
}

export async function verifyCode(
  phone: string,
  code: string,
): Promise<void> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT phone_code_hash FROM telegram_pending_codes WHERE phone = ?")
    .get(phone) as { phone_code_hash: string } | undefined;

  if (!row) {
    throw new Error(
      "No pending verification for this phone. Call sendCode first.",
    );
  }

  const phoneCodeHash = row.phone_code_hash;

  await ensureConnected();
  const client = await getTelegramClient();

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
    await db.prepare("DELETE FROM telegram_pending_codes WHERE phone = ?").run(phone);
  }

  const sessionString = client.session.save() as unknown as string;
  if (!sessionString) {
    throw new Error("Failed to save Telegram session after sign-in");
  }

  await saveSessionString(sessionString);
}

export async function getLoginStatus(): Promise<{
  authenticated: boolean;
  reason: string;
  account: string;
  phone: string;
}> {
  const sessionString = await loadSessionString();
  console.log("[AUTH] sessionString resolved: exists=", !!sessionString, "length=", sessionString.length);

  if (!sessionString) {
    const reason = "No session found in TELEGRAM_SESSION env var or telegram_sessions table. Run npm run telegram:login or set TELEGRAM_SESSION.";
    console.log(`[TELEGRAM] Status: unauthenticated — ${reason}`);
    return { authenticated: false, reason, account: "", phone: "" };
  }

  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  console.log("[AUTH] API creds: apiId exists=", !!apiIdRaw, "apiHash exists=", !!apiHash);
  if (!apiIdRaw || !apiHash) {
    const reason = "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH";
    console.log(`[TELEGRAM] Status: unauthenticated — ${reason}`);
    return { authenticated: false, reason, account: "", phone: "" };
  }

  console.log("[AUTH] Creating TelegramClient with StringSession, session length=" + sessionString.length);
  const client = new TelegramClient(new StringSession(sessionString), Number(apiIdRaw), apiHash, {
    connectionRetries: 1,
  });
  console.log("[AUTH] TelegramClient created");

  try {
    console.log("[AUTH] Calling client.connect()...");
    await client.connect();
    console.log("[AUTH] client.connect() completed, client.connected =", client.connected);

    if (!client.connected) {
      const reason = "Session string exists but client failed to connect";
      console.log(`[TELEGRAM] Status: unauthenticated — ${reason}`);
      return { authenticated: false, reason, account: "", phone: "" };
    }

    console.log("[AUTH] Calling client.getMe()...");
    const me = await client.getMe();
    console.log("[AUTH] getMe() returned:", me ? "object" : "null", me ? "id=" + me.id : "");
    if (!me) {
      const reason = "Session connected but getMe returned null — session may be revoked";
      console.log(`[TELEGRAM] Status: unauthenticated — ${reason}`);
      return { authenticated: false, reason, account: "", phone: "" };
    }

    const account = me.username ? `@${me.username}` : `${me.firstName || ""} ${me.lastName || ""}`.trim() || `user ${me.id}`;
    const phone = me.phone || "";
    console.log(`[TELEGRAM] Status: authenticated — account=${account} phone=${phone}`);
    return { authenticated: true, reason: "Authenticated session", account, phone };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : "";
    console.log("[AUTH] Exception caught:", msg);
    console.log("[AUTH] Stack:", stack);
    const reason = `Session validation failed: ${msg}`;
    console.log(`[TELEGRAM] Status: unauthenticated — ${reason}`);
    return { authenticated: false, reason, account: "", phone: "" };
  } finally {
    console.log("[AUTH] Disconnecting client...");
    try { await client.disconnect(); console.log("[AUTH] Client disconnected"); } catch { console.log("[AUTH] Disconnect failed (ignored)"); }
  }
}

export async function signOut(): Promise<void> {
  if (global.__telegramClient) {
    try {
      await global.__telegramClient.invoke(new Api.auth.LogOut());
    } catch {
      // Network error — still sign out locally
    }
    try {
      await global.__telegramClient.disconnect();
    } catch {
      // ignore
    }
  }
  global.__telegramClient = undefined;
  const db = await getDb();
  await db.prepare("DELETE FROM telegram_sessions").run();
}

export async function checkPassword(password: string): Promise<void> {
  await ensureConnected();
  const client = await getTelegramClient();
  const { apiId, apiHash } = getApiCredentials();
  await tgClient.auth.signInWithPassword(client, { apiId, apiHash }, {
    password: async () => password,
    onError: (err) => { throw err; },
  });
  const sessionString = client.session.save() as unknown as string;
  if (!sessionString) {
    throw new Error("Failed to save Telegram session after 2FA verification");
  }
  await saveSessionString(sessionString);
}
