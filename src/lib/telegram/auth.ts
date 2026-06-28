import { Api, client as tgClient, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getDb, nowIso } from "@/lib/db";
import { loadSessionString } from "./client";

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

/**
 * Always-fresh, unauthenticated client for login flows.
 * NEVER reuses the production singleton — doing so causes AUTH_KEY_DUPLICATED.
 */
async function createFreshAuthClient(): Promise<TelegramClient> {
  const { apiId, apiHash } = getApiCredentials();
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    requestRetries: 2,
    timeout: 30,
  });
  await client.connect();
  return client;
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
  // Always create a fresh, empty-session client.
  // Using the production authenticated singleton causes AUTH_KEY_DUPLICATED.
  const client = await createFreshAuthClient();
  try {
    const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
      getApiCredentials(),
      phone,
    );

    // Save temp session alongside hash — phoneCodeHash is bound to the auth key
    // that requested it. verifyCode MUST use the same session, not a new one.
    const tempSession = client.session.save() as unknown as string;

    const db = await getDb();
    await db.prepare(
      "INSERT OR REPLACE INTO telegram_pending_codes (phone, phone_code_hash, temp_session, created_at) VALUES (?, ?, ?, ?)",
    ).run(phone, phoneCodeHash, tempSession, nowIso());

    return { isCodeViaApp };
  } finally {
    // Disconnect after saving session — the auth key is persisted in temp_session.
    try { await client.disconnect(); } catch { /* ignore */ }
  }
}

export async function verifyCode(
  phone: string,
  code: string,
): Promise<void> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT phone_code_hash, temp_session FROM telegram_pending_codes WHERE phone = ?")
    .get(phone) as { phone_code_hash: string; temp_session: string | null } | undefined;

  if (!row) {
    throw new Error(
      "No pending verification for this phone. Call sendCode first.",
    );
  }

  const { phone_code_hash: phoneCodeHash, temp_session: tempSession } = row;

  const { apiId, apiHash } = getApiCredentials();

  // MUST reuse the same session that called sendCode — phoneCodeHash is auth-key-bound.
  const session = new StringSession(tempSession ?? "");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    requestRetries: 2,
    timeout: 30,
  });
  await client.connect();

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

    // Save session before disconnect
    const sessionString = client.session.save() as unknown as string;
    if (!sessionString) {
      throw new Error("Failed to save Telegram session after sign-in");
    }

    await saveSessionString(sessionString);

    // Reset production singleton so next poll reloads the new session
    if (global.__telegramClient) {
      try { await global.__telegramClient.disconnect(); } catch { /* ignore */ }
      global.__telegramClient = undefined;
      global.__activeSessionString = undefined;
    }
  } catch (err: unknown) {
    const error = err as { errorMessage?: string };
    if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
      throw new Error("Two-factor authentication is enabled on this account");
    }
    throw err;
  } finally {
    await db.prepare("DELETE FROM telegram_pending_codes WHERE phone = ?").run(phone);
    try { await client.disconnect(); } catch { /* ignore */ }
  }
}

export async function getLoginStatus(): Promise<{
  authenticated: boolean;
  reason: string;
  account: string;
  phone: string;
}> {
  const sessionString = await loadSessionString();

  if (!sessionString) {
    const reason = "No session found in TELEGRAM_SESSION env var or telegram_sessions table. Run npm run telegram:login or set TELEGRAM_SESSION.";
    return { authenticated: false, reason, account: "", phone: "" };
  }

  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!apiIdRaw || !apiHash) {
    const reason = "Missing TELEGRAM_API_ID or TELEGRAM_API_HASH";
    return { authenticated: false, reason, account: "", phone: "" };
  }

  const client = new TelegramClient(new StringSession(sessionString), Number(apiIdRaw), apiHash, {
    connectionRetries: 1,
  });

  try {
    await client.connect();

    if (!client.connected) {
      const reason = "Session string exists but client failed to connect";
      return { authenticated: false, reason, account: "", phone: "" };
    }

    const me = await client.getMe();
    if (!me) {
      const reason = "Session connected but getMe returned null — session may be revoked";
      return { authenticated: false, reason, account: "", phone: "" };
    }

    const account = me.username ? `@${me.username}` : `${me.firstName || ""} ${me.lastName || ""}`.trim() || `user ${me.id}`;
    const phone = me.phone || "";
    return { authenticated: true, reason: "Authenticated session", account, phone };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const reason = `Session validation failed: ${msg}`;
    return { authenticated: false, reason, account: "", phone: "" };
  } finally {
    try { await client.disconnect(); } catch { /* ignore */ }
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
  global.__activeSessionString = undefined;
  const db = await getDb();
  await db.prepare("DELETE FROM telegram_sessions").run();
}

export async function checkPassword(password: string): Promise<void> {
  // Fresh client for 2FA — avoids reusing any stale auth state
  const client = await createFreshAuthClient();
  const { apiId, apiHash } = getApiCredentials();
  try {
    await tgClient.auth.signInWithPassword(client, { apiId, apiHash }, {
      password: async () => password,
      onError: (err) => { throw err; },
    });

    const sessionString = client.session.save() as unknown as string;
    if (!sessionString) {
      throw new Error("Failed to save Telegram session after 2FA verification");
    }

    await saveSessionString(sessionString);

    // Reset production singleton so next poll reloads the new session
    if (global.__telegramClient) {
      try { await global.__telegramClient.disconnect(); } catch { /* ignore */ }
      global.__telegramClient = undefined;
      global.__activeSessionString = undefined;
    }
  } finally {
    try { await client.disconnect(); } catch { /* ignore */ }
  }
}
