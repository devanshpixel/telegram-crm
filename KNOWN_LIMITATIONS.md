# Known Limitations

> Limitations, risks, and future improvements identified during RC audit (updated post-fix).

---

## 1. Turso Transaction Race Condition

**Severity:** Medium (low probability, high impact)

**Issue:** The Turso adapter (`lib/db/adapters.ts`) uses a module-level `currentTx` variable to route prepared statements through the active transaction. Under concurrent request handling on a single server instance, one request's transaction handle could be overwritten by another request's transaction, causing cross-contamination of database operations.

**Workaround:** Vercel serverless functions handle one request at a time per instance. Concurrency only occurs if multiple requests hit the same warm instance simultaneously, which is rare. The better-sqlite3 path (local dev) is synchronous and unaffected.

**Future fix:** Restructure the adapter to pass transaction context explicitly rather than relying on shared module state.

---

## 2. No Rate Limiting

**Severity:** Low (no abuse observed, but no protection)

**Issue:** No API endpoints have rate limiting. An attacker could brute-force the CRM dashboard login via `?key=` parameter or spam the poll/webhook endpoints.

**Workaround:** Dashboard auth requires exact `CRM_API_KEY` match. The key should be a strong random string. Cron endpoints require `CRON_SECRET`.

**Future fix:** Add rate limiting middleware for high-traffic endpoints.

---

## 3. Re-engagement Campaign Has No Recipient Cap

**Severity:** Low (unlikely to exceed Vercel 60s timeout with current volumes)

**Issue:** The re-engagement endpoint (`/api/telegram/reengage`) selects up to 20 candidates per run. If the audience grows significantly, 20 AI-generated replies could exceed the 60-second Vercel function timeout.

**Future fix:** Make the limit configurable and add pagination.

---

## 4. Webhook Retries for Permanent Failures  

**Severity:** Low (noisy, not destructive)  

**Issue:** When a webhook event references a deleted contact, Razorpay retries the event indefinitely because the endpoint now returns HTTP 500 (was 400, fixed in RC to enable retries for transient errors).  
This generates log noise but has no other impact.  

**Future fix:** Return HTTP 200 for permanent failures after logging them.

---

## 5. No Alerting or Monitoring

**Severity:** Medium

**Issue:** There is no monitoring, alerting, or error tracking integrated. Failures in the poll engine, webhook, or cron jobs are only visible in Vercel logs.

**Future fix:** Integrate with Sentry or similar for error tracking. Set up Vercel log drain.

---

## 6. AI Fetch Timeout — RESOLVED

**Severity:** ~~Medium~~ Resolved

**Issue:** The OpenRouter API fetch in `suggest-reply.ts` could hang and consume the entire poll budget.

**Fix:** The fetch is wrapped in an `AbortController` with a 15s timeout (`lib/ai/suggest-reply.ts:345`). A timeout triggers a retry, then a graceful fallback to a canned reply.

---

## 7. Payment Dedup UNIQUE Constraint — RESOLVED

**Severity:** ~~Low~~ Resolved

**Issue:** Purchase idempotency previously relied on a `LIKE` check rather than a formal constraint.

**Fix:** A partial UNIQUE index enforces idempotency at the storage layer: `CREATE UNIQUE INDEX idx_purchases_payment_id ON purchases(payment_id) WHERE payment_id IS NOT NULL` (`lib/db/schema.ts:148`, created on both better-sqlite3 and Turso paths). `createPurchase()` performs an atomic idempotent insert that no-ops on conflict (`lib/db/service.ts:531`). Legacy rows with NULL `payment_id` are unaffected.

---

## 8. Dashboard Works but Has No Mobile Optimization

**Severity:** Low

**Issue:** The CRM dashboard UI is built for desktop viewports. Mobile display is functional but not polished.

**Future fix:** Add responsive breakpoints for tablet and mobile layouts.

---

## 9. Logout Endpoint — RESOLVED

**Severity:** ~~Low~~ Resolved

**Issue:** The session cookie (`crm_session`) had a 30-day TTL with no logout endpoint.

**Fix:** `POST /api/auth/logout` (`app/api/auth/logout/route.ts`) overwrites the cookie with an immediately-expired value using matching attributes. A "Log out" button in the Settings modal calls it and reloads to the sign-in page. POST-only + session-gated by middleware, so it also resists CSRF.

---

## 10. Segment Follow-Up Thresholds Hardcoded

**Severity:** Low (configurable in code, not via UI)

**Issue:** Segment inactivity thresholds (45d for VIP, 60d for whale, etc.) are hardcoded in SQL queries. Operators cannot adjust them through the dashboard.

**Future fix:** Store thresholds in `settings` table and allow override via dashboard.
