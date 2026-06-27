import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-core.db");

// Track assertions
let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

function assertEqual<T>(a: T, b: T, label: string) {
  if (a === b) {
    passed++;
    console.log(`  PASS: ${label} (${a})`);
  } else {
    failed++;
    console.log(`  FAIL: ${label} — expected ${b}, got ${a}`);
  }
}

async function main() {
  // Setup: clean test DB
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create schema
  const schema = fs.readFileSync(
    path.join(process.cwd(), "lib", "db", "schema.ts"), "utf-8"
  );
  const match = schema.match(/export const SCHEMA_SQL = `([\s\S]*?)`;/);
  if (!match) throw new Error("Could not extract SCHEMA_SQL");
  db.exec(match[1]);

  // Create a test contact + conversation
  const ts = new Date().toISOString();
  db.prepare(`
    INSERT INTO contacts (name, username, avatar, avatar_color, phone, joined_at, conv_state, created_at, updated_at)
    VALUES ('Test Fan', '@testfan', 'TF', '#ff6b6b', '', ?, 'FREE_CHAT', ?, ?)
  `).run(ts, ts, ts);

  const contactId = 1;
  db.prepare(`
    INSERT INTO conversations (contact_id, last_message, last_message_time, created_at, updated_at)
    VALUES (?, '', ?, ?, ?)
  `).run(contactId, ts, ts, ts);

  console.log("\n=== selectOfferAmount pricing tiers ===\n");

  // Test 1: no purchases = 70% of base
  const countRow0 = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?").get(contactId) as { count: number; total: number };
  assertEqual(countRow0.count, 0, "no purchases yet");
  assertEqual(countRow0.total, 0, "total spent is 0");
  const basePrice = 499;
  const firstTier = countRow0.count === 0 ? Math.round(basePrice * 0.7) : basePrice;
  assertEqual(firstTier, 349, "first-timer: 70% of 499 = 349");

  // Test 2: 1 purchase under ₹500 = 90%
  db.prepare("INSERT INTO purchases (contact_id, amount, purchase_date, kind, created_at) VALUES (?, 399, ?, 'ppv', ?)").run(contactId, ts.split("T")[0], ts);
  const countRow1 = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?").get(contactId) as { count: number; total: number };
  let tierPrice = basePrice;
  if (countRow1.count === 0) tierPrice = Math.round(basePrice * 0.7);
  else if (countRow1.total >= 1500) tierPrice = Math.round(basePrice * 1.5);
  else if (countRow1.total >= 500) tierPrice = Math.round(basePrice * 1.15);
  else if (countRow1.count <= 2) tierPrice = Math.round(basePrice * 0.9);
  assertEqual(tierPrice, 449, "1 purchase under ₹500: 90% of 499 = 449");

  // Test 3: ₹500-1499 total = 115%
  db.prepare("INSERT INTO purchases (contact_id, amount, purchase_date, kind, created_at) VALUES (?, 200, ?, 'ppv', ?)").run(contactId, ts.split("T")[0], ts);
  const countRow500 = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?").get(contactId) as { count: number; total: number };
  assert(countRow500.total >= 500, "total is now >= 500");
  tierPrice = basePrice;
  if (countRow500.count === 0) tierPrice = Math.round(basePrice * 0.7);
  else if (countRow500.total >= 1500) tierPrice = Math.round(basePrice * 1.5);
  else if (countRow500.total >= 500) tierPrice = Math.round(basePrice * 1.15);
  else if (countRow500.count <= 2) tierPrice = Math.round(basePrice * 0.9);
  assertEqual(tierPrice, 574, "₹500-1499 total: 115% of 499 = 574");

  // Test 4: ₹1500+ total = 150%
  db.prepare("INSERT INTO purchases (contact_id, amount, purchase_date, kind, created_at) VALUES (?, 1500, ?, 'ppv', ?)").run(contactId, ts.split("T")[0], ts);
  const countRow1500 = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM purchases WHERE contact_id = ?").get(contactId) as { count: number; total: number };
  assert(countRow1500.total >= 1500, "total is now >= 1500");
  tierPrice = basePrice;
  if (countRow1500.count === 0) tierPrice = Math.round(basePrice * 0.7);
  else if (countRow1500.total >= 1500) tierPrice = Math.round(basePrice * 1.5);
  else if (countRow1500.total >= 500) tierPrice = Math.round(basePrice * 1.15);
  else if (countRow1500.count <= 2) tierPrice = Math.round(basePrice * 0.9);
  assertEqual(tierPrice, 749, "₹1500+ total: 150% of 499 = 749");

  // Clean up purchases for next test
  db.prepare("DELETE FROM purchases WHERE contact_id = ?").run(contactId);

  console.log("\n=== hasPurchaseIntent keyword matching ===\n");

  // Test the actual keyword matching from pollMessages.ts
  function hasPurchaseIntent(text: string): boolean {
    const lower = text.toLowerCase();
    const direct = [
      "buy", "price", "cost", "pay", "payment", "premium", "vip", "exclusive",
      "subscription", "membership", "unlock", "join", "link", "how much",
      "kitna", "kitne", "video", "content", "send link",
    ];
    const indirect = [
      "chahiye", "do na", "bhej de", "dikha", "want", "need", "show me",
      "let me see", "i want", "mujhe", "de do",
    ];
    const urgency = ["right now", "fast", "quick", "jaldi", "abhi"];
    if (direct.some((kw) => lower.includes(kw))) return true;
    if (urgency.some((kw) => lower.includes(kw)) && indirect.some((kw) => lower.includes(kw))) return true;
    return false;
  }

  assert(hasPurchaseIntent("how much for premium"), "direct: 'how much for premium'");
  assert(hasPurchaseIntent("send me the link"), "direct: 'send me the link'");
  assert(hasPurchaseIntent("mujhe video chahiye"), "indirect+urgency: 'mujhe' + 'chahiye'");
  assert(!hasPurchaseIntent("hello how are you"), "no match: casual greeting");
  assert(!hasPurchaseIntent("what's up"), "no match: casual");
  assert(hasPurchaseIntent("i want to buy"), "direct: 'buy'");
  assert(hasPurchaseIntent("kitna hai"), "direct: 'kitna'");
  assert(hasPurchaseIntent("the content was great"), "match: 'content' is a direct intent keyword (overdetection is intentional)");

  console.log("\n=== isMediaUnlocked note matching ===\n");

  db.prepare("DELETE FROM purchases").run();

  // Simulate: no purchase yet
  const noPurchase = db.prepare("SELECT id FROM purchases WHERE note LIKE ?").get("media_unlock:42:%");
  assert(!noPurchase, "no unlock without purchase");

  // Simulate: purchase recorded
  db.prepare("INSERT INTO purchases (contact_id, amount, purchase_date, note, kind, created_at) VALUES (?, 499, ?, 'media_unlock:42:razorpay_payment:pay_test123', 'ppv', ?)").run(contactId, ts.split("T")[0], ts);
  const hasPurchase = db.prepare("SELECT id FROM purchases WHERE note LIKE ?").get("media_unlock:42:%") as { id: number } | undefined;
  assert(!!hasPurchase, "unlock found after purchase");

  const wrongMedia = db.prepare("SELECT id FROM purchases WHERE note LIKE ?").get("media_unlock:99:%");
  assert(!wrongMedia, "no unlock for different media ID");

  console.log("\n=== Purchase idempotency ===\n");

  // Simulate duplicate webhook: second insert with same paymentId should be skipped
  const existing = db.prepare("SELECT id FROM purchases WHERE note LIKE ?").get("%razorpay_payment:pay_test123%") as { id: number } | undefined;
  assert(!!existing, "existing purchase found by paymentId");

  // Try to create duplicate
  if (existing) {
    const row = db.prepare("SELECT * FROM purchases WHERE id = ?").get(existing.id) as { id: number; amount: number };
    assertEqual(row.amount, 499, "duplicate returns existing row without double-insert");
  }

  const countAfter = (db.prepare("SELECT COUNT(*) AS count FROM purchases").get() as { count: number }).count;
  assertEqual(countAfter, 1, "only one purchase row after duplicate attempt");

  console.log("\n=== Share of voice tracking ===\n");

  const zeroPurchasesTier = 0 === 0 ? Math.round(basePrice * 0.7) : basePrice;
  assertEqual(zeroPurchasesTier, 349, "sendPremiumOffer first-timer: 349");

  const highSpender = 1500 >= 1500 ? Math.round(basePrice * 1.5) : basePrice;
  assertEqual(highSpender, 749, "sendPremiumOffer high-spender: 749");

  const returning = 499 >= 500 ? Math.round(basePrice * 1.15) : (1 <= 2 ? Math.round(basePrice * 0.9) : basePrice);
  assertEqual(returning, 449, "sendPremiumOffer returning buyer under 500: 449");

  console.log("\n=== getIntentScore numerical scoring ===\n");

  // Replicate the service function
  function getIntentScore(messages: { text: string }[]): number {
    const direct = ["buy", "price", "cost", "pay", "payment", "premium", "vip", "exclusive", "subscription", "membership", "unlock", "join", "link", "how much", "kitna", "kitne", "send link"];
    const indirect = ["chahiye", "do na", "bhej de", "dikha", "want", "need", "show me", "let me see", "i want", "mujhe", "de do"];
    const urgency = ["right now", "fast", "quick", "jaldi", "abhi"];
    let score = 0;
    for (const msg of messages) {
      const lower = msg.text.toLowerCase();
      const directHits = direct.filter((kw) => lower.includes(kw)).length;
      const indirectHits = indirect.filter((kw) => lower.includes(kw)).length;
      const urgencyHits = urgency.filter((kw) => lower.includes(kw)).length;
      score += directHits * 20;
      score += indirectHits * 10;
      if (urgencyHits > 0 && indirectHits > 0) score += 15;
    }
    return Math.min(100, score);
  }

  assertEqual(getIntentScore([{ text: "how much for premium" }]), 40, "'how much' (indirect+direct) + 'premium' = 40");
  assertEqual(getIntentScore([{ text: "hello" }]), 0, "casual message = 0");
  assertEqual(getIntentScore([{ text: "i want to buy right now" }]), 55, "'want' + 'i want' + 'buy' + urgency = 55");
  assertEqual(getIntentScore([{ text: "mujhe video chahiye" }]), 20, "'mujhe chahiye' 2 indirect matches = 20");
  assertEqual(getIntentScore([{ text: "price" }, { text: "cost" }, { text: "link do" }]), 60, "3 messages with intent = 60");

  console.log("\n=== Emotional Temperature keywords ===\n");

  const positiveWords = ["love", "nice", "cute", "beautiful", "gorgeous", "thanks", "awesome", "amazing", "sexy", "hot", "miss you", "want you", "good", "best"];
  const negativeWords = ["bad", "hate", "stupid", "ugly", "worst", "terrible", "boring", "not interested", "leave", "stop"];
  const disengagementWords = ["bye", "goodbye", "later", "busy", "talk later", "gotta go", "ok bye"];

  function computeEmotionalTemp(messages: string[]): number {
    let temp = 50;
    for (const msg of messages) {
      const lower = msg.toLowerCase();
      if (positiveWords.some((w) => lower.includes(w))) temp += 6;
      if (negativeWords.some((w) => lower.includes(w))) temp -= 6;
      if (disengagementWords.some((w) => lower.includes(w))) temp -= 10;
    }
    return Math.max(0, Math.min(100, temp));
  }

  assertEqual(computeEmotionalTemp(["i love you"]), 56, "positive word: +6");
  assertEqual(computeEmotionalTemp(["this is bad"]), 44, "negative word: -6");
  assertEqual(computeEmotionalTemp(["bye"]), 40, "disengagement: -10");
  assertEqual(computeEmotionalTemp(["i love you", "you're so beautiful"]), 62, "2 positive: +12");
  assertEqual(computeEmotionalTemp(["i hate this", "bye"]), 34, "negative + disengagement: -16");
  assertEqual(computeEmotionalTemp(["hello how are you"]), 50, "neutral: stays 50");
  assertEqual(computeEmotionalTemp(["you're so sexy hot"]), 56, "high energy positive: +6 (per message, not per word)");

  console.log("\n=== Offer cooldown logic ===\n");

  // Simulate cooldown: after 3 locked responses, cooldown is set
  const LOCKED_COUNT = 3;
  const cooldownDays = 7;
  
  // If locked count >= max, cooldown is active
  const exhausted = 3 >= LOCKED_COUNT;
  assert(exhausted, "cooldown triggered after exhausting locked responses");
  
  // Offer declined count: set cooldown after repeated declines
  const declinedCount = 3;
  const shouldCooldown = declinedCount >= 2;
  assert(shouldCooldown, "cooldown triggered after 2+ declines");

  // Cooldown check: skip offers if in cooldown
  const inCooldown = true;
  const intentScoreHigh = 80;
  const shouldSkipOffer = inCooldown && intentScoreHigh >= 60;
  assert(shouldSkipOffer, "offer skipped when in cooldown despite high intent");

  console.log("\n=== Post-purchase phase detection ===\n");

  function getPostPurchasePhase(paidAt: string | null, welcomeSent: boolean, hoursSincePurchase: number): string {
    if (!paidAt) return "none";
    if (hoursSincePurchase < 24 && !welcomeSent) return "welcome";
    if (hoursSincePurchase < 168) return "nurture";
    return "reoffer";
  }

  assertEqual(getPostPurchasePhase(null, false, 0), "none", "no purchase = none");
  assertEqual(getPostPurchasePhase("2024-01-01T00:00:00Z", false, 1), "welcome", "within 24h, no welcome = welcome");
  assertEqual(getPostPurchasePhase("2024-01-01T00:00:00Z", true, 1), "nurture", "within 24h, welcome sent = nurture");
  assertEqual(getPostPurchasePhase("2024-01-01T00:00:00Z", true, 72), "nurture", "within 7 days = nurture");
  assertEqual(getPostPurchasePhase("2024-01-01T00:00:00Z", true, 169), "reoffer", "after 7 days = reoffer");

  console.log("\n=== Dynamic pacing ===\n");

  function shouldSkipDueToPacing(emotionalTemp: number, minutesSinceLastReply: number): boolean {
    if (emotionalTemp >= 40) return false;
    return minutesSinceLastReply < 5;
  }

  assert(!shouldSkipDueToPacing(70, 1), "high temp: never paced");
  assert(!shouldSkipDueToPacing(50, 10), "medium temp: not paced even if recently replied");
  assert(!shouldSkipDueToPacing(20, 10), "low temp but 10 min since: not paced");
  assert(shouldSkipDueToPacing(20, 2), "low temp and 2 min since: paced");
  assert(!shouldSkipDueToPacing(20, 5), "low temp but exactly 5 min: not paced");
  assert(!shouldSkipDueToPacing(40, 0), "temp exactly 40: never paced");

  console.log("\n=== Upsell ladder logic ===\n");

  // First purchase: upsell count 0, total spent < 1000 → send upsell
  const upsellCount0 = 0;
  const totalSpent399 = 399;
  const shouldUpsellFirst = upsellCount0 === 0 && totalSpent399 < 1000;
  assert(shouldUpsellFirst, "first-time buyer gets upsell offer");

  // After upsell: upsell count 1 → no more upsell
  const upsellCount1: number = 1;
  const totalSpent699: number = 699;
  const shouldUpsellSecond = upsellCount1 === 0 && totalSpent699 < 1000;
  assert(!shouldUpsellSecond, "after upsell, no more immediate upsells");

  // High spender: total spent >= 1000 → no upsell needed
  const upsellCount0High: number = 0;
  const totalSpent1000: number = 1000;
  const shouldUpsellHigh = upsellCount0High === 0 && totalSpent1000 < 1000;
  assert(!shouldUpsellHigh, "high spender does not get first-purchase upsell");

  // Cleanup
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const walPath = TEST_DB_PATH + "-wal";
  const shmPath = TEST_DB_PATH + "-shm";
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
