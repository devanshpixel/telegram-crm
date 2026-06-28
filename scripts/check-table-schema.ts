import "dotenv/config";
import { getDb } from "../lib/db";

async function main() {
  const db = await getDb();
  const info = db.prepare("PRAGMA table_info(contacts)").all() as { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[];
  console.log("Contacts columns (" + info.length + "):");
  for (const col of info) {
    console.log(`  ${col.cid}: ${col.name} (${col.type}) default=${col.dflt_value} notnull=${col.notnull}`);
  }
}
main().catch((e) => console.error(e));
