import "dotenv/config";
import { getDb } from "../lib/db";

async function main() {
  const db = await getDb();
  const r = db.prepare("SELECT COUNT(*) AS cnt FROM contacts").get() as any;
  process.stdout.write(JSON.stringify({ contacts: r }) + "\n");
}
main().catch((e) => { process.stdout.write("Error: " + e.message + "\n"); process.exit(1); });