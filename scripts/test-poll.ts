import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { pollIncomingMessages } from "../src/lib/telegram/pollMessages";

async function main() {
  console.log("Starting poll...");
  const summary = await pollIncomingMessages();
  console.log("Poll completed:", JSON.stringify(summary, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
