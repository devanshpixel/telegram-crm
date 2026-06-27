import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { getDb } from "@/lib/db";
import { LogLevel } from "telegram/extensions/Logger";

declare global {
  var __telegramClient: TelegramClient | undefined;
  var __activeSessionString: string | undefined;
}

export async function loadSessionString(): Promise<string> {
  // Prioritize DB session (the one created by the dashboard login flow).
  const db = await getDb();
  const row = await db
    .prepare("SELECT session_string FROM telegram_sessions LIMIT 1")
    .get() as { session_string: string } | undefined;
  if (row?.session_string) {
    return row.session_string;
  }

  const envSession = process.env.TELEGRAM_SESSION;
  if (envSession && envSession.trim().length > 0) {
    return envSession.trim();
  }

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

  const proxyHost = process.env.TELEGRAM_PROXY_HOST;
  const proxyPort = process.env.TELEGRAM_PROXY_PORT ? Number(process.env.TELEGRAM_PROXY_PORT) : undefined;
  const proxyType = process.env.TELEGRAM_PROXY_TYPE || "socks5"; // socks5, mtproxy, http
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let proxyOptions: any = undefined;
  if (proxyHost && proxyPort) {
    console.log(`[TELEGRAM] Using ${proxyType} proxy: ${proxyHost}:${proxyPort}`);
    if (proxyType === "mtproxy") {
      proxyOptions = {
        MTProxy: true,
        server: proxyHost,
        port: proxyPort,
        secret: process.env.TELEGRAM_PROXY_SECRET,
      };
    } else {
      proxyOptions = {
        ip: proxyHost,
        port: proxyPort,
        socksType: proxyType === "socks5" ? 5 : undefined,
        username: process.env.TELEGRAM_PROXY_USER,
        password: process.env.TELEGRAM_PROXY_PASS,
        timeout: 10,
      };
    }
  }

  console.log(`[TELEGRAM] Creating client (apiId=${apiId})`);
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 10,
    requestRetries: 2,
    timeout: 30,
    proxy: proxyOptions,
    useWSS: process.env.TELEGRAM_USE_WSS !== "false", // Default to true
  });

  client.setLogLevel(LogLevel.INFO); 
  
  return client;
}

export async function getTelegramClient(): Promise<TelegramClient> {
  // ── 1. Load session ──────────────────────────────────────────────────────
  const sessionString = await loadSessionString();
  console.log(
    `[TELEGRAM] Session loaded: ${sessionString ? `${sessionString.slice(0, 12)}… (${sessionString.length} chars)` : "EMPTY — no session"}`,
  );

  // ── 2. Reuse or recreate singleton ───────────────────────────────────────
  if (global.__telegramClient) {
    if (global.__activeSessionString === sessionString) {
      const existing = global.__telegramClient;
      if (existing.connected) {
        console.log("[TELEGRAM] Reusing existing connected client");
        return existing;
      }
      // Socket dropped — reconnect in place below
      console.log("[TELEGRAM] Singleton exists but socket dropped, reconnecting");
    } else {
      console.log("[TELEGRAM] Session changed, tearing down old client");
      try { await global.__telegramClient.disconnect(); } catch { /* ignore */ }
      global.__telegramClient = undefined;
    }
  }

  // ── 3. Create client if needed ───────────────────────────────────────────
  if (!global.__telegramClient) {
    global.__activeSessionString = sessionString;
    global.__telegramClient = await createClient(sessionString);
    console.log("[TELEGRAM] Client instance created");
  }

  const client = global.__telegramClient;

  // ── 4. Connect ───────────────────────────────────────────────────────────
  if (!client.connected) {
    console.log("[TELEGRAM] Calling connect()…");
    try {
      await client.connect();
      console.log(`[TELEGRAM] connect() resolved — connected=${client.connected}`);
    } catch (err) {
      console.error("[TELEGRAM] connect() threw:", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  // ── 5. Authorization check ───────────────────────────────────────────────
  try {
    const authorized = await client.isUserAuthorized();
    console.log(`[TELEGRAM] isUserAuthorized=${authorized}`);

    if (authorized) {
      // ── 6. Self user id ────────────────────────────────────────────────
      try {
        const me = await client.getMe();
        // ── 7. DC id ───────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dcId: number | undefined = (client as any)._sender?.dcId ?? (client as any).session?.dcId;
        console.log(
          `[TELEGRAM] Authenticated as userId=${me?.id} username=${me?.username ?? "—"} DC=${dcId ?? "unknown"}`,
        );
      } catch (meErr) {
        console.warn("[TELEGRAM] getMe() failed (non-fatal):", meErr instanceof Error ? meErr.message : String(meErr));
      }
    } else {
      console.warn("[TELEGRAM] Client connected but NOT authorized — session may be invalid or empty");
    }
  } catch (authErr) {
    // ── 8. Exception ────────────────────────────────────────────────────
    console.warn("[TELEGRAM] isUserAuthorized() failed:", authErr instanceof Error ? authErr.message : String(authErr));
  }

  return client;
}
