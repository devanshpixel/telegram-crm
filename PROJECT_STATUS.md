# Project Status

Current HEAD:
1d811b1

Base Release:
checkpoint-23b (d563b89)

Completed:

- Templates
- Snippets
- Labels
- Activity Timeline
- Telegram Sidebar
- Content Script
- Notes Integration
- Labels Integration
- Timeline Integration
- S1 Telegram sending architecture
- S2 Sidebar race condition
- S3 Cache invalidation
- S4 Runtime error handling
- C1 AI Reply environment
- C2 AI Reply backend
- C3 AI Reply CRM web UI
- C4 AI Reply extension popup UI
- BK1 Backup CLI
- LG1 Auth library additions (getLoginStatus, signOut, checkPassword)
- LG2 Login API routes (send-code, verify-code, status, sign-out)
- LG3 API client functions + removed login stub
- LG4 Login modal component (3-step: phone → code → 2FA)
- LG5 Dashboard integration + Connect button
- AU1 Auth middleware
- AU2 Extension API key
- P1.1 Stripe deps + env + lib/stripe.ts
- P1.2 POST /api/checkout/create-session
- P1.3 POST /api/webhooks/stripe + middleware whitelist
- P1.4 Client createCheckoutSession + CheckoutSessionResponse type
- P2.1 Media table schema + migration + types
- P2.2 Media service functions (CRUD)
- P2.3 Media upload/list/get/delete API + file serve

AI Reply MVP:
COMPLETE

Known Issues:

- ~~SEND_MESSAGE broken~~ **FIXED — S1**
- ~~Sidebar race condition~~ **FIXED — S2**
- ~~Cache invalidation~~ **FIXED — S3**
- ~~AI Reply missing~~ **FIXED — C1..C4**
- ~~Runtime error handling~~ **FIXED — S4**

Release Status:
**RELEASE CANDIDATE** — 17/17 checkpoints complete + P1.1–P1.4 (Stripe Checkout + Webhook)

Fixed:

- ~~crmFetch recursion bug~~ **FIXED** — both branches called crmFetch() instead of fetch(), causing stack overflow on every client API call
- ~~Webhook idempotency~~ **FIXED** — Stripe checkout.session.completed events processed at-least-once; now deduplicated via stripe_checkout:{sessionId} note lookup before createPurchase()

Other Known Issues:

- FLOOD_WAIT backoff missing (MEDIUM)
- Backup API/UI (BK2) — CLI exists, no one-click backup (LOW)
- Placeholder extension icons (69 bytes) (LOW)
- Dashboard "Loading..." deadlock on stale activeChatId (LOW)
- No app/error.tsx boundary (LOW)
- No pagination on messages (C29 H7) (LOW)
- N+1 tags query in listChats (C29 H2) (LOW)

Completed Priorities:

- **S1** Telegram sending — Dashboard.tsx + background.js changed to /api/telegram/send
- **S2** Sidebar race — content.js generation protection for lookupCRMContact
- **S3** Cache invalidation — _lastKey reset on API error, historyCache cleared after send/label toggle
- **S4** Runtime error handling — user-visible errors in NotesSection, TagsSection, sidebar, popup
- **C1** .env.example: OPENROUTER_API_KEY
- **C2** POST /api/ai/suggest-reply → OpenRouter (native fetch, strict prompt)
- **C3** CRM web UI: Sparkles Generate Reply button
- **C4** Extension popup: ✨ AI Generate Reply button
- **BK1** Backup CLI — scripts/backup.ts using db.backup(), WAL-safe, timestamped. Progress callback return value bug fixed (returned -1, setting rate=0 → infinite loop; now returns undefined → default rate=100)
- **LG1** Auth library — getLoginStatus(), signOut(), checkPassword() in auth.ts
- **LG2** Login API routes — send-code, verify-code, status, sign-out
- **LG3** API client functions — telegramSendCode, telegramVerifyCode, telegramStatus, telegramSignOut
- **LG4** Login modal — TelegramLoginModal.tsx with 3-step form
- **LG5** Dashboard integration — status check on mount, Connect button, auth state
- **AU1** Auth middleware — middleware.ts with X-API-Key check, login route whitelist, dev bypass
- **AU2** Extension API key — crmFetch() wrapper in background.js, CRM_KEY constant
- **P1.1** Stripe — npm install stripe, .env vars, lib/stripe.ts with server-side Stripe client
- **P1.2** Checkout — POST /api/checkout/create-session creates Stripe Checkout Session with contactId metadata
- **P1.3** Webhook — POST /api/webhooks/stripe handles checkout.session.completed, calls createPurchase(); whitelisted in middleware
- **P1.4** Client — createCheckoutSession() in lib/api.ts, CheckoutSessionResponse type
- **P2.1** Media schema — media table (contact_id, filename, original_name, mime_type, file_size, price) in schema.ts + migration + MediaRow + Media type
- **P2.2** Media service — createMedia, getMediaById, getContactMedia, updateMediaPrice, deleteMedia in lib/db/service.ts
- **P2.3** Media routes — POST /api/media/upload (multipart), GET /api/media?contactId=N, GET /api/media/[id], DELETE /api/media/[id], GET /api/media/[id]/file
- **P3.1** Sharp blur — npm install sharp, blurred `{filename}_blurred.{ext}` generated on upload for known image types
- **P3.2** Preview endpoint — GET /api/media/[id]/preview returns blurred preview (unlock checks not yet implemented)
- **P3.3** Unlock check — `isMediaUnlocked(mediaId, contactId)` queries purchases where `kind='ppv'` AND `note LIKE 'media_unlock:{mediaId}:%'` AND `contact_id=?`
- **P3.4** Unlock checkout — checkout session accepts `mediaId`, adds to Stripe metadata; webhook creates purchase with `note="media_unlock:{mediaId}:stripe_checkout:{sessionId}"`; client `createMediaUnlockCheckoutSession(contactId, mediaId, amount)`

See V1_RELEASE_PLAN.md for full execution plan.
