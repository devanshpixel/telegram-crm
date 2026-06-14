import { getAnalytics } from "../lib/db/service";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  try {
    const data = await getAnalytics();
    console.log("PASS:", JSON.stringify(data, null, 2).slice(0, 100));
  } catch (e: any) {
    console.error("FAIL:", e.message);
    if (e.stack) console.error(e.stack);
  }
}

main().catch(console.error).finally(() => process.exit(0));
