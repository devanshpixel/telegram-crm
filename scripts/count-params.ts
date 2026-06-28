import "dotenv/config";

const sql = `INSERT INTO contacts (
  name, username, avatar, avatar_color, phone, email, company, location,
  joined_at, revenue, revenue_trend, lead_score, lead_status, is_online,
  ppv_count, telegram_id, telegram_access_hash, total_spent, vip_level,
  fan_status, fan_score, last_purchase_date, emotional_temp, relationship_score,
  created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'flat', 50, 'warm', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 50, 0, ?, ?)`;

const qmarks = sql.match(/\?/g);
console.log("Number of ? placeholders:", qmarks?.length ?? 0);
console.log("SQL length:", sql.length);

// Extract VALUES portion
const valuesMatch = sql.match(/VALUES\s*\((.*)\)\s*$/s);
if (valuesMatch) {
  const valuesStr = valuesMatch[1];
  // Split by comma, but not inside quotes
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of valuesStr) {
    if (ch === "'") depth = depth === 0 ? 1 : 0;
    else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  console.log("Number of VALUES:", parts.length);
  parts.forEach((p, i) => console.log(`  ${i + 1}: ${p}`));
}

// Column list count
const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
if (colMatch) {
  const cols = colMatch[1].split(",").map((s: string) => s.trim());
  console.log("Number of columns:", cols.length);
}
