import { getDb } from "../lib/db/index";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const db = await getDb();
  try {
    console.log("Adding 'trigger' to broadcasts...");
    await db.exec("ALTER TABLE broadcasts ADD COLUMN trigger TEXT");
    console.log("PASS");
  } catch (e: any) {
    console.error("FAIL:", e.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
