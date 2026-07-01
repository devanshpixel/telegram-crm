# Tasks

## Conversation Polish — Complete ✅

### Prompt Rewrite ✅
- Rewrote entire SYSTEM_PERSONA in `lib/ai/suggest-reply.ts`
- Addressed all 9 production issues:
  1. Question overuse → enforced 40% max, banned repetitive structures
  2. Personality too nice → added unpredictability, coldness, push-pull
  3. Emoji usage → explicit 50/35/15 rule, no consecutive emoji
  4. Selling flow → 4-step rotation with varied language, banned overused phrases
  5. Generic questions → hardened banned list
  6. Memory → improved CRM context integration
  7. Human behavior → quantified percentages for ignoring, distraction, one-word replies
  8. Emotional variety → added 14 emotions with usage instructions (jealousy, mystery, warmth, excitement, vulnerability)
  9. Message length → enforced 1-2 sentences max, reduced max_tokens 120→100

### 100-Conversation Audit ✅
- Simulated 100 conversations across 13 persona types
- Pattern detection identified:
  - "sabko nahi bhejti/dikhati" — 5x repetition
  - "X matlab?" — 18x repetition
  - "depends" — 7x overuse
  - "pata hai" — 6x tick
  - Question overuse: 68% vs target 40%
  - Missing emotions: jealousy (0%), mystery (2%), warmth (4%)
  - Incomplete selling: 0/100 reached [LINK] stage

### Prompt Improvements Applied ✅
- Banned repetitive structures: "X matlab?", "tu X hai ya Y?", "X mat bol", "pehle X", "X vibes aa rahe", "pata hai"
- Added rotation rules for selling phrases (5 variants per step)
- Banned overused words: "sabko nahi bhejti", "screening", "deserve karta hai"
- Quantified human behaviors with percentages
- Expanded emotional range instructions with specific triggers
- Rewrote all 7 phase variants to enforce statements over questions
- Updated mode prompts to emphasize language variety

### Build Verification ✅
- TypeScript: clean
- Next.js build: success
- 0 errors, 0 warnings

## RELEASE CANDIDATE — Complete ✅

### Phase 1: Production Audit ✅
- All features audited for production readiness

### Phase 2: Critical Bug Fixes ✅
- Phantom purchase (recordUpsell) — fixed
- Webhook 400→500 (Razorpay retry) — fixed
- Cursor advancement past unprocessed messages — fixed
- N+1 queries in poll loop — eliminated
- iterMessages OOM risk — limited to 50
- shouldSendLockedResponse side effects — removed
- Client-set price in create-order — enforced server-side
- NaN price bypass — validated
- Header injection via filename — sanitized

### Phase 3: HIGH Bug Fixes ✅
- LIKE wildcard injection — escaped
- Duplicate COUNT queries — deduplicated
- offerAcceptanceByTier — implemented
- joined_at locale format — ISO 8601
- Threshold mismatches — aligned
- Message sent before tracking insert — reordered
- Missing LIMIT in remind — added
- verify-crons timeout — parallelized
- Error message leaks — sanitized
- Silent poll failure — 500 status
- count = items.length — uses audience count

### Phase 4: Dead Code Removal ✅
- 4 unused exports removed
- 2 unused interfaces removed
- 2 unused helper functions removed
- 1 dead parameter removed

### Phase 5: Performance ✅
- N+1 elimination, LIMITs added, parallel verification

### Phase 6: Security ✅
- sign-out POST-only, health endpoint sanitized, sameSite strict, headers added

### Phase 7: Reliability ✅
- Error handlers, webhook retries, cursor safety

### Phase 8: Verification ✅
- TSC clean, lint clean, 54/54 tests pass

### Phase 9: Documentation ✅
- FINAL_AUDIT.md, FINAL_RELEASE_REPORT.md, LAUNCH_CHECKLIST.md
- PRODUCTION_ENVIRONMENT_CHECKLIST.md, MANUAL_STEPS.md
- KNOWN_LIMITATIONS.md (updated)

## Pre-Launch Blockers

- [ ] **Rotate all secrets** (`.env` committed to git)
- [ ] **Telegram OTP login** (interactive)
- [ ] **Razorpay webhook config** (dashboard)
- [ ] **Vercel deployment** (dashboard)
- [ ] **Chrome extension publish** (optional)

## Production Audit Fixes ✅

### Critical (cursor + duplicate replies) ✅
- Post-send DB failures no longer prevent cursor advancement
- `sendPremiumOffer`, `sendAiReply` ([LINK] path), `sendLockedResponse`, `markWelcomeSent`, `incrementOfferDeclined` all catch post-send failures locally
- `sendAiReply` [LINK] path: double-send prevented when `setConvState` fails after message sent
- No duplicate Telegram replies possible from failed post-send DB operations

### High (AI fetch timeout) ✅
- OpenRouter fetch wrapped with 15s AbortController timeout
- Timeout triggers retry, then graceful fallback to canned reply

### Medium (re-engage idempotency) ✅
- Re-engagement cron uses settings table dedup keys (same pattern as stale-leads, vip/whale followup)

## Reliability + Test Hardening ✅

- Dashboard logout: `POST /api/auth/logout` clears `crm_session` (session-gated, POST-only → CSRF-safe) + "Log out" button in Settings modal
- Brute-force throttle in middleware: 10 failed `?key=`/`x-api-key` attempts per IP per 60s → HTTP 429 (authenticated traffic bypasses; memory-bounded)
- Playwright e2e suite (`e2e/auth.spec.ts`, 8 tests): auth boundary — 401s, login cookie, logout, cron gate, 429 throttle. `npm run test:e2e`
- KNOWN_LIMITATIONS refreshed: AI-fetch timeout (#6), payment UNIQUE index (#7), webhook permanent-failure 200 (#4) confirmed resolved; logout (#9) resolved; rate limiting (#2) partial

## Post-Launch

- [ ] Monitor error logs for 24h
- [ ] Verify all cron jobs ran
- [ ] Check payment conversion rate
- [ ] Add rate limiting (future enhancement)
- [ ] Add UNIQUE constraint on purchases.payment_id (future enhancement)
