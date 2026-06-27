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

## 6. AI Fetch Has No Timeout

**Severity:** Medium (can stall poll loop)

**Issue:** The OpenRouter API fetch in `suggest-reply.ts` has no AbortController timeout. If the AI service hangs, a single stalled request can consume the entire 50-second poll budget, causing the poll to skip other contacts.

**Workaround:** The poll has a 50-second timeout and caps at 500 dialogs. Budget per contact is ~100ms, so a stalled AI call is worse than expected.

**Future fix:** Add `AbortSignal.timeout(15000)` to the OpenRouter fetch.

---

## 7. LIKE-Based Payment Dedup Without UNIQUE Constraint

**Severity:** Low (dedup works in practice but not formally enforced)

**Issue:** Purchase idempotency uses a `LIKE '%razorpay_payment:{paymentId}%'` check instead of a `UNIQUE` constraint on a dedicated `payment_id` column. Two concurrent webhook deliveries could theoretically create duplicate purchase records.

**Workaround:** The check runs inside a database transaction. SQLite serializes writes, making concurrent inserts mutually exclusive.

**Future fix:** Add a `payment_id TEXT UNIQUE` column to the purchases table.

---

## 8. Dashboard Works but Has No Mobile Optimization

**Severity:** Low

**Issue:** The CRM dashboard UI is built for desktop viewports. Mobile display is functional but not polished.

**Future fix:** Add responsive breakpoints for tablet and mobile layouts.

---

## 9. No Logout Endpoint

**Severity:** Low

**Issue:** The session cookie (`crm_session`) has a 30-day TTL with no logout endpoint. The only way to "log out" is to clear browser cookies or change the `CRM_API_KEY`.

**Future fix:** Add a `POST /api/auth/logout` endpoint that clears the cookie.

---

## 10. Segment Follow-Up Thresholds Hardcoded

**Severity:** Low (configurable in code, not via UI)

**Issue:** Segment inactivity thresholds (45d for VIP, 60d for whale, etc.) are hardcoded in SQL queries. Operators cannot adjust them through the dashboard.

**Future fix:** Store thresholds in `settings` table and allow override via dashboard.
