# V1 Release Plan

Current HEAD: `ed7e1e2`
Base Release: `checkpoint-23b` (d563b89)

---

## Phase 1 — Must Finish (Blocks v1.0)

### 1. Telegram Login UI

**Current state:**
- `sendCode()` and `verifyCode()` exist in `src/lib/telegram/auth.ts` but have no API routes or UI
- `app/api/telegram/login/route.ts` is a stub (GET returns `{success:true}`)
- `checkPassword()` (2FA support) and `signOut()` are missing
- `pendingCodes` Map is in-memory only — lost on server restart
- No login modal, no phone input, no code input anywhere

**Files involved:**

| File | Action |
|---|---|
| `src/lib/telegram/auth.ts` | Add `checkPassword()`, `signOut()`, `getLoginStatus()` |
| `app/api/telegram/send-code/route.ts` | **Create** — POST, calls `sendCode()` |
| `app/api/telegram/verify-code/route.ts` | **Create** — POST, calls `verifyCode()`, detects 2FA |
| `app/api/telegram/status/route.ts` | **Create** — GET, checks if session exists |
| `app/api/telegram/sign-out/route.ts` | **Create** — POST, calls `signOut()` |
| `app/api/telegram/login/route.ts` | Remove or replace — stub no longer needed |
| `lib/api.ts` | Add `telegramSendCode()`, `telegramVerifyCode()`, `telegramStatus()`, `telegramSignOut()` |
| `components/forms/TelegramLoginModal.tsx` | **Create** — 2-step form (phone → code), follows `CreateContactModal` pattern |
| `components/dashboard/TopStatsBar.tsx` | Add "Connect Telegram" button when not authenticated |
| `components/dashboard/Dashboard.tsx` | Add `authenticated` state, render `TelegramLoginModal`, import flow |

**Existing reusable code:**
- `sendCode(phone)` and `verifyCode(phone, code)` in `auth.ts` (lines 51-106)
- `getTelegramClient()` singleton in `client.ts` (line 37)
- `telegram_sessions` table in `lib/db/schema.ts` (line 72)
- `CreateContactModal.tsx` — full modal pattern (backdrop, card, Field helper, inputClass, loading/error/success)
- Post route pattern in `app/api/telegram/send/route.ts`
- `lib/api.ts` — existing `importTelegramContacts()` pattern for API client functions

**Checkpoints:**
| # | Checkpoint | Files |
|---|---|---|
| LG1 | Auth library: add `checkPassword()`, `signOut()`, `getLoginStatus()` | `auth.ts` |
| LG2 | API routes: send-code, verify-code, status, sign-out (4 routes) | 4 new route files |
| LG3 | API client functions + clean up stub login route | `lib/api.ts`, delete `login/route.ts` |
| LG4 | Login modal component (2-step form) | `TelegramLoginModal.tsx` |
| LG5 | Dashboard integration + status check on mount + Connect button | `Dashboard.tsx`, `TopStatsBar.tsx` |

**Risks:**
| Risk | Severity | Mitigation |
|---|---|---|
| In-memory `pendingCodes` lost on restart | High — breaks login mid-flow | Store `phoneCodeHash` in DB (add `pending_codes` table) |
| No 2FA/password support | High — users with 2FA blocked | Implement `checkPassword()` via `client.signInWithPassword()` |
| Session string stored plaintext in SQLite | Medium — backup files expose auth token | Encrypt session string with env key (post-v1) |
| Global client singleton not resettable | Medium — can't reconnect after disconnect | `signOut()` must set `global.__telegramClient = undefined` |

**Estimated time:** 5 checkpoints, ~250 lines

---

### 2. Backup Mechanism

**Current state:**
- Zero backup code exists anywhere
- `better-sqlite3` v11.8.1 has `.backup()` API (WAL-safe, online backup, progress callback)
- Database at `data/crm.db` with WAL journal mode (3 files: `.db`, `-wal`, `-shm`)
- Existing script pattern: `scripts/seed.ts` via `tsx`

**Files involved:**

| File | Action |
|---|---|
| `scripts/backup.ts` | **Create** — CLI script using `db.backup()`, timestamped file, progress |
| `package.json` | Add `"db:backup": "tsx scripts/backup.ts"` |
| `app/api/backup/route.ts` | **Create** (optional) — POST triggers backup, returns filename |
| `components/dashboard/Dashboard.tsx` | **Create** (optional) — "Backup" button in settings/header |
| `.gitignore` | Add `backups/` if not already present |

**Existing reusable code:**
- `getDb()` from `lib/db/index.ts`
- `db.backup(destFile, { progress })` — built into better-sqlite3
- `scripts/seed.ts` — exact pattern for a tsx script
- `"db:seed": "tsx scripts/seed.ts"` in `package.json` — template for script entry

**Checkpoints:**
| # | Checkpoint | Files |
|---|---|---|
| BK1 | CLI backup script + npm script | `scripts/backup.ts`, `package.json` |
| BK2 | (Optional) API route + UI button | `app/api/backup/route.ts`, `Dashboard.tsx` |

**Risks:**
| Risk | Severity | Mitigation |
|---|---|---|
| WAL inconsistency if using `fs.copyFile` | High — corrupted backup | **Must** use `db.backup()`, never raw file copy |
| Backup contains Telegram session | High — leaked auth token | Treat backup files as secrets; document in README |
| Disk full from unlimited backups | Low — DB is <1 MB | Add retention (keep last 10) in script |
| Dest dir doesn't exist | Low — mkdir fails | `fs.mkdirSync("backups", { recursive: true })` |

**Estimated time:** 1-2 checkpoints, ~25 lines

---

### 3. Auth Middleware

**Current state:**
- No `middleware.ts` exists — all 21 API routes are completely open
- Default `dev`/`start` scripts bind to `127.0.0.1` (localhost-only)
- LAN variants (`dev:lan`, `start:lan`) expose to `0.0.0.0` with zero auth
- Extension connects via `background.js` → `fetch()` to `localhost:3000`
- No API key configured in `.env` or `.env.example`

**Files involved:**

| File | Action |
|---|---|
| `middleware.ts` | **Create** — check `x-api-key` header on `/api/*` routes |
| `.env` | Add `CRM_API_KEY=<random-hex-string>` |
| `.env.example` | Add `# CRM_API_KEY=...` placeholder |
| `extension/background.js` | Add `crmFetch()` wrapper with `X-API-Key` header; replace all `fetch()` calls |
| `extension/manifest.json` | Update `host_permissions` if LAN is needed |

**Existing reusable code:**
- `NextResponse.json()` — for 401 response
- `request.headers.get('x-api-key')` — native Next.js middleware API

**Checkpoints:**
| # | Checkpoint | Files |
|---|---|---|
| AU1 | Middleware + env setup | `middleware.ts`, `.env`, `.env.example` |
| AU2 | Extension: add crmFetch wrapper + API key | `extension/background.js` |

**Risks:**
| Risk | Severity | Mitigation |
|---|---|---|
| Key hardcoded in extension source | Medium — anyone with file access sees it | Acceptable for personal use; use `chrome.storage.local` post-v1 |
| Plaintext HTTP on LAN | Medium — sniffable | Acceptable for personal LAN; add TLS via Caddy for internet |
| Developer convenience bypass | Low — no key = no auth | Middleware allows when `CRM_API_KEY` not set (dev mode) |
| Page route (`/`) unprotected | Low — only serves Server Component HTML | Dashboard reads DB server-side; still localhost-only |

**Estimated time:** 2 checkpoints, ~40 lines

---

### Dependencies Between Blockers

```
Login UI  ──┬── no dependency on Backup or Auth
            └── Login API routes must NOT be blocked by Auth middleware
                → middleware.ts must allow /api/telegram/* or auth is
                  configured AFTER login is fully implemented

Backup    ── no dependency on anything

Auth      ── no dependency on Login or Backup
              ├── BUT: must coordinate key with extension
              └── AND: choosing to implement Auth last means Login API
                routes are temporarily unprotected (acceptable for
                localhost-only dev)
```

**Recommended execution order:**
1. **Backup** (BK1) — smallest, independent, quickest win
2. **Login UI** (LG1→LG5) — most complex, requires iteration
3. **Auth middleware** (AU1→AU2) — last, so Login routes can be tested freely

---

## Phase 2 — Polish (Should Fix Before v1.0)

### 4. FLOOD_WAIT Handling

**Problem:** Broadcasts and reengagement campaigns fail silently at ~20+ recipients due to Telegram's `FLOOD_WAIT` rate limit with no backoff.

**Files:** `src/lib/telegram/sendMessage.ts`, `app/api/broadcasts/route.ts`, `app/api/reengagement/send/route.ts`

**Fix:** Add `FLOOD_WAIT` detection in `sendTelegramMessage()`, sleep for the indicated seconds, retry. Use exponential backoff as fallback.

**Estimated:** 1 checkpoint, ~30 lines

### 5. Extension Icons

**Problem:** Three placeholder PNGs at `extension/icons/` (69 bytes each — invalid images).

**Fix:** Generate real 16x16, 48x48, 128x128 PNG icons. Minimal: single-color SVG converted to PNG, or `canvas`-generated initials.

**Estimated:** 1 checkpoint, 3 files

### 6. Dashboard Loading Deadlock

**Problem:** If `activeChatId` points to a chat not in `chats` (stale from a delete or deep-link to a missing contact), the Dashboard shows "Loading..." permanently.

**Files:** `components/dashboard/Dashboard.tsx` (line 241-247)

**Fix:** Add a `useEffect` that checks if `activeChatId` exists in `chats` after `chats` changes; if not, select the first available chat or show the empty state.

**Estimated:** 1 checkpoint, ~10 lines

---

## Phase 3 — Post-v1 (Nice to Have)

### 7. Message Pagination

**Problem:** `getMessagesByContactId()` returns ALL messages with no LIMIT. Large conversations (thousands) degrade performance.

**Files:** `lib/db/service.ts`, `app/api/contacts/[id]/messages/route.ts`, `lib/api.ts`

**Fix:** Add `offset`/`limit` params to the query and API; add "Load more" button or infinite scroll in `ConversationView`.

### 8. N+1 Tags Query

**Problem:** `listChats()` in `lib/db/service.ts` queries tags per-contact in a loop.

**Fix:** Use a single JOIN query with `GROUP BY` to load all tags in one round trip.

### 9. Error Boundary

**Problem:** No `app/error.tsx` — React rendering errors crash the full page.

**Fix:** Create `app/error.tsx` following the Next.js convention.
