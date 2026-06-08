# Session Handoff

## Current HEAD

`feef54d` — `docs: add v1 release execution plan with 3 CRITICAL blocker analysis`

## Today's Completed Work

### S1 — Telegram sending architecture
- **Dashboard.tsx**: replaced `createMessageApi` with `sendTelegramMessageApi`
- **background.js**: changed SEND_MESSAGE URL from `/api/messages` to `/api/telegram/send`
- **Result**: CRM web UI and extension popup now send messages through Telegram API instead of DB-only

### S2 — Sidebar race condition
- **content.js**: generation-based protection for `lookupCRMContact()`
- **content.js**: stale conversation check in `refreshSidebarProfile()`
- **Result**: older async responses no longer overwrite newer sidebar state

### S3 — Cache invalidation
- **content.js**: reset `_lastKey=""` on `GET_CONTACT` API failure (sidebar retries instead of permanent skip)
- **popup.js**: clear `historyCache[contactId]` after send success and label toggle
- **popup.js**: clear `timelineCache[contactId]` after label toggle
- **Result**: sidebar and history no longer serve permanently stale data

### S4 — Runtime error handling
- **NotesSection.tsx**: added `catch` block + `error` state + visible error message
- **TagsSection.tsx**: wrapped `onAddTag`/`onDeleteTag` in try/catch with error display
- **content.js**: console.error on label toggle failure, try/catch on boot
- **popup.js**: setMessage on label toggle failure (3s auto-clear)
- **Result**: silent failures now show user-visible errors

### C1–C4 — AI Reply MVP
- **C1**: `OPENROUTER_API_KEY` in `.env.example`
- **C2**: `POST /api/ai/suggest-reply` — fetches last 20 messages, builds transcript, calls OpenRouter
- **C3**: CRM web UI `MessageInput.tsx` — Sparkles Generate Reply button
- **C4**: Extension popup `popup.js` + `background.js` — ✨ AI Generate Reply button
- **Result**: both CRM web app and extension popup can generate AI-suggested replies

### S5 — Release audit
- All 10 features verified passing (`tsc --noEmit`, `npm run lint`, `npm run build`)

## Verified Working Features

| Feature | Status | How to verify |
|---------|--------|---------------|
| Telegram send | ✅ PASS | Dashboard send → POST /api/telegram/send → client.sendMessage() |
| AI Reply (CRM web) | ✅ PASS | Sparkles button → POST /api/ai/suggest-reply → OpenRouter |
| AI Reply (popup) | ✅ PASS | ✨ AI button → GENERATE_REPLY → POST /api/ai/suggest-reply |
| Templates | ✅ PASS | popup UI: create, edit, delete, insert into sendText |
| Snippets | ✅ PASS | Type `/` trigger → dropdown → expand |
| Labels (sidebar) | ✅ PASS | Toggle via content.js sidebar |
| Labels (popup) | ✅ PASS | Toggle via popup details panel |
| Timeline | ✅ PASS | popup timeline + TimelineSection.tsx |
| Notes (sidebar) | ✅ PASS | "Add Note" action + NotesSection.tsx |
| Notes (popup) | ✅ PASS | Add note via details panel |
| Followups | ✅ PASS | content.js quick action + popup followups section |
| Sidebar | ✅ PASS | content.js lookupCRMContact with generation protection |

## Known Blockers (Release Status: BLOCKED)

### Phase 1 — Must Fix (blocks v1.0)

| Blocker | Files to create/modify | Est. checkpoints |
|---------|------------------------|-----------------|
| **Login UI** — `sendCode()`/`verifyCode()` exist but no API routes or UI. `login/route.ts` is a GET stub. 2FA/`checkPassword()` missing. | `auth.ts`, 4 new routes, `api.ts`, `TelegramLoginModal.tsx`, `Dashboard.tsx`, `TopStatsBar.tsx` | 5 (LG1→LG5) |
| **Backup** — zero backup code. `better-sqlite3.backup()` API available. | `scripts/backup.ts`, `package.json` | 1-2 (BK1-BK2) |
| **Auth middleware** — 21 unprotected API routes. Only `127.0.0.1` binding. | `middleware.ts`, `.env`, `.env.example`, `background.js` | 2 (AU1-AU2) |

### Phase 2 — Polish
- FLOOD_WAIT backoff in broadcasts/reengagement (~30 lines)
- Real extension icons (~3 files)
- Dashboard "Loading..." deadlock on stale `activeChatId` (~10 lines)

### Phase 3 — Post-v1
- Message pagination
- N+1 tags query in listChats
- app/error.tsx error boundary

## Tomorrow's Plan

### Recommended execution order

```
BK1 (Backup CLI)          → 25 lines, independent, quick win
  ↓
LG1→LG5 (Full Login UI)  → ~250 lines, most complex, needs iteration
  ↓
AU1→AU2 (Auth Middleware) → layer on last so Login routes testable freely
```

### Checkpoint 1 — BK1 (Backup CLI)

**Goal:** Create a working backup CLI script.

**Files to create/modify:**
- `scripts/backup.ts` — use `getDb().backup(dest)` with progress callback
- `package.json` — add `"db:backup": "tsx scripts/backup.ts"`

**Key constraints:**
- Must use `better-sqlite3.backup()` API (not `fs.copyFile` — WAL mode unsafe)
- Create `backups/` directory with `mkdirSync({recursive:true})`
- Timestamped filenames: `crm-backup-2026-06-08T12-00-00.db`
- Add `backups/` to `.gitignore`

**First command:**
```powershell
npm run db:backup
```

### Checkpoint 2 — LG1 (Auth library additions)

**Goal:** Add missing auth library functions.

**Files to modify:**
- `src/lib/telegram/auth.ts` — add `checkPassword(password)`, `signOut()`, `getLoginStatus()`

**Key constraints:**
- `signOut()` must set `global.__telegramClient = undefined`
- `checkPassword()` must handle SRP via `client.signInWithPassword()`
- `getLoginStatus()` must check `telegram_sessions` table has a row

### Checkpoint 3 — LG2 (API routes: send-code, verify-code, status, sign-out)

**Goal:** Create 4 new API routes for Telegram auth.

**Files to create:**
- `app/api/telegram/send-code/route.ts`
- `app/api/telegram/verify-code/route.ts`
- `app/api/telegram/status/route.ts`
- `app/api/telegram/sign-out/route.ts`

**Key constraints:**
- Follow existing pattern from `app/api/telegram/send/route.ts`
- Use `apiError()`/`apiOk()` from `lib/api-error.ts`
- `verify-code` must detect 2FA (check for `SESSION_PASSWORD_NEEDED` in error)

## Working Tree

**Clean** — no uncommitted changes.

## Release Risks

| Risk | Impact | When to address |
|------|--------|----------------|
| `.env` contains plaintext `TELEGRAM_SESSION` | Credential leak if repo access | Before v1.0 — rotate if compromised |
| No TLS on LAN | API key and Telegram commands visible on network | After auth middleware — add Caddy for internet exposure |
| Extension icons are 69-byte placeholders | Extension shows broken icon in toolbar | Phase 2 — non-blocking |
| FLOOD_WAIT at ~20 broadcast recipients | Campaigns silently fail | Phase 2 — blocks large campaigns |
| In-memory `pendingCodes` lost on server restart | Login fails mid-flow if server restarts | LG1 — add DB-backed pending_codes |
| No `app/error.tsx` | React errors crash page with white screen | Phase 3 — low urgency |

## Quick Reference

```powershell
# TypeScript check
npx tsc --noEmit

# Lint
npm run lint

# Full build
npm run build

# Dev server (localhost only)
npm run dev

# Dev server (LAN accessible)
npm run dev:lan

# Existing Telegram CLI login (until login UI exists)
npm run telegram:login

# Seed database
npm run db:seed
```
