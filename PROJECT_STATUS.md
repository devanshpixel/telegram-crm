# Project Status

Current HEAD:
54fd285

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

Known Issues:

- ~~SEND_MESSAGE broken (DB write only)~~ **FIXED — S1**
- ~~Sidebar race condition~~ **FIXED — S2**
- Cache invalidation pending
- ~~AI Reply missing~~ **C1+C2 complete (env + backend); C3+C4 pending (UI)**

Verified:

- XSS issue fixed
- DELETE body issue false alarm

Completed Priorities:

- **S1** Telegram sending architecture (DB write only) — Dashboard.tsx + background.js URLs changed to /api/telegram/send
- **S2** Sidebar race condition — content.js generation protection for lookupCRMContact + stale check for refreshSidebarProfile

AI Reply MVP — Status:

- **C1** Environment: OPENROUTER_API_KEY added to .env.example with validation
- **C2** Server-side suggestion API: POST /api/ai/suggest-reply { contactId } → { suggestion }
  - Fetches last 20 messages via getMessagesByContactId
  - Builds transcript → OpenRouter (openrouter/free, native fetch)
  - Strict prompt: no quotes/prefixes/labels/explanations
- **C3** CRM web UI: Sparkles button beside Send → calls API → populates draft
  - handleGenerate: loading state, error display, pulse animation
  - contactId threaded through ConversationView → MessageInput

Current Priority:

C4 - Extension popup UI (popup.js + background.js)
