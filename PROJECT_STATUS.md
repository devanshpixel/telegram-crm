# Project Status

Current HEAD:
a9f8578

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

Known Issues:

- ~~SEND_MESSAGE broken~~ **FIXED — S1**
- ~~Sidebar race condition~~ **FIXED — S2**
- ~~Cache invalidation~~ **FIXED — S3**
- ~~AI Reply missing~~ **FIXED — C1..C4**
- ~~Runtime error handling~~ **FIXED — S4**
- No Telegram login UI (C30 CRITICAL — pre-dates this session)
- No backup mechanism (C30 CRITICAL)
- No auth middleware (C30 CRITICAL)
- FLOOD_WAIT backoff missing (C30 HIGH)
- Placeholder extension icons (69 bytes)
- Dashboard "Loading..." deadlock on stale activeChatId
- No app/error.tsx boundary

Completed Priorities:

- **S1** Telegram sending — Dashboard.tsx + background.js changed to /api/telegram/send
- **S2** Sidebar race — content.js generation protection for lookupCRMContact
- **S3** Cache invalidation — _lastKey reset on API error, historyCache cleared after send/label toggle
- **S4** Runtime error handling — user-visible errors in NotesSection, TagsSection, sidebar, popup
- **C1** .env.example: OPENROUTER_API_KEY
- **C2** POST /api/ai/suggest-reply → OpenRouter (native fetch, strict prompt)
- **C3** CRM web UI: Sparkles Generate Reply button
- **C4** Extension popup: ✨ AI Generate Reply button

Release Readiness:

Tier 1 (blocking for v1.0):
- [ ] Telegram login UI (phone/code/2FA form)
- [ ] Backup mechanism (db.backup route or CLI)
- [ ] Auth middleware (127.0.0.1 binding done, need CORS/auth for LAN)

Tier 2 (should fix before v1.0):
- [ ] FLOOD_WAIT backoff in broadcasts/reengagement
- [ ] Real extension icons
- [ ] Dashboard "Loading..." deadlock

Tier 3 (nice to have):
- [ ] app/error.tsx boundary
- [ ] Pagination on messages (C29 H7)
- [ ] Fix N+1 tags query in listChats (C29 H2)
