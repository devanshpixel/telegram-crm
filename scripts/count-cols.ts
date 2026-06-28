import "dotenv/config";

// The columns in the INSERT
const cols = `
name, username, avatar, avatar_color, phone, email, company, location,
joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
ppv_count, telegram_id, telegram_access_hash, total_spent, vip_level,
fan_status, fan_score, last_purchase_date, emotional_temp, relationship_score,
created_at, updated_at
`.trim().split(/,\s*/);

console.log("Columns:", cols.length);
cols.forEach((c, i) => console.log(`  ${i + 1}: ${c}`));

// The VALUES string  
import { readFileSync } from "fs";
const source = readFileSync("lib/db/service.ts", "utf-8");
const m = source.match(/VALUES\s*\(([^)]+)\)/);
const valuesStr = m![1];

// Extract comma-separated items (ignore quotes)
const parts = [];
let current = "";
let inQuote = false;
for (const ch of valuesStr) {
  if (ch === "'") { inQuote = !inQuote; current += ch; }
  else if (ch === "," && !inQuote) {
    parts.push(current.trim());
    current = "";
  }
  else { current += ch; }
}
parts.push(current.trim());

console.log("\nValues:", parts.length);
let qCount = 0;
parts.forEach((p, i) => {
  const isQ = p === "?";
  if (isQ) qCount++;
  const col = cols[i] || "??? NO COLUMN";
  console.log(`  ${i + 1}: ${p} → ${col}${isQ ? " (? bind)" : ""}`);
});

console.log(`\n? count: ${qCount}`);
console.log(`Expected .run() args: 20`);
