import { getDb } from "../lib/db/index";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function clearLock() {
  const db = await getDb();
  await db.prepare("UPDATE settings SET value = 'false' WHERE key = 'is_polling'").run();
  console.log("Lock cleared.");
}

clearLock();