# TASKS.md

> **Live Execution Board (LOCKED)**

> This file is the single execution board for Claude Code.
>
> Keep it updated throughout the project. Never silently abandon work.
> Every completed task must move through:
>
> **TODO → IN PROGRESS → VERIFIED → DONE**

------------------------------------------------------------------------

# Rules

## Always

-   Work from highest priority to lowest.
-   Finish current critical task before starting another.
-   Verify every completed task.
-   Update this file after every milestone.

## Never

-   Mark DONE without verification.
-   Work on cosmetic improvements while critical bugs remain.
-   Leave partially completed work undocumented.

------------------------------------------------------------------------

# Priority Matrix

## P0 --- Critical

Anything that prevents revenue.

Examples:

-   Telegram broken
-   AI not replying
-   Payment failure
-   Webhook failure
-   Unlock failure
-   Database corruption
-   Production crash

Must be fixed immediately.

------------------------------------------------------------------------

## P1 --- High

Anything that directly affects conversion.

Examples:

-   Poor conversation quality
-   Generic AI replies
-   Wrong offer timing
-   Broken reminder flow
-   Repeat purchase issues

------------------------------------------------------------------------

## P2 --- Medium

Reliability improvements.

Examples:

-   Better logging
-   Test coverage
-   Error handling
-   Refactoring with measurable benefit

------------------------------------------------------------------------

## P3 --- Low

Post-launch only.

Examples:

-   Dashboard polish
-   UI improvements
-   Animations
-   Nice-to-have features

------------------------------------------------------------------------

# Execution Plan (from PROJECT_KNOWLEDGE.md)

| # | Task | Status |
|---|------|--------|
| 1 | **Make production storage safe** — BUG-2 (throw on no Turso in prod), BUG-1 (Turso transactions), missing indexes | DONE |
| 2 | **Harden the money path** — BUG-3 (webhook idempotency), BUG-4 (payment reconciliation) | DONE |
| 3 | **Improve conversation conversion quality** — BUG-5 (one reply per burst), BUG-8 (Hinglish locked copy), [LINK] robustness | DONE |
| 4 | **Fix currency consistency** to INR — BUG-6 | DONE |
| 5 | **Add automated tests** — webhook, purchase/unlock, poll state machine, middleware | PENDING |
| 6 | **Complete extension PPV loop** — gallery + upload + unlock UI | PENDING |
| 7 | **Secrets & hygiene** — rotate committed keys, prune artifacts, quiet logging, rewrite stale docs | PENDING |
| 8 | **Lower-priority polish** — backup API/UI, message pagination, extension analytics/AI-mode/icons | PENDING |

------------------------------------------------------------------------

# Verification Log

## Batch 1: Production storage safety

| Task | Status | How Verified |
|------|--------|-------------|
| BUG-2: throw in production when Turso unconfigured | VERIFIED | `lib/db/index.ts:202-208` — `throw new Error(...)` replaces `console.error` |
| BUG-1: Turso transactions use tx handle | VERIFIED | `lib/db/adapters.ts:83-84` — `currentTx` flag routes `prepare()` calls to `tx.execute()` instead of `client.execute()` during transactions |
| Missing indexes in SCHEMA_SQL | VERIFIED | `lib/db/schema.ts:147-149` — 3 `CREATE INDEX IF NOT EXISTS` added |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 2: Money path hardening

| Task | Status | How Verified |
|------|--------|-------------|
| BUG-3: atomic webhook idempotency | VERIFIED | `lib/db/service.ts` — idempotency check moved inside `createPurchase` transaction; `paymentId` param |
| BUG-4: payment reconciliation route | VERIFIED | `app/api/razorpay/reconcile/route.ts` — new cron endpoint, same CRON_SECRET gate as poll/remind |
| Recon middleware gate | VERIFIED | `middleware.ts:9` — `/api/razorpay/reconcile` added to `CRON_PATHS` |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 3: Conversation conversion quality

| Task | Status | How Verified |
|------|--------|-------------|
| BUG-5: one reply per contact per poll | VERIFIED | `pollMessages.ts` — replies moved outside inner message loop; incoming messages batched in array |
| BUG-8: Hinglish locked copy | VERIFIED | `pollMessages.ts:240` — "Baby, this chat is locked now 😘💕" replaces "Premium chat is locked" |
| [LINK] case-insensitive | VERIFIED | `pollMessages.ts:184,187,197` — `match(/\[link\]/i)` + `replace(/\[link\]/gi)` |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 5: Conversation engine

| Task | Status | How Verified |
|------|--------|-------------|
| Nayra persona improved | VERIFIED | `suggest-reply.ts:6-18` — mirror energy, unpredictable, generic-free |
| All 7 funnel phases enhanced | VERIFIED | `suggest-reply.ts:20-49` — specific, emotionally aware, actionable |
| Objection detection | VERIFIED | `suggest-reply.ts:117-123` — `hasObjection()` function |
| Auto mode routes objections to PHASE_6 | VERIFIED | `suggest-reply.ts:163-165` |
| Mode prompts updated | VERIFIED | `suggest-reply.ts:52-81` — flirty, sales, reengagement, premium |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 6: Intent detection + offer ladder

| Task | Status | How Verified |
|------|--------|-------------|
| Expanded intent keywords | VERIFIED | `pollMessages.ts:262-276` — direct + indirect + urgency signals |
| Tiered offer pricing | VERIFIED | `pollMessages.ts:278-285` — `selectOfferAmount()`: 70% for first-timers, 150% for high-spenders |
| Premium offer uses tiered price | VERIFIED | `pollMessages.ts:233` — `sendPremiumOffer` calls `selectOfferAmount` |
| Locked response uses tiered price | VERIFIED | `pollMessages.ts:243` — `sendLockedResponse` calls `selectOfferAmount` |
| Settings label fix | VERIFIED | `SettingsModal.tsx` — ₹ instead of paise, correct description |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 7: Currency consistency (BUG-6)

| Task | Status | How Verified |
|------|--------|-------------|
| formatCurrency uses INR | VERIFIED | `lib/utils.ts:40-54` — `currency: "INR"`, locale `en-IN` |
| Follow-up hint prefix `$` → `₹` | VERIFIED | `lib/db/service.ts:1473` — `₹` prefix |
| Description text `$` → `₹` | VERIFIED | `lib/db/service.ts:1526` — "₹200+" |
| Lead score tier adjusted for INR | VERIFIED | `lib/db/service.ts:1639` — `+1 per ₹100` (was per $10) |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

------------------------------------------------------------------------

# Blockers

None.

------------------------------------------------------------------------

## Batch 8: End-to-end flow audit (production bugs found & fixed)

| Task | Status | How Verified |
|------|--------|-------------|
| Unread count always 0: getMessagesByContactId had mark-read side effect | FIXED | `lib/db/service.ts:173-203` — extracted `markConversationRead()`, getMessages is pure read; callers: messages API route calls mark explicitly, AI/poll callers do not |
| Cursor advances on reply failure: poll engine advanced sync cursor even when AI/Razorpay failed | FIXED | `pollMessages.ts:528-533` — `replyFailed` flag, cursor only advances on success; idempotent createMessage ensures safe retry |
| Checkout redirect hits 401: Razorpay callback_url pointed to auth-protected dashboard | FIXED | Created `app/api/checkout/success/route.ts` (public HTML page); added `/api/checkout` to PUBLIC_PATHS; updated both callback URLs |
| Post-purchase Telegram confirmation missing media link | FIXED | `webhook/route.ts:67-73` — appends `View it here: {url}/api/media/{id}/file?contactId={id}` when mediaId present |
| Reconcile confirmation also missing media link | FIXED | `reconcile/route.ts:91-98` — same media link appended when mediaId present |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

## Batch 10: Deep revenue audit + full production verification

| Task | Status | How Verified |
|------|--------|-------------|
| PHASE_2 unreachable in auto mode | FIXED | `suggest-reply.ts:168-169` — added `incomingCount > 1 → PHASE_2` condition (was jumping >2 → PHASE_3) |
| Objection handling gate too restrictive | FIXED | `suggest-reply.ts:162` — removed `incomingCount > 4` requirement, objections handled immediately |
| PHASE_6 prompts weak/admitted price high | FIXED | `suggest-reply.ts:43-45` — rewritten: confident, value-reframing, social proof |
| Reengagement mode guilt-trippy | FIXED | `suggest-reply.ts:74-76` — rewritten: curiosity hooks, no guilt |
| PHASE_4/5/7 prompts generic | FIXED | `suggest-reply.ts:35-49` — sensory hints, social proof, emotional benefit |
| Offer priority: objection > sales mode | FIXED | `suggest-reply.ts:157-167` — reordered checks so objections are handled before offers |
| Poll engine state machine re-verified | VERIFIED | No new bugs found — BUG-1 (Turso tx atomicity) fix intact at `adapters.ts:83-125` |
| Webhook flow re-verified | VERIFIED | Idempotency via paymentId in createPurchase, re-throw on failure for Razorpay retry |
| Middleware security re-verified | VERIFIED | 3-tier auth (CRON, public, CRM key), httpOnly cookie, key-stripped redirect |
| Reminder/re-engagement crons re-verified | VERIFIED | Both public via CRON_SECRET, correct query filters, error-isolated per contact |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |
| Tests | PASS | `npm test` — 25/25 passing |

## Batch 11: Production hardening + monitoring

| Task | Status | How Verified |
|------|--------|-------------|
| Health check endpoint | FIXED | `app/api/health/route.ts` — checks DB, Razorpay, OpenRouter, Telegram session, env vars; returns healthy/degraded with per-check status |
| Media routes locked out fans | FIXED | `middleware.ts:6` — `/api/media` added to PUBLIC_PATHS; routes have their own access control (isMediaUnlocked) |
| recalculateLeadScore error skips cursor | FIXED | `pollMessages.ts:501-503` — moved inside reply try/catch; failure sets replyFailed=true preventing updateSyncCursor |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |
| Tests | PASS | `npm test` — 25/25 passing |

## Batch 13: V2 Revenue Engine — Emotional Temperature, Intent Scoring, Post-Purchase Lifecycle, Upsell Ladder, Abandonment Recovery, Analytics

| Task | Status | How Verified |
|------|--------|-------------|
| Schema: added emotional_temp, relationship_score, offer_declined_count, offer_cooldown_until, paid_at, post_purchase_welcome_sent, last_upsell_at, upsell_count columns | DONE | `lib/db/schema.ts:151-158` — ALTER TABLE statements; `lib/db/types.ts:32-35` — ContactRow fields |
| Service: updateEmotionalTemp() — sentiment analysis on last 5 messages | DONE | `lib/db/service.ts:1691-1711` — positive (+6), negative (-6), disengagement (-10), high-energy (+8) keywords |
| Service: updateRelationshipScore() — composite from messages, days, purchases, emotional temp | DONE | `lib/db/service.ts:1713-1737` — message count (max 20), days since (max 15), purchase bonus (30+), temp contribution |
| Service: getIntentScore() — numerical 0-100 scoring | DONE | `lib/db/service.ts:1785-1806` — direct (20pt), indirect (10pt), urgency+indirect bonus (15pt) |
| Service: offer cooldown (incrementOfferDeclined, setOfferCooldown, isInOfferCooldown) | DONE | `lib/db/service.ts:1739-1757` — tracks declined count, sets/checks cooldown period |
| Service: post-purchase phases (getPostPurchasePhase, markWelcomeSent, recordPaid) | DONE | `lib/db/service.ts:1759-1783` — welcome (<24h), nurture (1-7d), reoffer (>7d) |
| Service: recordUpsell() — tracks upsell purchases | DONE | `lib/db/service.ts:1771-1783` — creates upsell purchase row, increments upsell_count |
| Service: getRevenueAnalytics() — conversion rate, AOV, LTV, repeat purchase rate | DONE | `lib/db/service.ts:1808-1846` — all key revenue metrics |
| Conversation Engine V2: emotional temp-aware phase routing | DONE | `lib/ai/suggest-reply.ts:235-240` — effectiveCount adjusted by emotional temp (high=+2, low=-1) |
| Conversation Engine V2: intent score thresholds (>=60 direct offer, >=30 sales mode, <30 casual) | DONE | `pollMessages.ts:507-518` — three-tier scoring replaces boolean hasPurchaseIntent |
| Emotional temperature updates on every incoming message | DONE | `pollMessages.ts:478-481` — updateEmotionalTemp + getIntentScore + updateRelationshipScore per poll cycle |
| Dynamic conversation pacing: skip low-temp contacts recently replied | DONE | `pollMessages.ts:76-85` — shouldSkipDueToPacing(): temp<40 + replied<5min → skip |
| Offer cooldown: exhausted locked responses set 7-day cooldown | DONE | `pollMessages.ts:249,266` — setOfferCooldown when locked count exhausted or declined |
| Post-purchase lifecycle: welcome → nurture → reoffer in poll loop | DONE | `pollMessages.ts:487-505` — PAID state checked for phase, welcome sent once, reoffer after 7d |
| Upsell ladder in webhook: first-purchase upsell at 60% price | DONE | `webhook/route.ts:72-95` — immediate upsell offer for first-time buyers |
| Upsell ladder in reconcile: same logic for recovered payments | DONE | `reconcile/route.ts:89-120` — same upsell logic on reconciliation |
| Abandonment recovery cron: remind unpaid link creators after 30min | DONE | `app/api/razorpay/recover/route.ts` — new cron, queries Razorpay for created links >30min old, sends reminder once |
| Revenue analytics API route | DONE | `app/api/analytics/revenue/route.ts` — conversion rate, AOV, LTV, repeat purchase rate, emotional temp averages |
| Middleware: recover route in CRON_PATHS | DONE | `middleware.ts:9` — added `/api/razorpay/recover` |
| Tests: 29 new V2 tests (intent scoring, emotional temp, cooldown, post-purchase phases, pacing, upsell ladder) | DONE | `scripts/test-core-logic.ts` — 54 total tests (was 25), all passing |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |
| Tests | PASS | `npm test` — 54/54 passing |

| Task | Status | How Verified |
|------|--------|-------------|
| Prompt variants per phase (3 each, randomly selected) | DONE | `suggest-reply.ts:24-128` — `PHASE_VARIANTS` with 3 prompts per phase, `pick()` + `getPhasePrompt()` |
| Banned phrase rule added | DONE | `suggest-reply.ts:19` — 'NEVER ask "would you like to buy", "reply YES", or "interested?" |
| Expand detectMode keywords | DONE | `suggest-reply.ts:110-112` — added exclusive, meeting, voice, custom, photos |
| Expand hasPurchaseIntent keywords | DONE | `pollMessages.ts:291-294` — added meeting, voice, custom, photos |
| Secrets hygiene: hardcoded credentials removed | DONE | `scripts/simulate-webhook.ts` — WEBHOOK_SECRET now reads from env, CRM_API_KEY header removed (unnecessary) |
| .env.example placeholder CRM_API_KEY | DONE | Changed to `change-me-to-at-least-32-random-hex-chars` |
| .env.example uncommented Turso config | DONE | Turso lines no longer commented out |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |
| Tests | PASS | `npm test` — 25/25 passing |

# Daily Summary

Completed:
  - Batch 13: V2 Revenue Engine (10 features, all verified)
    - Emotional Temperature system: per-message sentiment tracking (0-100)
    - Purchase Intent scoring: numerical (0-100) replaces boolean matching
    - Relationship score: composite from messages, purchases, engagement depth
    - Dynamic conversation pacing: adaptive reply cadence based on engagement
    - Offer cooldown logic: 7-day pause after declined offers
    - Post-purchase lifecycle: welcome → nurture → reoffer (7-day cycle)
    - Upsell ladder: first-purchase upsell at 60% price via webhook + reconcile
    - Checkout abandonment recovery: new cron, 30min+ unpaid link reminders
    - Revenue analytics API: conversion rate, AOV, LTV, repeat purchase rate
    - Conversation Engine V2: emotional temp + intent score aware phase routing
  - 29 new tests added (54 total, up from 25)
  - Clean TSC, clean lint

- **Spend Segmentation (complete)** — production-ready segment system with 6 tiers:
  - Segment type: `SpendSegment` (`prospect` | `buyer` | `premium` | `high_value` | `vip` | `whale`)
  - Eligibility rules: `recalculateSpendSegment()` — 0 purchases = prospect, 1x <₹500 = buyer, 2+ or ₹500+ = premium, ₹1500+ = high_value, ₹5000+ = vip, ₹20000+ = whale
  - Pricing behavior: `getSpendSegmentMultipliers()` — 0.7x / 0.9x / 1.0x / 1.15x / 1.5x / 2.0x
  - Offer timing: `SEGMENT_LOCKED_INTERVALS` — 12h / 18h / 24h / 36h / 48h / 72h
  - Reminder copy: `SEGMENT_LOCKED_MESSAGES` — 6 variants with segment-appropriate tone
  - Re-engagement: 6 segment-specific follow-up queries (prospect_engaged, buyer_inactive, premium_inactive, high_value_inactive, vip_segment_inactive, whale_inactive) in `getFollowUps()`
  - Analytics: `getSegmentBreakdown()` + `getSegmentRevenue()` in revenue endpoint
  - Run on every poll cycle + every purchase (webhook + reconcile)
  - Clean TSC, clean lint, 54/54 tests passing

- **Buyer Intelligence (complete)** — computed per-contact intelligence with 7 fields:
  - Lead classification: `recalculateBuyerIntelligence()` computes HOT/WARM/COLD from emotional temp, lead score, message recency, purchase recency, recent intent signals
  - Purchase probability (0-100): weighted from emotional temp, lead score, recency, purchase history
  - Churn risk (0-100): weighted from emotional temp, relationship score, message recency, purchase recency, declined offers
  - Conversation health (0-100): baseline 50, adjusted by emotional temp delta, relationship score, message recency
  - Lifetime spend score (0-100): tiered by total_spent thresholds (₹500/₹1500/₹5000/₹20000)
  - Last objection + last successful offer: persisted, settable via `recordObjection()` / `recordSuccessfulOffer()`
  - API: `GET /api/analytics/buyer-intelligence` (summary), `?contactId=N` (per-contact)
  - Runs on every poll cycle via `recalculateBuyerIntelligence(contact.id)`
  - 7 new DB columns, clean TSC, clean lint, 54/54 tests passing

- **CRM Intelligence (complete)** — 7 integrated capabilities computed per contact:
  - Auto tags: `updateAutoTags()` — 8 rule-based tags (big_spender, high_spender, repeat_buyer, first_time_buyer, recent_buyer, hot_lead, cold_lead, needs_attention), applied/removed dynamically
  - AI conversation summary: `generateConversationSummary()` — analyzes last 20 messages for topics (purchase_intent, objection, content_request, casual, custom_request), sentiment, and last message snippet
  - Suggested next action: `suggestNextAction()` — rule engine picks action from 8 strategies (address objection, send offer, re-engage, repair relationship, etc.)
  - Favorite content type: `updateFavoriteContentType()` — scores purchase notes against photos/videos/custom/voice keywords
  - Contact health: `recalculateContactHealth()` — composite score from conversation_health (40%), inverted churn_risk (30%), emotional_temp (20%), lifetime_spend_score (10%)
  - Last objection memory: persisted + surfaced in `getCrmIntelligence()` alongside operator notes
  - Operator notes integration: `getCrmIntelligence()` returns combined tags + notes + AI summary
  - API: `GET /api/analytics/crm-intelligence` (summary), `?contactId=N` (per-contact with tags, notes, summary, action, health)
  - Runs on every poll cycle via `recalculateCrmIntelligence(contact.id)`
  - 4 new DB columns, 54/54 tests, clean TSC, clean lint

- **Revenue Analytics (complete)** — production metrics endpoint with 10 metrics:
  - Revenue by offer: grouped by 5 amount tiers (under ₹100 to ₹1000+)
  - Revenue by segment: per-segment contact count + revenue
  - Funnel conversion: total contacts → engaged → offer sent → purchased → repeat → whale, with 4 conversion rates
  - Reminder conversion: contacts with locked responses → purchased after
  - Re-engagement conversion: purchases after 14+ days of silence
  - Repeat purchase rate: buyers with 2+ purchases vs total buyers
  - LTV: average total_spent across buyers
  - AOV: average purchase amount across all purchases
  - Top buyers: top 10 by total_spent with purchase count
  - Top offers: top 5 by total revenue with amount + count
  - `GET /api/analytics/revenue` — single endpoint, no vanity metrics
  - 54/54 tests, clean TSC, clean lint

Blocked:
  - None

Next Highest Priority:
  - Production deployment (Vercel dashboard, env vars, Turso setup)
  - Chrome Web Store extension submission (needs real branding assets)
  - Telegram login session (needs OTP)
  - Razorpay webhook configuration

------------------------------------------------------------------------

# Completion Criteria

Project is complete only when:

-   Production stable
-   Telegram verified
-   AI verified
-   Payments verified
-   Unlock verified
-   Conversation quality approved
-   Revenue flow verified
-   Critical bugs resolved
-   Documentation updated

Do not stop before these conditions are satisfied.
