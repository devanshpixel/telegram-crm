# Project Status

Current HEAD:
fefae52

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

AI Reply MVP:
COMPLETE

Known Issues:

- ~~SEND_MESSAGE broken~~ **FIXED — S1**
- ~~Sidebar race condition~~ **FIXED — S2**
- ~~Cache invalidation~~ **FIXED — S3**
- ~~AI Reply missing~~ **FIXED — C1..C4**
- ~~Runtime error handling~~ **FIXED — S4**

Release Status:
**Near Release Candidate** — 15/16 checkpoints complete
Remaining CRITICAL blocker:
- **Auth** — all 25 API routes completely unprotected

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
- **BK1** Backup CLI — scripts/backup.ts using db.backup(), WAL-safe, timestamped
- **LG1** Auth library — getLoginStatus(), signOut(), checkPassword() in auth.ts
- **LG2** Login API routes — send-code, verify-code, status, sign-out
- **LG3** API client functions — telegramSendCode, telegramVerifyCode, telegramStatus, telegramSignOut
- **LG4** Login modal — TelegramLoginModal.tsx with 3-step form
- **LG5** Dashboard integration — status check on mount, Connect button, auth state

See V1_RELEASE_PLAN.md for full execution plan.
