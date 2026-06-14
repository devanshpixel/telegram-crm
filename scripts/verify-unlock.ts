import { getDb } from "../lib/db/index";
import { isMediaUnlocked } from "../lib/db/service";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const unlocked = await isMediaUnlocked(2, 19);
  console.log("Media 2 unlocked for contact 19:", unlocked);
}

main().catch(console.error).finally(() => process.exit(0));
