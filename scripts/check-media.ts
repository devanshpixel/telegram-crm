import { getDb } from "../lib/db/index";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const db = await getDb();
  const media = await db.prepare("SELECT id, contact_id FROM media").all();
  console.log("Media:", media);
}

main().catch(console.error).finally(() => process.exit(0));
