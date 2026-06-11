import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";
console.log("API_ID =", process.env.TELEGRAM_API_ID);
console.log("API_HASH =", process.env.TELEGRAM_API_HASH?.slice(0, 5));
async function main() {
  const client = new TelegramClient(
    new StringSession(""),
    apiId,
    apiHash,
    {
      connectionRetries: 5,
    }
  );

  await client.start({
    phoneNumber: async () =>
      await input.text("Phone Number (+91xxxxxxxxxx): "),
    password: async () =>
      await input.text("2FA Password (if enabled): "),
    phoneCode: async () =>
      await input.text("Telegram OTP Code: "),
    onError: (err) => console.log(err),
  });

  console.log("\n=== SESSION STRING ===\n");
  console.log(client.session.save());
}

main();