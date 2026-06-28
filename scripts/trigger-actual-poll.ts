import "dotenv/config";
import { pollIncomingMessages } from "../src/lib/telegram/pollMessages";
import { updateSetting } from "../lib/db/service";

async function main() {
  await updateSetting("is_polling", false);
  console.log("=== TRIGGERING ACTUAL POLL ===");
  const result = await pollIncomingMessages();
  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error("Poll crashed:", e); process.exit(1); });
