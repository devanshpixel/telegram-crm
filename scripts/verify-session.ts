import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || "");

async function main() {
  console.log("Checking Telegram connection...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  try {
    await client.connect();
    const me = await client.getMe();
    console.log("SUCCESS: Connected as", me.id.toString(), (me as any).username || (me as any).firstName);
  } catch (err) {
    console.error("FAILURE: Could not connect to Telegram", err);
  } finally {
    await client.disconnect();
  }
}

main();
