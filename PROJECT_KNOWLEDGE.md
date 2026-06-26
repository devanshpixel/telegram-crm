# PROJECT_KNOWLEDGE.md

> Single source of truth for this repository.
> Every statement below was verified by reading the code on branch `final-recovery`.
> Where a file and line are cited, that is the evidence. Where docs in the repo
> contradict the code, the **code** is treated as authoritative and the contradiction
> is called out.

---

# Project Overview

## Purpose

This repository is an **AI-driven Telegram "relationship engine" with a CRM dashboard and Chrome extension**. It logs into a real Telegram user account (via GramJS / MTProto), polls incoming direct messages, and—when automated replies are enabled—answers fans automatically in the voice of a persona named **"Nayra"** (a "22-year-old girl from Mumbai… content creator on Telegram", `lib/ai/suggest-reply.ts:7`). The engine walks each fan through a sales funnel and, at conversion, sends a **Razorpay payment link**. On payment, a webhook unlocks "premium" and records revenue.

Around that engine sits a single-operator CRM:
- A Next.js dashboard (inbox, contact profiles, analytics, revenue, broadcasts, re-engagement campaigns, PPV media gallery).
- A Manifest V3 Chrome extension that bridges into Telegram Web and the CRM's HTTP API.

## Business objective

Stated in `CLAUDE.md:18`: "Ship a production-ready Telegram relationship engine that is stable, generates revenue, minimizes bugs, is easy to maintain." The monetization model is **pay-per-unlock**: the AI persona builds rapport and sells "premium access"/PPV media; payment is collected through Razorpay payment links priced in **INR** (default **₹499**, `app/api/settings/route.ts:12`, `src/lib/telegram/pollMessages.ts:133`).

## Branding inconsistency (verified)

The product has no single consistent name:
- `README.md:1` — "Telegram CRM"
- `package.json:2` — `telegram-crm-dashboard`
- `app/layout.tsx:16` — UI title "Lustify CRM | Telegram Inbox"
- `extension/manifest.json:3` — "Lustify CRM Bridge"
- Persona/checkout brand — "Nayra" / "Nayra Premium" (`lib/ai/suggest-reply.ts:7`, `src/lib/telegram/pollMessages.ts:224`)
- Webhook simulation secret references "velvet" (`scripts/simulate-webhook.ts:7`)

## Current implementation status

Working tree is on branch `final-recovery`; `CLAUDE.md` is untracked. The application **builds and runs** as a Next.js 15 app. The core loop (poll → AI reply → offer → Razorpay link → webhook → unlock) is fully implemented in code. The most recent commits are recovery/hardening fixes around polling, payments, and Vercel deployment.

### Completed features (verified present in code)

- **Telegram session login** — CLI (`scripts/telegram-login.ts`) and in-dashboard 3-step modal (phone → code → 2FA) backed by `/api/telegram/send-code|verify-code|verify-password|status|sign-out` and `src/lib/telegram/auth.ts`. Session persisted in `telegram_sessions` table.
- **Contact & message import** — `/api/telegram/import/contacts`, `/api/telegram/import/messages` (`src/lib/telegram/importContacts.ts`, `importMessages.ts`).
- **Automated poll engine** — `/api/telegram/poll` → `pollIncomingMessages()` (`src/lib/telegram/pollMessages.ts`). Ingests DMs, AI-replies, sends offers, sends locked reminders.
- **AI persona replies** — OpenRouter `openai/gpt-4o-mini`, 7-phase funnel, Hinglish persona, mode selection (`lib/ai/suggest-reply.ts`).
- **Razorpay payment links + webhook** — `/api/razorpay/create-order`, `/api/razorpay/webhook` (HMAC-verified, idempotent), `lib/razorpay.ts`.
- **PPV media** — upload with blurred-preview generation (sharp), locked/unlocked serving, unlock-via-payment (`app/api/media/*`, `lib/db/service.ts` media functions).
- **CRM dashboard** — inbox (chat list / conversation / right sidebar), 34 React components, server-rendered home (`app/page.tsx`).
- **Analytics / revenue / retention / follow-ups** — computed in `lib/db/service.ts` and exposed via `/api/analytics`, `/api/revenue`, `/api/purchases/ppv`, `/api/followups`.
- **Broadcasts & re-engagement campaigns** — filtered audiences + per-send throttling (`/api/broadcasts`, `/api/reengagement/send`).
- **Lead scoring** — `recalculateLeadScore()` (`lib/db/service.ts:1606`).
- **Operator settings** — offer price/message, AI mode, automated-replies toggle, stored in `settings` table (`/api/settings`).
- **Auth middleware** — cookie/header `CRM_API_KEY`, cron `CRON_SECRET`, webhook public (`middleware.ts`).
- **Backup CLI**, **Turso migration script**, **error boundary** (`app/error.tsx`), **DB backend abstraction** (better-sqlite3 ↔ Turso).
- **Chrome extension (MV3)** — popup + content script + service-worker API bridge (`extension/`).

### Incomplete / partial features (verified)

- **Backup is CLI-only** — no `/api/backup` route or UI button (BK2 in `SESSION_HANDOFF.md:94` never built; no such route in `app/api`).
- **No message pagination** — `getMessagesByContactId()` returns all messages (`lib/db/service.ts:173`), no `LIMIT`.
- **No automated test suite** — `@playwright/test` is a dependency (`package.json:23`) but there is **no** `playwright.config.*` and **no** `*.test.*`/`*.spec.*` file anywhere. Only ad-hoc `scripts/test-*.ts`.
- **Extension media/upload/checkout handlers exist in `background.js` but no matching UI** is confirmed in `popup`/`content` for the full PPV loop (the EXTENSION_PHASE_ROADMAP "PPV Selling Workflow" milestone is partly wired at the bridge layer only).
- **`lib/api.ts` `crmFetch()` is a no-op passthrough** (`lib/api.ts:33`) — it does **not** attach `X-API-Key`. The web client relies entirely on the session cookie set by middleware; this contradicts `PROJECT_STATUS.md` claims about a client key wrapper.

### Known limitations (verified)

- **Production storage requires Turso.** In production without `TURSO_DB_URL`, the app falls back to `/tmp/crm.db`, which is wiped on every serverless cold start. The code only logs a "FATAL" message; it **does not throw** (`lib/db/index.ts:202-210`), contradicting the comment above it (`lib/db/index.ts:12-15`).
- **DB transactions are not atomic on Turso** (production). See [Current Bugs](#current-bugs).
- **Currency mismatch**: charges are in INR (`src/lib/telegram/pollMessages.ts:217`), but the UI formats money as USD `$` (`lib/utils.ts:40-54`) and follow-up/labels use `$` thresholds (`lib/db/service.ts:1459`, `:1514`).
- **No rate limiting / no CSRF**; secrets committed to the repo (see [Security](#security)).
- Single-operator design: one Telegram session row, one global client singleton.

---

# Repository Structure

Top-level (excluding `node_modules`, `.next`, `backups/`, `restored-project/`, `uploads/`, `data/`):

## `app/` — Next.js App Router (routes + API)

- `app/page.tsx` — server component; loads chats + stats from the DB and renders `<Dashboard>`. `export const dynamic = "force-dynamic"`.
- `app/layout.tsx` — root layout, dark theme, Geist fonts, metadata title "Lustify CRM".
- `app/globals.css`, `app/error.tsx` — global styles and the React error boundary.
- `app/api/**` — 34 route files (see [API Endpoints](#api-endpoints)). Notable subtrees:
  - `app/api/telegram/*` — login, import, send, poll, remind, status, sign-out.
  - `app/api/razorpay/*` — `create-order`, `webhook`.
  - `app/api/media/*` — upload, list, get/patch/delete, `preview`, `file`.
  - `app/api/ai/suggest-reply` — AI reply generation for the dashboard/extension.
  - `app/api/{contacts,messages,notes,tags,broadcasts,reengagement,analytics,revenue,stats,followups,settings,purchases}` — CRM data.

## `lib/` — server-side libraries (the real backend)

- `lib/db/schema.ts` — `SCHEMA_SQL`: all 12 tables + 9 indexes.
- `lib/db/index.ts` — `getDb()` singleton; chooses Turso vs better-sqlite3; runs schema + (local-only) migrations; `nowIso()`.
- `lib/db/adapters.ts` — `AsyncDb` interface and two implementations: `wrapBetterSqlite3` and `createTursoAsync`. **Transaction handling differs between them** (bug; see below).
- `lib/db/service.ts` — **1668 lines**, the data-access layer: contacts, conversations, messages, purchases, media, tags, notes, broadcasts, analytics, retention, follow-ups, lead scoring, settings.
- `lib/db/mappers.ts` — row → API DTO mappers.
- `lib/db/types.ts` — DB row interfaces.
- `lib/ai/suggest-reply.ts` — OpenRouter persona, 7 funnel phases, mode prompts, `detectMode()`, fallbacks, `suggestReply()`.
- `lib/razorpay.ts` — Razorpay client singleton + `WEBHOOK_SECRET`.
- `lib/telegram/client.ts` — **dead placeholder** (`lib/telegram/client.ts:1-4`); the live client is `src/lib/telegram/client.ts`. Nothing imports the dead one (verified via grep).
- `lib/api.ts` — browser API client (fetch wrappers) used by the dashboard.
- `lib/api-error.ts` — `apiError()` / `apiOk()` JSON helpers.
- `lib/app-url.ts` — `getAppUrl()` for Razorpay callback URLs (APP_URL → VERCEL_URL → localhost).
- `lib/broadcast-filters.ts` — audience filter validation + the 6 broadcast trigger keys.
- `lib/utils.ts` — `cn()`, `formatTime()` (SQLite-date safe), `formatCurrency()` (USD).

## `src/lib/telegram/` — the active Telegram/MTProto layer

- `client.ts` — `getTelegramClient()` singleton, session loading (DB first, then `TELEGRAM_SESSION` env), proxy support, WSS.
- `auth.ts` — `sendCode`, `verifyCode`, `getLoginStatus`, `signOut`, `checkPassword` (2FA), session persistence.
- `importContacts.ts` — pulls Telegram contact list into `contacts`.
- `importMessages.ts` — `importDialogs()` + per-contact message backfill.
- `pollMessages.ts` — **the engine**: `pollIncomingMessages()`, `createPaymentLink()`, `sendLockedResponse()`, offer/intent/locked-reply logic.
- `sendMessage.ts` — `sendTelegramMessage()` with `FLOOD_WAIT` retry (3 attempts).

> Note the **`lib/` vs `src/lib/` split**: API routes import the Telegram engine from `@/src/lib/telegram/*` and the DB/AI from `@/lib/*`. The `@/*` path alias maps to repo root (`tsconfig.json:18`).

## `components/` — 34 React components (client UI)

- `components/dashboard/` — `Dashboard.tsx` (orchestrator), `TopStatsBar`, `AnalyticsModal`, `BroadcastModal`, `ReengagementModal`, `RevenueChart`, `SettingsModal`, `FollowUpSection`.
- `components/conversation/` — `ConversationView`, `ConversationHeader`, `MessageBubble`, `MessageInput` (AI generate + mode dropdown).
- `components/sidebar-left/` — chat list, search.
- `components/sidebar-right/` — profile, notes, tags, timeline, revenue, lead score, PPV.
- `components/media/` — `MediaGallery`, `UploadMediaForm`, `PurchaseHistory`.
- `components/forms/` — `CreateContactModal`, `TelegramLoginModal`, `AddTagForm`.
- `components/ui/` — `Avatar`, `Badge`, `IconButton`, `RevenueBadge`.

## `extension/` — Manifest V3 Chrome extension

- `manifest.json` — name "Lustify CRM Bridge" v0.2.0; permissions `scripting`, `storage`; host permissions `http://localhost:3000/*` and `https://web.telegram.org/*`.
- `background.js` — service worker API bridge; reads `crmBaseUrl`/`crmApiKey` from `chrome.storage.local`; `crmFetch()` adds `X-API-Key`; 18 message handlers (incl. `GET_CONTACT_MEDIA`, `UPLOAD_MEDIA`, `CREATE_MEDIA_UNLOCK_CHECKOUT`, `SEND_MESSAGE`, `GENERATE_REPLY`).
- `content.js`, `popup.html`, `popup.js`, `icons/` — sidebar injected into Telegram Web and toolbar popup.

## `scripts/` — operational/maintenance TS+JS scripts

`telegram-login.ts` (CLI login), `backup.ts` (`db.backup()`), `seed.ts` (sample data, no-op if data exists), `migrate-to-turso.ts` (copy local DB → Turso), `patch-turso.ts`, `check-turso-schema.ts`, `clear-lock.ts`, `reset-contact-sync.ts`, `trigger-poll.ts` / `test-poll.ts` (poll triggers/tests), `test-ai.ts`, `test-analytics.ts`, `simulate-webhook.ts` (HMAC webhook simulation), `verify-*.ts/js`, `exhaustive-connection-test.ts`, `generate-icons.js`, `turso-setup.ps1`.

## `types/` — shared TypeScript types

- `types/index.ts` — all API DTOs, `ConvState` (`FREE_CHAT | OFFER_SENT | PAID`), `ReplyMode` (`casual | flirty | sales | reengagement | premium | auto`).
- `types/input.d.ts` — module shim for the `input` CLI package.

## Config & root files

- `middleware.ts` — auth gate for pages + API.
- `next.config.ts` — `serverExternalPackages: ["better-sqlite3"]`, turbopack root.
- `tsconfig.json` — strict, `@/*` → root, excludes `restored-project`.
- `vercel.json` — **`{}`** (empty; no cron config — external scheduler drives the poll).
- `package.json` — scripts + deps (Node `>=20 <27`).
- `.env.example` — documented env vars (and a committed default `CRM_API_KEY`, see Security).
- `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.nvmrc` (`20`), `.npmrc`.
- `.vercel/repo.json` — Vercel project `telegram-crm`.

## Documentation / planning files (status varies; partly stale)

`README.md`, `CLAUDE.md`, `AGENT_RULES.md`, `PROJECT_STATUS.md`, `V1_RELEASE_PLAN.md`, `EXTENSION_PHASE_ROADMAP.md`, `SESSION_HANDOFF.md`, `FINAL_RELEASE_REPORT.md`, `RELEASE_TEST_PLAN.md`, `RECOVERY_NOTES.txt`. **These predate the Stripe→Razorpay and SQLite→Turso migrations and describe an older "localhost-only, no-auth" build. Do not trust them over the code.**

## Non-source artifacts in the working tree (not the application)

`restored-project/` (gitignored backup copy), `backups/`, `uploads/`, `data/crm.db*` (local DB + WAL/SHM), `telegram-crm-backup.bundle`, `extension.crx`/`.pem`, `structure.txt` (2 MB), `tree.txt`, `stash_changes.txt`, `ai_reply_diff.txt`, `Untitled-1.js/.txt`, multiple `.env.*` variants, `test.db` (0 bytes), `payment-webhook.ts` (0 bytes), empty `auth`/`auth-wal`/`help`/`help-wal` files, `dev-server*.log`.

---

# Runtime Flow

The requested flow — **Telegram → Message Processing → Conversation Engine → AI → Offer → Payment → Webhook → Unlock → Analytics** — maps to the code as follows. The orchestrator is `pollIncomingMessages()` in `src/lib/telegram/pollMessages.ts:300`.

### 1. Telegram (ingress)

A scheduler hits `GET`/`POST /api/telegram/poll` (`app/api/telegram/poll/route.ts`). Auth is enforced twice: in `middleware.ts:36-46` (CRON path) and again in the route (`poll/route.ts:13-20`) against `CRON_SECRET` (`Authorization: Bearer <secret>` or `x-cron-secret`). The route calls `pollIncomingMessages()`, logs a one-line summary, and returns the `PollSummary`. It catches fatal errors and still returns HTTP 200 with an error array (`poll/route.ts:31-44`), so the scheduler never sees a 500.

### 2. Message processing (ingestion)

Inside `pollIncomingMessages()` (`pollMessages.ts:300`):
- **Concurrency lock**: reads `settings.is_polling`; if locked and the lock is < 5 minutes old, it returns early; otherwise it overrides a stale lock (`pollMessages.ts:318-339`). Sets `is_polling=true`, clears it in `finally`.
- **Connect & validate**: `ensureConnected()` then `client.getMe()` to confirm the session is alive (`pollMessages.ts:342-345`).
- **Dialog scan**: `client.iterDialogs()`; skips non-`User`, bots, deleted, self (`pollMessages.ts:357-368`). Caps at `MAX_DIALOGS_PER_POLL = 500` and `POLL_TIMEOUT_MS = 50000` (kept under Vercel's 60s `maxDuration`).
- **Contact upsert**: unknown Telegram users become contacts via `createContactFromDialog()` → `createContact()` (also creates the `conversations` row).
- **Message fetch**: `client.iterMessages(peer, { minId: last_synced_message_id, reverse: true })`; saves only **incoming** non-empty messages via `createMessage(..., "incoming", msgId)` (idempotent on `telegram_message_id`); media-only messages are stored as text `"[Media]"` (`pollMessages.ts:437`). Advances `last_synced_message_id` per conversation.

### 3. Conversation engine (state machine)

Per saved incoming message, `recalculateLeadScore()` runs, then (only if `automatedReplies` is on) the funnel branches on `contact.conv_state` (`pollMessages.ts:452-483`):
- **`PAID`** → `sendAiReply(id, "casual")` (post-purchase chit-chat).
- **`OFFER_SENT`** → if `shouldSendLockedResponse()` (≥24h since last locked reply) → `sendLockedResponse()` (a "Premium chat is locked. Unlock here: <link>").
- **`FREE_CHAT`** → if `hasPurchaseIntent(text)` (keyword match, `pollMessages.ts:259-271`) → `sendPremiumOffer()`; otherwise `sendAiReply(id, aiMode)`.

State transitions: `OFFER_SENT` is set whenever an offer or a `[LINK]` conversion is sent; `PAID` is set when `hasUserPaid()` is true; `OFFER_SENT` reverts to `FREE_CHAT` after **7 days** (`checkOfferExpiry`, `pollMessages.ts:273-281`).

### 4. AI

`sendAiReply()` (`pollMessages.ts:172`) takes the last 20 messages and calls `suggestReply(recent, mode)` (`lib/ai/suggest-reply.ts:110`). OpenRouter (`openai/gpt-4o-mini`, `temperature 0.9`, `max_tokens 100`) returns a Hinglish reply in persona. If `OPENROUTER_API_KEY` is unset, a canned fallback is returned. The persona is instructed to emit the literal token **`[LINK]`** at the conversion phase (`suggest-reply.ts:46`).

### 5. Offer

Two offer paths produce a Razorpay link:
- **Intent path** → `sendPremiumOffer()` sends the operator `offerMessage` + the link, sets `OFFER_SENT` (`pollMessages.ts:229-235`).
- **AI conversion path** → if the AI reply contains `[LINK]`, `sendAiReply()` calls `createPaymentLink()` and substitutes the real URL before sending; on failure it strips the token so the fan never receives a dead `[LINK]` (`pollMessages.ts:184-200`).

`createPaymentLink()` (`pollMessages.ts:206`) calls `razorpay.paymentLink.create({ amount: ₹×100, currency: "INR", notes: { contactId }, callback_url: <appUrl>?checkout=success, options.checkout.name: "Nayra Premium" })` and returns `short_url`.

### 6. Payment

The fan opens the Razorpay-hosted link and pays (UPI/cards/netbanking). Razorpay redirects to `<appUrl>?checkout=success`. The dashboard treats `?checkout=success` only as a redirect target; **fulfillment is webhook-driven, not redirect-driven**.

### 7. Webhook

`POST /api/razorpay/webhook` (`app/api/razorpay/webhook/route.ts`):
- Requires `razorpay` + `WEBHOOK_SECRET` configured.
- Verifies `x-razorpay-signature` with `Razorpay.validateWebhookSignature()` (`webhook/route.ts:20`).
- Handles `event === "payment_link.paid"`. Extracts `contactId`/`mediaId` from `payment_link.notes`, `amount_paid`, `payment.id`.
- **Idempotency**: skips if a purchase note already contains `razorpay_payment:{paymentId}` (`webhook/route.ts:50-53`).
- Calls `createPurchase({ ..., kind: "ppv", markPaid: true })` and `recalculateLeadScore()`.

### 8. Unlock

`createPurchase()` (`lib/db/service.ts:515`) inserts the purchase and, in one DB transaction, updates the contact: `total_spent += amount`, `revenue += amount`, `last_purchase_date`, `ppv_count += 1` (for `ppv`), and (because `markPaid`) `conv_state = 'PAID'`. For media unlocks the purchase note is `media_unlock:{mediaId}:razorpay_payment:{id}`; `isMediaUnlocked()` (`service.ts:1579`) matches that prefix so `GET /api/media/[id]/file` and `/preview` serve the original instead of the blurred copy. A best-effort Telegram confirmation message is then sent (`webhook/route.ts:74-81`).

### 9. Analytics

Purchases/messages/contacts feed the analytics layer in `lib/db/service.ts`: `getAnalytics()` (overview, VIP/status breakdowns, fan-score stats, most-active, inactive, recent purchasers, retention, campaign summary), `getRevenueData()`, `getPpvStats()`, `getDashboardStats()`, `getTimeline()`. These surface through `/api/analytics`, `/api/revenue`, `/api/purchases/ppv`, `/api/stats`, and the dashboard modals.

### Reminder sub-flow (parallel cron)

`GET`/`POST /api/telegram/remind` (`app/api/telegram/remind/route.ts`) selects `OFFER_SENT` contacts whose `last_locked_response_at` is null or older than 24h and calls `sendLockedResponse()` for each. Same `CRON_SECRET` gate.

---

# Database

Two interchangeable backends behind one async interface (`AsyncDb`, `lib/db/adapters.ts`):
- **Local/dev**: `better-sqlite3` at `data/crm.db` (WAL mode, foreign keys ON).
- **Production/cloud**: **Turso** (`@libsql/client`) when `TURSO_DB_URL` is set.

Backend selection: `isTursoConfigured()` (truthy `TURSO_DB_URL`) → Turso; else better-sqlite3 at `DB_PATH` (`/tmp/crm.db` in production, `data/crm.db` otherwise) (`lib/db/index.ts:16-19, 199-235`). The singleton is cached on `global.__crmDb`.

## Tables (12) — from `lib/db/schema.ts`

| Table | Key columns | Purpose |
|---|---|---|
| `contacts` | `id` PK; `telegram_id` UNIQUE; `telegram_access_hash`; `name`, `username`, `avatar`, `avatar_color`; `revenue`, `total_spent`, `revenue_trend`; `lead_score`, `lead_status`; `ppv_count`; `vip_level`, `fan_status`, `fan_score`; `last_purchase_date`; `offer_sent`, `conv_state`, `offer_sent_at`, `last_locked_response_at`; `is_online`; `created_at`, `updated_at` | Fans + funnel/CRM state |
| `conversations` | `id` PK; `contact_id` UNIQUE FK→contacts (ON DELETE CASCADE); `last_message`, `last_message_time`, `unread_count`, `is_pinned`, `last_synced_message_id` | One row per contact; sync cursor |
| `messages` | `id` PK; `conversation_id` FK→conversations (CASCADE); `text`; `direction` CHECK(`incoming`/`outgoing`); `is_read`; `telegram_message_id`; `created_at` | Message log |
| `tags` | `id` PK; `contact_id` FK (CASCADE); `name`; UNIQUE(`contact_id`,`name`) | Labels |
| `notes` | `id` PK; `contact_id` FK (CASCADE); `content`; timestamps | Free-text notes |
| `telegram_sessions` | `id` PK; `session_string`; timestamps | MTProto session (plaintext) |
| `purchases` | `id` PK; `contact_id` FK (CASCADE); `amount`; `purchase_date`; `note`; `kind` (default `ppv`); `created_at` | Revenue/unlock records |
| `media` | `id` PK; `contact_id` FK (CASCADE); `filename`, `original_name`, `mime_type`, `file_size`, `price`; `created_at` | PPV media metadata |
| `tag_events` | `id` PK; `contact_id` FK (CASCADE); `tag_name`; `event_type` CHECK(`added`/`removed`); `created_at` | Tag history for timeline |
| `broadcasts` | `id` PK; `name`, `message`, `recipient_count`, `sent_count`, `trigger`, `created_at` | Broadcast/campaign history |
| `telegram_pending_codes` | `phone` PK; `phone_code_hash`; `created_at` | In-flight login code hashes |
| `settings` | `key` PK; `value` (JSON string); `updated_at` | Operator settings + `is_polling` lock |

## Relationships

`contacts (1)→(1) conversations` (UNIQUE `contact_id`); `conversations (1)→(N) messages`; `contacts (1)→(N)` each of `tags`, `notes`, `purchases`, `media`, `tag_events`. All child tables cascade-delete with the contact. There is **no** foreign key from `media`/`purchases` to a product catalog — PPV linkage is encoded in the purchase `note` string (`media_unlock:{mediaId}:...`).

## Indexes

**Created on every backend** (in `SCHEMA_SQL`, `schema.ts:137-145`): `idx_messages_conversation`, `idx_tags_contact`, `idx_notes_contact`, `idx_purchases_contact`, `idx_purchases_contact_kind`, `idx_media_contact`, `idx_tag_events_contact`, `idx_broadcasts_created_at`, `idx_broadcasts_trigger_created_at`.

**Created only on better-sqlite3** (inside `migrateBetterSqlite3()`, `lib/db/index.ts:171-173`): `idx_purchases_purchase_date`, `idx_contacts_created_at`, `idx_contacts_last_purchase_date`.

> **Verified gap:** those last three indexes are added only in the better-sqlite3 migration path. Turso (production) only runs `SCHEMA_SQL`, so **production is missing `idx_purchases_purchase_date`, `idx_contacts_created_at`, `idx_contacts_last_purchase_date`** — exactly the columns used by revenue/retention/recent-purchaser queries.

## Constraints

- `messages.direction` and `tag_events.event_type` are CHECK-constrained.
- `contacts.telegram_id` UNIQUE; `conversations.contact_id` UNIQUE; `tags(contact_id,name)` UNIQUE.
- `purchases` has **no** unique constraint on `note`; webhook idempotency is enforced by a `SELECT … note LIKE` check, not the schema (non-atomic; see Bugs).

## Migrations

Only the **better-sqlite3** path runs `migrateBetterSqlite3()` (`lib/db/index.ts:32-193`): additive `ALTER TABLE`s, table creation guards, a one-time `ppv_count` backfill, and a `settings.json → settings` table migration. **Turso has no migration runner** — it runs `SCHEMA_SQL` once if `contacts`+`settings` are absent (`lib/db/index.ts:216-221`). Schema changes therefore reach production only by editing `SCHEMA_SQL` and re-provisioning, or via `scripts/patch-turso.ts` / `migrate-to-turso.ts`.

## Current usage

Local dev DB is present (`data/crm.db`, 144 KB). Production data lives in Turso when configured.

## Future considerations (evidence-based)

- Add the three missing indexes to `SCHEMA_SQL` so production gets them.
- Add a real migration mechanism for Turso (currently create-once only).
- Consider encrypting `telegram_sessions.session_string` (stored plaintext).
- Add a UNIQUE constraint or atomic upsert for purchase idempotency.

---

# API Endpoints

All routes are Next.js App Router handlers under `app/api`. Unless noted, they are gated by `middleware.ts` requiring the CRM session cookie or `x-api-key` header. Errors generally return `{ error }` JSON via `lib/api-error.ts` or inline `NextResponse.json`.

### Telegram — session & sync

| Route | Methods | Purpose | Inputs | Outputs | Calls | Errors |
|---|---|---|---|---|---|---|
| `/api/telegram/send-code` | POST | Start login; sends Telegram code | `{ phone }` | `{ isCodeViaApp }` | `auth.sendCode` | 400 missing phone; 500 `SEND_CODE_FAILED` |
| `/api/telegram/verify-code` | POST | Verify login code | `{ phone, code }` | `{ success }` or `{ needs2fa, error }` (200) | `auth.verifyCode` | 500 `VERIFY_CODE_FAILED` |
| `/api/telegram/verify-password` | POST | Submit 2FA password | `{ password }` | `{ success }` | `auth.checkPassword` | 500 `PASSWORD_FAILED` |
| `/api/telegram/status` | GET | Auth/session status | — | `{ authenticated, reason, account, phone }` | `auth.getLoginStatus` | 500 `STATUS_FAILED` |
| `/api/telegram/sign-out` | GET, POST | Logout + clear session | — | `{ success }` | `auth.signOut` | 500 `SIGN_OUT_FAILED` |
| `/api/telegram/import/contacts` | POST | Import contact list | — | `{ total, imported, skipped }` | `importContacts` | 500 `IMPORT_FAILED` |
| `/api/telegram/import/messages` | POST | Backfill messages | — | `{ contactsProcessed, contactsCreated, messagesImported, messagesSkipped }` | `importMessages` | 500 `MESSAGE_SYNC_FAILED` |
| `/api/telegram/send` | POST | Send a Telegram message | `{ contactId, text }` | saved `Message` (201) | `sendTelegramMessage` | 400 invalid; 500 `SEND_FAILED` |

### Telegram — engine (cron-gated by `CRON_SECRET`)

| Route | Methods | Purpose | Inputs | Outputs | Notes |
|---|---|---|---|---|---|
| `/api/telegram/poll` | GET, POST | Run the whole engine | header `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` | `PollSummary` | `maxDuration=60`, `force-dynamic`; returns 200 even on fatal error |
| `/api/telegram/remind` | GET, POST | Re-send locked reminders to `OFFER_SENT` >24h | same auth | `{ reminded, results[] }` | `maxDuration=60` |

### Payments (Razorpay)

| Route | Methods | Purpose | Inputs | Outputs | Errors |
|---|---|---|---|---|---|
| `/api/razorpay/create-order` | POST | Create a payment link (optionally for media) | `{ contactId, amount, mediaId? }` | `{ paymentLinkUrl, paymentLinkId }` | 400 invalid id/amount; 404 media; 500 |
| `/api/razorpay/webhook` | POST | Fulfill `payment_link.paid` | raw body + `x-razorpay-signature` | `{ received: true }` | 400 missing/invalid signature; 404 unknown contact; 500 if unconfigured. **Public** (HMAC-verified) |

### Contacts / messages / notes / tags

| Route | Methods | Purpose | Key I/O |
|---|---|---|---|
| `/api/contacts` | GET, POST | List chats / create contact | GET → `Chat[]`; POST `{ name, username, … }` → `ContactProfile` |
| `/api/contacts/[id]` | GET, PATCH, DELETE | Read / update / delete contact | PATCH whitelisted fields; DELETE cascades |
| `/api/contacts/[id]/messages` | GET | Messages for a contact; **marks incoming as read on fetch** (`service.ts:180-188`) | `Message[]` |
| `/api/contacts/[id]/timeline` | GET | Unified activity timeline | `TimelineEvent[]`; `limit` 1–500 |
| `/api/messages` | POST | Create a message (DB only, no Telegram) | `{ contactId, text, direction? }` |
| `/api/notes` | POST | Add note → returns updated profile | `{ contactId, content }` |
| `/api/tags` | POST, DELETE | Add/remove tag (records `tag_events`) | `{ contactId, name }` |

### Media (PPV)

| Route | Methods | Purpose | Notes |
|---|---|---|---|
| `/api/media/upload` | POST (multipart) | Upload file; MIME-whitelisted; `MAX_UPLOAD_SIZE` (default 100 MB); generates blurred preview via sharp for images | 413 too large, 415 unsupported type |
| `/api/media?contactId=` | GET | List a contact's media | — |
| `/api/media/[id]` | GET, PATCH, DELETE | Get / set price / delete (also unlinks file) | — |
| `/api/media/[id]/preview?contactId=` | GET | Returns **blurred** preview if locked, original if unlocked; 403 if locked with no preview | unlock via `isMediaUnlocked` |
| `/api/media/[id]/file?contactId=` | GET | Serves original; **requires `contactId`**; 403 if locked | — |

> Media routes are **not** in `middleware.ts` `PUBLIC_PATHS`, so they require the CRM session/key. (This contradicts older docs and `EXTENSION_PHASE_ROADMAP.md` calling preview "public/no-auth".) Same-origin `<img>` tags from the dashboard work because the browser sends the session cookie.

### AI

| Route | Methods | Purpose | I/O |
|---|---|---|---|
| `/api/ai/suggest-reply` | POST | Generate a persona reply for a contact | `{ contactId, mode? }` → `{ suggestion }`; 404 if no messages; 500 if `OPENROUTER_API_KEY` unset |

### Analytics / revenue / campaigns / settings

| Route | Methods | Purpose |
|---|---|---|
| `/api/analytics` | GET | Full analytics bundle (`getAnalytics`) |
| `/api/stats` | GET | Dashboard header stats |
| `/api/revenue?months=&limit=` | GET | Monthly revenue + top spenders |
| `/api/purchases/ppv?limit=` | GET | PPV stats + top buyers (**GET only — no manual PPV creation endpoint**) |
| `/api/followups?limit=` | GET | 6 follow-up smart lists |
| `/api/broadcasts` | GET, POST | History / send filtered broadcast (1s throttle, in-flight lock) |
| `/api/broadcasts/audience` | POST | Preview audience count for filters |
| `/api/reengagement/audiences` | GET | Counts per segment |
| `/api/reengagement/send` | POST | Send campaign to a segment; `{name}` token personalization; 1s throttle; per-segment lock |
| `/api/settings` | GET, POST | Read/update `offerPrice`, `offerMessage`, `aiMode`, `automatedReplies` (validated) |

### Used by

- Dashboard (`lib/api.ts` wrappers) → most CRM/analytics/media routes.
- Extension (`extension/background.js`) → `contacts`, `followups`, `reengagement`, `tags`, `notes`, `telegram/send`, `ai/suggest-reply`, `media`, `razorpay/create-order`, `contacts/[id]/{messages,timeline}`.
- External scheduler → `telegram/poll`, `telegram/remind`.
- Razorpay → `razorpay/webhook`.

---

# Conversation Engine

The engine is `pollIncomingMessages()` (`src/lib/telegram/pollMessages.ts`) plus the AI persona (`lib/ai/suggest-reply.ts`). It is **poll-driven**, not webhook/event-driven: it only acts when the poll cron runs.

## Conversation states

`contacts.conv_state` ∈ `FREE_CHAT` (default) | `OFFER_SENT` | `PAID` (`types/index.ts:328`). Transitions:
- `FREE_CHAT → OFFER_SENT`: an offer was sent (intent path) or the AI emitted `[LINK]` (conversion path). `offer_sent=1`, `offer_sent_at=now` (`setConvState`, `pollMessages.ts:111-129`).
- `* → PAID`: `hasUserPaid()` true during poll, or `createPurchase({ markPaid: true })` from the webhook.
- `OFFER_SENT → FREE_CHAT`: after 7 days (`checkOfferExpiry`).

## Intent detection

Two independent keyword detectors:
- `hasPurchaseIntent(text)` in the poll (`pollMessages.ts:259-271`): buy, price, cost, pay, payment, premium, vip, exclusive, subscription, membership, unlock, join, link, how much, kitna, kitne, video, content. A hit routes straight to `sendPremiumOffer()`.
- `detectMode(messages)` in the AI (`suggest-reply.ts:83-96`): sales words → `sales`; "intent" words (more, see, show, video, photo, pic, private, secret, nude, sexy, hot) → `flirty`; else `casual`. Used only when `aiMode === "auto"`.

> **Verified interaction:** `detectMode`'s sales words are a subset of `hasPurchaseIntent`'s keywords, so in `auto` mode the poll almost always sends the clean offer **before** the AI would ever reach the `[LINK]` conversion phase. The `[LINK]` substitution path is mainly reachable when the operator sets `aiMode` explicitly to `sales`/`premium`.

## Offer logic

- Offer price/message come from `settings` (`getOfferSettings`, `pollMessages.ts:131-139`); defaults ₹499 and a fixed promo message.
- `sendPremiumOffer()` sends `offerMessage` + `👉 <razorpay link>` and sets `OFFER_SENT`.
- `createPaymentLink()` builds an INR Razorpay link branded "Nayra Premium", `notes.contactId` for webhook correlation.
- AI `[LINK]` token is replaced with a real link inline; on failure the token is stripped and a soft nudge is sent (never a dead placeholder).

## Reminder logic

- During poll, an `OFFER_SENT` contact that messages again gets a `sendLockedResponse()` only if ≥24h since `last_locked_response_at` (`shouldSendLockedResponse`, `pollMessages.ts:249-257`).
- The standalone `/api/telegram/remind` cron proactively re-pings all `OFFER_SENT` contacts overdue by 24h.

## Restriction logic

- Once `OFFER_SENT`, free AI conversation stops; the fan receives only locked-unlock prompts until they pay (`PAID`) or the offer expires (7 days → back to `FREE_CHAT`).
- `PAID` fans get casual AI replies again (no more selling in-loop).
- Media access is gated by `isMediaUnlocked()`; locked media serves a blurred preview or 403.

## Memory

- "Memory" = the last 20 messages from the DB passed to the model (`sendAiReply` → `getMessagesByContactId` → `slice(-20)`), and inside the prompt the transcript is further trimmed to the last 10 (`buildTranscript`, `suggest-reply.ts:74-81`). There is **no** vector store, summary memory, or per-contact persona memory beyond raw recent messages and `conv_state`.
- Funnel "phase" in `auto` mode is derived purely from the **count of incoming messages** (`suggest-reply.ts:124-139`): >6 → offer, >4 → interest, >2 → rapport, else first-contact.

## Weaknesses (evidence-backed)

- **One reply per incoming message**: replies are sent inside the per-message loop (`pollMessages.ts:442-483`), so a fan sending several messages between polls receives several AI replies — potentially spammy/unnatural.
- **No de-duplication of model output**: the prompt asks the model "NEVER repeat what you just said" (`suggest-reply.ts:146`) but nothing enforces it; repeated phrasing is possible.
- **Phase is count-based, not semantic** in auto mode; a long chat auto-escalates to "offer" regardless of fan sentiment.
- **Hard-coded English locked-response copy** (`pollMessages.ts:240`) breaks the Hinglish persona.
- **No FLOOD_WAIT awareness at the engine level** beyond the per-send retry in `sendMessage.ts`; a large catch-up poll can still hit rate limits.
- **`[LINK]` reliance**: conversion depends on the model reliably emitting an exact token; if the model paraphrases it, no link is sent (the code only substitutes the exact `[LINK]`).
- **Lead-score amount tier assumes USD** (`Math.floor(total/10)`, `service.ts:1625`) while amounts are INR — score weighting is skewed.

---

# Payment Flow

## Payment lifecycle (exact)

1. **Link creation** — `createPaymentLink(contactId, amount?)` (`pollMessages.ts:206`) or `POST /api/razorpay/create-order` (`create-order/route.ts`). Amount = override → `settings.offerPrice` (engine) or request `amount`/media `price` (route). Razorpay `paymentLink.create` with `amount = round(rupees*100)` paise, `currency INR`, `description "Nayra Premium Unlock"`, `notes { contactId, mediaId? }`, `callback_url <appUrl>?checkout=success`, `options.checkout.name "Nayra Premium"`. Returns `short_url`.
2. **Delivery** — link is sent to the fan over Telegram (engine) or returned to the dashboard/extension (route).
3. **Payment** — handled entirely on Razorpay's hosted page.
4. **Redirect** — `callback_url` returns the fan to the dashboard with `?checkout=success` (cosmetic only).

## Webhook lifecycle (exact)

`POST /api/razorpay/webhook`:
1. Guard: `razorpay` and `WEBHOOK_SECRET` must be set (else 500).
2. Read raw body + `x-razorpay-signature`; missing signature → 400.
3. `Razorpay.validateWebhookSignature(body, signature, WEBHOOK_SECRET)`; invalid → 400.
4. Parse JSON; act only on `event === "payment_link.paid"`.
5. Pull `contactId`/`mediaId` from `payment_link.notes`, `amount_paid` (paise), `payment.id`.
6. Verify the contact exists (else 404).
7. Build note: `media_unlock:{mediaId}:razorpay_payment:{paymentId}` or `razorpay_payment:{paymentId}`.
8. **Idempotency check**: `SELECT id FROM purchases WHERE note LIKE '%razorpay_payment:{paymentId}%'`; if found, do nothing.
9. Else `createPurchase({ amount: paise/100, kind: "ppv", note, markPaid: true })` + `recalculateLeadScore`.
10. Best-effort Telegram confirmation message (failure logged, never fails the webhook).
11. Return `{ received: true }` (200). Top-level errors → 400.

## Unlock lifecycle

`createPurchase()` (`service.ts:515`) in one transaction: insert purchase; `total_spent += amount`, `revenue += amount`, `last_purchase_date = MAX(...)`, `updated_at`; `+ ppv_count` when `kind='ppv'`; `+ conv_state='PAID'` when `markPaid`. Media unlock then resolves via `isMediaUnlocked(mediaId, contactId)` (note-prefix match), which flips `/api/media/[id]/file` and `/preview` from blurred/403 to original.

## Failure recovery (verified behavior)

- **Duplicate webhooks**: handled by the note-LIKE idempotency check (but **not atomic** — two truly concurrent deliveries could both pass the check; see Bugs).
- **Telegram confirmation failure**: swallowed; payment still recorded.
- **Link creation failure in the AI path**: token stripped, soft nudge sent, error logged (`pollMessages.ts:191-199`).
- **Razorpay not configured**: `razorpay` is `null` → `createPaymentLink` throws "Razorpay not configured"; webhook returns 500.
- **No reconciliation job**: if a webhook is missed entirely, there is no polling of Razorpay to recover the payment — the fan stays `OFFER_SENT` and would receive locked reminders despite having paid.

---

# Telegram

Implemented with GramJS (`telegram` 2.26.22) over MTProto in `src/lib/telegram/`.

## Authentication

- API identity from `TELEGRAM_API_ID` + `TELEGRAM_API_HASH` (`client.ts:30-42`).
- **Interactive login** (dashboard): `sendCode(phone)` stores `phone_code_hash` in `telegram_pending_codes`; `verifyCode(phone, code)` calls `Api.auth.SignIn`, deletes the pending row, saves the session string to `telegram_sessions`; 2FA via `checkPassword(password)` (`client.auth.signInWithPassword`). `SESSION_PASSWORD_NEEDED` is surfaced as "Two-factor authentication is enabled" and the verify-code route returns `needs2fa` with HTTP 200.
- **CLI login**: `scripts/telegram-login.ts` uses `client.start()` and prints the session string.
- **Status**: `getLoginStatus()` connects a short-lived client and calls `getMe()`.
- **Session source priority**: DB `telegram_sessions` first, then `TELEGRAM_SESSION` env (`client.ts:11-27`).

## Polling

- `pollIncomingMessages()` via `iterDialogs()` + `iterMessages()`; cursor is `conversations.last_synced_message_id`. Caps: 500 dialogs, 50s. Concurrency guarded by the `settings.is_polling` lock with a 5-minute stale override. Not event-based — depends on an external scheduler.

## Message sending

- `sendTelegramMessage(contactId, text)` (`sendMessage.ts`): builds `InputPeerUser` from `telegram_id`+`telegram_access_hash`, sends, then persists via `createMessage(..., "outgoing", id)`.
- **FLOOD_WAIT handling**: detects `FloodWaitError`/`FLOOD_WAIT`, sleeps the indicated seconds (or `2^attempt`), retries up to 3 times (`sendMessage.ts:10, 57-92`). Broadcasts/re-engagement inherit this and add a 1s inter-send `sleep`.

## Session management

- Singleton `global.__telegramClient`, keyed by the active session string; recreated when the session changes (`client.ts:85-103`). `signOut()` invokes `Api.auth.LogOut()`, disconnects, clears the singleton, and deletes `telegram_sessions`.
- Proxy support: SOCKS5 / MTProxy / HTTP via `TELEGRAM_PROXY_*`; `useWSS` defaults true (`client.ts:44-78`).

## Error recovery

- `ensureConnected()` reconnects before each operation.
- Poll wraps per-contact iteration in try/catch and accumulates `summary.errors[]` rather than aborting the whole run.
- Import flows return structured summaries; on auth failure (`AUTH_KEY_UNREGISTERED`, revoked session) the operator must re-login.

---

# OpenRouter

AI lives in `lib/ai/suggest-reply.ts`.

## Models

- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (`suggest-reply.ts:3`).
- Model: **`openai/gpt-4o-mini`** (`suggest-reply.ts:4`).
- Params: `max_tokens: 100`, `temperature: 0.9` (`suggest-reply.ts:163-164`).
- Auth: `Authorization: Bearer ${OPENROUTER_API_KEY}`.

## Prompt flow

- **System prompt** = persona (`SYSTEM_PERSONA`) + a phase block. Phases `PHASE_1_FIRST_CONTACT … PHASE_7_CONVERSION` (`suggest-reply.ts:18-47`).
- **Mode selection** (`suggestReply`, `suggest-reply.ts:110`):
  - `mode !== "auto"` → `MODE_PROMPTS[mode]` (`casual/flirty/sales/reengagement/premium`).
  - `mode === "auto"` → `detectMode` returns `sales` → PHASE_7; otherwise phase by incoming-message count (>6 offer, >4 interest, >2 rapport, else first-contact).
- **User prompt** = the last-10-message transcript ("Fan:"/"Nayra:") + instructions to reply in Hinglish and not repeat; first-contact has a dedicated opener prompt.
- The `premium`/PHASE_7 prompt forces the literal `[LINK]` token into the output.

## Response handling

- Reads `choices[0].message.content`; trims; strips leading `Nayra:`/`Nayra -` prefixes (`suggest-reply.ts:179-182`).
- The engine then performs `[LINK]` → real-URL substitution downstream.

## Retries

- `fetchWithRetry`: one retry on any error/empty response, then falls back to a canned reply (`suggest-reply.ts:149-190`).

## Failures

- No `OPENROUTER_API_KEY` → immediate canned fallback from `FALLBACKS` (`suggest-reply.ts:98-117`); the dashboard route instead returns **500** "OPENROUTER_API_KEY is not configured" (`ai/suggest-reply/route.ts:14-16`) — i.e., the **engine degrades gracefully but the manual UI hard-fails** when the key is missing.
- Non-2xx OpenRouter responses throw and are caught by the retry/fallback path.

---

# Deployment

## Local

- `npm run dev` → `next dev -H 127.0.0.1 -p 3000` (loopback). `npm run dev:lan` binds `0.0.0.0`. `npm run build` / `start` for production build. Node 20 (`.nvmrc`, `package.json:18-20`). `postinstall` runs `scripts/verify-sqlite.js`.
- DB: `data/crm.db` (better-sqlite3, WAL). Login via `npm run telegram:login` or the dashboard modal.

## Production / Vercel

- Vercel project `telegram-crm` (`.vercel/repo.json`). `next.config.ts` marks `better-sqlite3` as an external server package.
- **Turso is required** in production (`TURSO_DB_URL` + `TURSO_DB_TOKEN`); otherwise data falls to ephemeral `/tmp/crm.db`. The startup guard only logs (does not throw), so misconfiguration fails silently.
- `vercel.json` is **empty `{}`** — no Vercel Cron. The most recent commits explicitly removed per-minute crons as Hobby-incompatible; the engine is driven by an **external scheduler** POSTing to `/api/telegram/poll` (and `/api/telegram/remind`) with the `CRON_SECRET`.

## Turso

- Provisioned out-of-band; schema applied once by `getDb()` or by `scripts/migrate-to-turso.ts` (copies all tables from local SQLite → Turso with row-count verification) / `scripts/patch-turso.ts`.

## Scheduler

- Any external scheduler (cron, GitHub Actions, uptime pinger, etc.) calling `/api/telegram/poll` with `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`. Poll self-caps at ~50s to fit the 60s function limit.

## Environment variables (names + roles only; values never shown)

- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — MTProto app identity (required).
- `TELEGRAM_SESSION` — optional fallback session string (DB session takes priority).
- `TELEGRAM_PROXY_HOST/PORT/TYPE/USER/PASS/SECRET`, `TELEGRAM_USE_WSS` — optional proxy/transport.
- `OPENROUTER_API_KEY` — AI replies (engine falls back if absent; manual route 500s).
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — payment links (null client if absent).
- `RAZORPAY_WEBHOOK_SECRET` — webhook HMAC verification.
- `CRM_API_KEY` — dashboard/extension auth (middleware).
- `CRON_SECRET` — poll/remind auth (middleware + routes).
- `APP_URL` / `VERCEL_URL` — Razorpay callback base URL.
- `MAX_UPLOAD_SIZE` — media upload cap (default 100 MB).
- `TURSO_DB_URL`, `TURSO_DB_TOKEN` — production database.
- `NODE_ENV` — selects DB path/backend behavior.
- `OFFER_PRICE` — **documented but NOT read by the app** (`.env.example:55-58`); the offer price lives in the `settings` table.

---

# Security

## Authentication

- **Dashboard & most API routes**: `middleware.ts` requires either the `crm_session` httpOnly cookie or an `x-api-key` header equal to `CRM_API_KEY`. Login flow: visiting `?key=<CRM_API_KEY>` sets the cookie (30-day, `secure` in prod) and redirects with the key stripped from the URL. If `CRM_API_KEY` is unset, protected routes return **500** (fail-closed).
- **Cron routes** (`/api/telegram/poll`, `/api/telegram/remind`): require `CRON_SECRET` (Bearer or `x-cron-secret`); enforced in middleware **and** the routes.
- **Webhook** (`/api/razorpay/webhook`): the only `PUBLIC_PATH`; authenticated per-request by Razorpay HMAC signature.
- **Extension**: stores `crmApiKey` in `chrome.storage.local` and sends it as `X-API-Key`.

## Secrets

- Provided via env (`.env*`, all gitignored except `.env.example`). `telegram_sessions.session_string` is stored **plaintext** in the DB; backups therefore contain a live session.

## Permissions

- Dev binds to loopback by default; `:lan` variants bind `0.0.0.0`. Extension host permissions limited to `localhost:3000` and `web.telegram.org`. Media file/preview routes require auth and per-media unlock.

## Known risks (verified)

1. **Committed credentials**:
   - `.env.example:40` ships a real-looking default `CRM_API_KEY=16be7932a405cf8d` (16 hex chars — below the "≥32" the same file recommends).
   - `scripts/simulate-webhook.ts:7-8` hardcodes `WEBHOOK_SECRET = "velvet_webhook_2026"` and `CRM_API_KEY = "16be7932a405cf8d"`.
   These must be rotated and removed from source.
2. **Plaintext Telegram session** in SQLite/Turso and in every backup → full account takeover if leaked.
3. **No throttling / brute-force protection** on the `?key=` login or API key header.
4. **Ephemeral-DB silent failure** in production without Turso (data + session loss on cold start; only logged, not blocked).
5. **`:lan` mode** exposes the API on the LAN protected only by the API key over plaintext HTTP.
6. **Many `.env.*` variants** in the working tree (`.env.prod-actual`, `.env.turso-prod`, `.env.vercel.prod`, etc.) risk real secrets sitting on disk; all are gitignored but present locally.
7. **Non-atomic webhook idempotency** allows a small double-credit window under concurrent deliveries.

---

# Testing

## Existing tests

- **No automated test framework is wired up.** `@playwright/test` is a dependency but there is no `playwright.config.*` and no `*.test.*`/`*.spec.*` files (verified by search).
- Manual/diagnostic scripts only: `scripts/test-poll.ts`, `scripts/test-ai.ts`, `scripts/test-analytics.ts`, `scripts/exhaustive-connection-test.ts`, `scripts/verify-session.ts`, `scripts/verify-unlock.ts`, `scripts/verify-sqlite.js`, `scripts/simulate-webhook.ts`, `scripts/trigger-poll.ts`.
- "Verification" in the planning docs (`SESSION_HANDOFF.md`, `RELEASE_TEST_PLAN.md`) is **manual code-reading / build checks** (`tsc`, `lint`, `build`), not executable tests.

## Missing tests (critical paths with zero coverage)

- Webhook signature verification + idempotency (`razorpay/webhook`).
- `createPurchase` transaction correctness across **both** DB backends.
- Poll funnel state transitions (`FREE_CHAT`/`OFFER_SENT`/`PAID`, expiry).
- `[LINK]` substitution and failure stripping.
- `isMediaUnlocked` access control on `/file` and `/preview`.
- Middleware auth (cookie/header/cron/public-path).
- Telegram send FLOOD_WAIT retry.

## Critical paths (must be protected before scaling)

Money path (link → webhook → purchase → unlock), auth/middleware, and the poll engine's state machine are the highest-risk untested areas.

---

# Current Technical Debt

Evidence-backed only.

1. **Turso has no migration runner and is missing 3 indexes** — schema only applied once; `idx_purchases_purchase_date`, `idx_contacts_created_at`, `idx_contacts_last_purchase_date` are added only on better-sqlite3 (`lib/db/index.ts:171-173`).
2. **Dead/duplicate code** — `lib/telegram/client.ts` is an inert placeholder (`:1-4`); the real client is `src/lib/telegram/client.ts`. Two parallel Telegram trees (`lib/telegram` vs `src/lib/telegram`).
3. **`crmFetch()` in `lib/api.ts` is a misleading no-op** (`:33-35`) — adds no header; only works because of cookie auth. Contradicts docs.
4. **Currency model is inconsistent** — INR charged, USD displayed/threshold-ed (`lib/utils.ts:40`, `service.ts:1459/1514`, lead score `service.ts:1625`).
5. **Stale/contradictory documentation** — `README.md`, `PROJECT_STATUS.md`, `V1_RELEASE_PLAN.md`, `SESSION_HANDOFF.md` describe Stripe + SQLite + "no auth/localhost-only", none of which match the current Razorpay + Turso + middleware-auth code.
6. **Repo hygiene** — large committed artifacts (`structure.txt` 2 MB, `telegram-crm-backup.bundle`, `restored-project/`), empty stub files (`payment-webhook.ts`, `test.db`, `auth`, `help`), many `.env.*` variants, editor leftovers (`Untitled-1.*`).
7. **Engine logging is verbose/debug-grade** (e.g. `[BG] SEND_MESSAGE …` in `extension/background.js`, exhaustive `[IMPORT]` logs) — not production-clean.
8. **No pagination** on messages (`service.ts:173`) — unbounded reads on large conversations.
9. **`recalculateLeadScore`/analytics run per-message inside the poll loop**, adding DB round-trips proportional to message volume.

---

# Current Bugs

Verified, with evidence, likely cause, and priority.

### BUG-1 — DB transactions are not atomic on Turso (production) — **HIGH**
- **Evidence**: `lib/db/adapters.ts:106-118`. `transaction()` opens `tx = await client.transaction("write")`, but every statement issued inside the callback runs through `prepare().run()` → `client.execute()` (autocommit, `:87-101`), **not** `tx.execute`. The empty `tx` is committed/rolled back with no statements attached.
- **Impact**: Multi-statement operations meant to be atomic (`createPurchase`, `createContact`, `createMessage`, `addTag`, `getMessagesByContactId` mark-read) are **not** atomic in production; a mid-operation failure leaves partial writes and `rollback()` undoes nothing. Local better-sqlite3 is fine (`wrapBetterSqlite3.transaction` uses real `BEGIN/COMMIT/ROLLBACK`, `:56-68`).
- **Likely cause**: the libsql adapter was written to the same signature as the sqlite one without threading the `tx` handle into statement execution.
- **Priority**: HIGH (money + state integrity on the production backend).

### BUG-2 — Production silently uses ephemeral `/tmp` DB when Turso is unconfigured — **HIGH**
- **Evidence**: `lib/db/index.ts:202-235`. The "FATAL" branch only `console.error`s, then execution **falls through** to `createRawBetterSqlite3("/tmp/crm.db")`. The comment at `:12-15` claims the app "will throw at startup"; it does not.
- **Impact**: On Vercel, all data + the Telegram session are lost on every cold start, with no startup failure to signal it.
- **Likely cause**: guard was downgraded from throw to log and never restored.
- **Priority**: HIGH (catastrophic, silent data loss).

### BUG-3 — Webhook idempotency is non-atomic (double-credit window) — **MEDIUM**
- **Evidence**: `app/api/razorpay/webhook/route.ts:50-66`. Existence check (`SELECT … note LIKE`) and `createPurchase()` are separate awaits with no unique constraint on `purchases.note`.
- **Impact**: Two concurrent identical `payment_link.paid` deliveries can both pass the check and double-insert (double revenue, double `ppv_count`). Compounded by BUG-1 on Turso.
- **Priority**: MEDIUM (Razorpay rarely sends truly simultaneous duplicates, but retries do happen).

### BUG-4 — No payment reconciliation if a webhook is missed — **MEDIUM**
- **Evidence**: fulfillment exists only in `razorpay/webhook`; nothing polls Razorpay for paid links. `?checkout=success` redirect does not record anything.
- **Impact**: A dropped/failed webhook leaves a paying fan stuck in `OFFER_SENT`, still receiving locked reminders (`/api/telegram/remind`).
- **Priority**: MEDIUM.

### BUG-5 — Multiple AI replies for burst messages — **MEDIUM**
- **Evidence**: replies are sent inside the per-message `for await` loop (`pollMessages.ts:442-483`); N new incoming messages → up to N outbound replies in one poll.
- **Impact**: Unnatural, spammy behavior; extra OpenRouter cost; higher FLOOD_WAIT risk.
- **Priority**: MEDIUM (conversation quality + cost).

### BUG-6 — Currency unit confusion across the app — **MEDIUM**
- **Evidence**: INR charged (`pollMessages.ts:217`, `create-order/route.ts:41`); USD displayed (`lib/utils.ts:40-54`); `$`-labeled rupee thresholds for "high spender ≥ $200" (`service.ts:1514`) and lead-score `total/10` tiering (`service.ts:1625`).
- **Impact**: Misleading revenue figures and mis-segmented audiences (₹200 treated as "$200" high-spender).
- **Priority**: MEDIUM (revenue reporting correctness).

### BUG-7 — Manual AI route hard-fails without `OPENROUTER_API_KEY` while the engine degrades — **LOW**
- **Evidence**: `app/api/ai/suggest-reply/route.ts:14-16` returns 500; `suggestReply()` itself would have returned a fallback.
- **Impact**: Dashboard "Generate reply" button errors instead of offering a fallback; inconsistent behavior vs. the engine.
- **Priority**: LOW.

### BUG-8 — Locked-response copy is English, breaking the Hinglish persona — **LOW**
- **Evidence**: `pollMessages.ts:240` ("Premium chat is locked. Unlock here: …").
- **Impact**: Tone/branding break for `OFFER_SENT` fans; weaker conversion.
- **Priority**: LOW.

> Note: several issues listed as "known" in `PROJECT_STATUS.md`/`SESSION_HANDOFF.md` are **already fixed** in the current code and should not be re-worked: `app/error.tsx` exists; `listChats()` loads tags in one query (no N+1, `service.ts:101-123`); the Dashboard stale-`activeChatId` deadlock is handled (`Dashboard.tsx:91-95`); FLOOD_WAIT backoff exists in `sendMessage.ts`.

---

# Missing Features

> **There is no `ROADMAP.md` in the repository** (verified). The closest planning documents are `V1_RELEASE_PLAN.md`, `EXTENSION_PHASE_ROADMAP.md`, `SESSION_HANDOFF.md`, and `PROJECT_STATUS.md`. The comparison below is against those, restricted to items **actually missing from the code**.

From `V1_RELEASE_PLAN.md` / `SESSION_HANDOFF.md`:
- **Backup API + UI (BK2)** — only the CLI (`scripts/backup.ts`) exists; no `/api/backup` route, no dashboard button. **Missing.**
- **Message pagination** — `getMessagesByContactId` still returns all rows. **Missing.**
- **Real extension icons** — `extension/icons/*` present but flagged as placeholders in the plan; not verifiable as valid here. **Likely missing.**

From `EXTENSION_PHASE_ROADMAP.md` (PPV Selling Workflow milestone):
- **Bridge handlers exist** in `background.js` (`GET_CONTACT_MEDIA`, `UPLOAD_MEDIA`, `CREATE_MEDIA_UNLOCK_CHECKOUT`) but the **end-to-end sidebar UI** (media gallery + upload form + unlock button + refresh) is not confirmed wired in `content.js`/`popup.js`. **Partially missing.**
- **AI mode selector in the extension**, **broadcast composer in the extension**, **analytics quick-view**, **revenue chart in popup**, **smart contact linking/hover cards**, **offline cache**, **multi-select bulk actions** — **Missing** (these are listed as P1–P3 gaps and have no code).

Functional gaps not in any plan but implied by the product:
- **No payment reconciliation job** (see BUG-4).
- **No automated tests** (see Testing).
- **No manual PPV/purchase recording endpoint** — purchases are created only by the webhook (`/api/purchases/ppv` is read-only).
- **No multi-account / multi-operator support** — single session row, single global client.

---

# Revenue Impact

Ranked by expected business impact, with rationale.

## High

1. **Fix BUG-2 (ephemeral prod DB) + BUG-1 (Turso non-atomic transactions).** If production runs without Turso or hits a partial write, you lose contacts, purchases, and the Telegram session — the entire revenue substrate. Nothing else matters if the data layer is unreliable. *Improves reliability, prevents lost revenue and lost sessions.*
2. **Payment reliability: webhook idempotency (BUG-3) + reconciliation (BUG-4).** These directly govern whether paid fans get unlocked and whether revenue is counted once. Missed unlocks make paying customers churn and complain; double-credits corrupt revenue. *Improves conversion trust and revenue accuracy.*
3. **Conversation quality: one-reply-per-burst (BUG-5) + Hinglish locked copy (BUG-8) + `[LINK]` robustness.** The persona is the salesperson; spammy or off-brand or link-less behavior depresses conversion on the hottest leads. *Improves conversion + repeat purchases.*

## Medium

4. **Currency correctness (BUG-6).** Wrong revenue numbers and mis-segmented "high spenders" cause bad targeting decisions and over/under-priced offers; ₹/$ confusion can mis-set the offer price. *Improves conversion targeting + reporting trust.*
5. **Missing production indexes.** As purchases/contacts grow, revenue/retention/recent-purchaser queries slow down (full scans on `purchase_date`, `created_at`, `last_purchase_date`). *Reduces operational failures at scale.*
6. **Extension PPV loop completion.** Closing the in-Telegram sell→unlock loop reduces friction at the moment of intent (the EXTENSION_PHASE_ROADMAP's own #1 ROI argument). *Improves conversion.*
7. **Automated tests on the money path.** Protects all of the above from regressions. *Reduces operational failures.*

## Low

8. **Backup API/UI, message pagination, extension polish (icons, analytics quick-view, AI mode selector), repo/log cleanup, doc rewrite.** Useful hygiene and convenience; no direct revenue lever. *Maintainability.*

---

# Suggested Execution Order

Derived from the actual repository state (current bugs first, then revenue levers, then hygiene). Each step is independently shippable.

1. **Make production storage safe.**
   - Restore the hard throw in `getDb()` when `NODE_ENV==='production'` and Turso is unconfigured (BUG-2).
   - Fix the Turso transaction adapter to execute statements on the `tx` handle, or wrap operations with libsql batch/transaction correctly (BUG-1).
   - Add the three missing indexes to `SCHEMA_SQL`.
2. **Harden the money path.**
   - Add a UNIQUE constraint (or atomic upsert) for purchase idempotency and/or wrap the webhook check+insert in a real transaction (BUG-3).
   - Add a reconciliation cron that queries Razorpay for paid links lacking a purchase and fulfills them (BUG-4).
3. **Improve conversation conversion quality.**
   - Reply once per poll per contact (batch burst messages) instead of per-message (BUG-5).
   - Localize the locked-response copy to the persona's Hinglish voice (BUG-8); make `[LINK]` substitution tolerant of paraphrase.
4. **Fix currency consistency** end-to-end (charge, display, thresholds, lead score) to INR (BUG-6); align `formatCurrency`, follow-up thresholds, and lead scoring.
5. **Add automated tests** for webhook, purchase/unlock, poll state machine, and middleware (the critical untested paths).
6. **Complete the extension PPV loop** (gallery + upload + unlock UI on top of the existing `background.js` handlers).
7. **Secrets & hygiene**: rotate and remove the committed `CRM_API_KEY`/webhook secret, prune large artifacts and stray `.env.*`/stub files, quiet debug logging, and rewrite the stale docs (README/PROJECT_STATUS/V1_RELEASE_PLAN) to match the Razorpay + Turso + middleware-auth reality.
8. **Lower-priority polish**: backup API/UI, message pagination, extension analytics/AI-mode/icons.

---

*End of PROJECT_KNOWLEDGE.md — every claim above is traceable to a cited file and line in this repository as of branch `final-recovery`.*
