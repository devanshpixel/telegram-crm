import { getDb } from "../lib/db/index";
import fs from "fs";
import path from "path";

async function main() {
  const db = getDb();
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destFile = path.join(backupDir, `crm-backup-${timestamp}.db`);

  console.log(`Backing up to ${destFile} ...`);
  const result = await db.backup(destFile, {
    progress: ({ totalPages, remainingPages }) => {
      const done = totalPages - remainingPages;
      const pct = totalPages > 0 ? ((done / totalPages) * 100).toFixed(0) : "0";
      process.stdout.write(`\rProgress: ${pct}% (${done}/${totalPages})`);
      if (remainingPages === 0) process.stdout.write("\n");
      return -1;
    },
  });
  if (result.remainingPages === 0) {
    console.log(`Backup complete: ${destFile}`);
    console.log(`  Pages: ${result.totalPages}`);
  } else {
    console.log(`Backup finished with ${result.remainingPages} pages remaining`);
  }
}

main().catch((e) => {
  console.error("Backup failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
