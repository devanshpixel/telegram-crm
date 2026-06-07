# Telegram CRM

A local-first, single-user Telegram inbox CRM with a Chrome extension for sending and managing fan conversations. Built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, **SQLite** (`better-sqlite3`), and **GramJS** (`telegram`).

- **Inbox UI** — chat list, conversation view, follow-up smart lists, broadcast composer
- **Telegram sync** — import contacts and message history from a logged-in Telegram account
- **Reengagement campaigns** — six pre-built follow-up segments with one-click send
- **Chrome extension** — contact list, search, send, history, follow-ups, and campaign launcher from any web page

This app is **localhost-only by design**. It binds to `127.0.0.1` and has no authentication. Do not expose it to a network.

---

## 1. Setup

### 1.1. Install

Requires **Node.js 20+** and **npm 10+**.

```bash
npm install
```

### 1.2. Configure environment

Copy the example file and fill in your two Telegram credentials:

```bash
cp .env.example .env
# Windows PowerShell:
# Copy-Item .env.example .env
```

Then edit `.env` and set:

- `TELEGRAM_API_ID` — numeric ID from <https://my.telegram.org/apps>
- `TELEGRAM_API_HASH` — 32-character hex string from the same page

> **Do not** put a session string in `.env`. Sessions live in the SQLite database (`telegram_sessions` table) after you complete the login flow below.

> The `.env` file is gitignored. **Never commit it.**

### 1.3. Seed the database (optional but recommended for first run)

```bash
npm run db:seed
```

This populates `data/crm.db` with sample contacts, conversations, tags, and notes. It is a no-op if the database already has data. To re-seed, delete `data/crm.db` first.

### 1.4. Run the CRM

```bash
npm run dev
```

Open <http://localhost:3000> in your browser. The server is bound to `127.0.0.1:3000` (loopback only).

> To run on your LAN (e.g. to test on a phone), use `npm run dev:lan` instead. This binds to `0.0.0.0`. Only do this on a trusted network — there is no authentication on the API.

---

## 2. Telegram API credentials

You need a Telegram "app" identity to use the API. This is free and takes about a minute.

1. Open <https://my.telegram.org/apps> in a browser.
2. Sign in with the **Telegram account that will be sending messages** (the operator account).
3. Click **"Create new application"**.
4. Fill in any app title and short name (both can be anything — they are cosmetic).
5. Click **"Create application"**.
6. On the next screen, copy the `api_id` (a number) and `api_hash` (a 32-character hex string) into your `.env` file.

> The `api_id` and `api_hash` identify **your local app** to Telegram. They are not the same as your phone number, password, or any login credentials. They are safe to share with people you would let use the app on your behalf.

---

## 3. Telegram login

The CRM is read-only without a Telegram session. To get one, run the CLI script:

```bash
npm run telegram:login
```

What happens:

1. The script prompts for your phone number in international format (`+91xxxxxxxxxx`, `+1xxxxxxxxxx`, etc.).
2. Telegram sends a login code to that Telegram account (via the Telegram app, SMS, or both, depending on your settings).
3. The script prompts for the code.
4. If the account has **two-factor authentication** enabled, the script prompts for the 2FA password.
5. On success, the script prints a session string. **The session is also written to the `telegram_sessions` table in the SQLite database** by the `verifyCode` code path, so you do not need to paste it anywhere.

> The `TELEGRAM_SESSION` line you may have seen in older setups is **not used by the app code**. Sessions are persisted in the database, not in `.env`. If your `.env` file currently contains a `TELEGRAM_SESSION` line, you can safely delete it. If you ever leak a session string publicly, **rotate it immediately** by visiting <https://my.telegram.org/apps> → *API development tools* → **"Terminate all other sessions"**, then run `npm run telegram:login` again.

After login, the CRM can:

- Read your contact list (via the **Import** button)
- Sync recent message history (via the **Sync** button)
- Send messages (via the inbox composer, broadcasts, and reengagement campaigns)
- Read receipts and typing indicators

---

## 4. Import contacts and message history

Once logged in, the CRM header has two Telegram-bound buttons:

- **Import** — pulls your full Telegram contact list into the local SQLite database. New contacts are created; existing ones (matched by `telegram_id`) are not duplicated. Shows a count of imported vs skipped.
- **Sync** — pulls recent message history for known contacts. New messages are appended; existing ones are not duplicated.

Both buttons are in the top bar of <http://localhost:3000>.

---

## 5. Chrome extension

The `extension/` directory is an unpacked **Manifest V3** Chrome extension. It reuses the CRM's local HTTP API to read contacts, view message history, send messages, run follow-up lists, and launch reengagement campaigns — without ever leaving the page you are on.

### 5.1. Install (load unpacked)

1. Run the CRM in a terminal: `npm run dev`.
2. Open Chrome and go to <chrome://extensions>.
3. Toggle **Developer mode** on (top-right).
4. Click **"Load unpacked"**.
5. Select the `extension/` directory inside this repo.
6. The extension appears in the toolbar. Click the icon to open the popup.

### 5.2. Status badge

The popup shows a green **"CRM Connected"** pill if it can reach `http://localhost:3000`, and a red **"CRM Offline"** pill otherwise. If you see red, start the CRM with `npm run dev` and reload the popup.

### 5.3. Permissions

The extension's `host_permissions` allow `http://localhost:3000/*` only. It cannot reach any other origin.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error: Missing Telegram credentials: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set` | `.env` not present, or empty | Copy `.env.example` to `.env` and fill in both values |
| `Error: Invalid TELEGRAM_API_ID: must be a numeric value` | Non-numeric value in `.env` | The `api_id` from my.telegram.org is a number like `12345678` — no quotes, no spaces |
| `npm run dev` says "Port 3000 is in use" | Another process is bound to 3000 | Stop the other process, or run `npm run dev:lan -- -p 3001` and update the extension's `CRM_BASE` in `extension/background.js:1` |
| `Extension popup shows "CRM Offline"` | CRM not running, or running on a different host/port | Start `npm run dev`; the CRM must be reachable at `http://localhost:3000` |
| Import button fails with `SESSION_PASSWORD_NEEDED` | Account has 2FA enabled and the session expired | Run `npm run telegram:login` again and enter the 2FA password when prompted |
| Import button fails with `AUTH_KEY_UNREGISTERED` | Session was revoked (other device logout, password change) | Run `npm run telegram:login` again to start a fresh session |
| `db:seed` is a no-op | Database already has data | Delete `data/crm.db` (and `data/crm.db-shm`, `data/crm.db-wal` if present) and re-run |
| `better-sqlite3` fails to install | Native binding mismatch | Run `npm run db:rebuild` |
| Broadcast to many recipients silently fails | Telegram rate-limit (`FLOOD_WAIT`) | Wait a few minutes and resend in smaller batches; the CRM does not yet implement backoff |
| `window.location.reload()` happens after import | Intended behavior — refreshes the chat list with the new data | Wait a second; the page will return |

---

## 7. Security

- **Localhost only.** The CRM is bound to `127.0.0.1` and has no authentication. Do not put it on a public network. Anyone with network access to the CRM can read all data and trigger Telegram messages from your account.
- **Never commit `.env`.** It is gitignored. If you ever push it by accident, **rotate your Telegram session immediately** (see step 3 above) and treat the `api_id` / `api_hash` as public (they are public-by-design; you can leave them, but rotate the session).
- **The SQLite database contains your Telegram session.** Back up `data/crm.db` (and the `-shm` / `-wal` siblings) regularly. Anyone with all three files can reuse your session.
- **The extension runs on `localhost:3000` only.** Its `host_permissions` are pinned to that origin. It will not work if you bind the CRM to a different host unless you also update `extension/manifest.json`.
- **Pre-built `.crx` artifacts in the working tree are not source-controlled.** They are gitignored. Recreate them with Chrome's "Pack extension" UI if you need a signed bundle.

---

## 8. API reference

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/contacts` | List chats |
| POST | `/api/contacts` | Create contact |
| GET / PATCH / DELETE | `/api/contacts/[id]` | Read / update / delete contact |
| GET | `/api/contacts/[id]/messages` | List messages (marks as read on fetch) |
| GET | `/api/contacts/[id]/timeline` | Fan activity timeline |
| POST | `/api/messages` | Create message |
| POST | `/api/notes` | Add note |
| POST / DELETE | `/api/tags` | Add / remove tag |
| GET | `/api/analytics` | Fan analytics overview |
| GET | `/api/followups` | Follow-up smart lists |
| GET | `/api/broadcasts` | Broadcast history |
| POST | `/api/broadcasts` | Send manual broadcast |
| POST | `/api/broadcasts/audience` | Preview broadcast audience |
| GET | `/api/reengagement/audiences` | Reengagement audience counts per segment |
| POST | `/api/reengagement/send` | Send reengagement campaign |
| POST | `/api/telegram/import/contacts` | Import contacts from Telegram |
| POST | `/api/telegram/import/messages` | Sync recent messages from Telegram |

---

## 9. Scripts

```bash
npm run dev            # CRM at http://localhost:3000 (loopback only)
npm run dev:lan        # CRM at http://0.0.0.0:3000  (trusted LANs only)
npm run build          # Production build
npm run start          # Start production server (loopback only)
npm run start:lan      # Start production server (trusted LANs only)
npm run db:seed        # Seed database with sample data (no-op if data exists)
npm run db:rebuild     # Rebuild the better-sqlite3 native binding
npm run telegram:login # CLI: log in to Telegram and persist a session
npm run lint           # ESLint
```
