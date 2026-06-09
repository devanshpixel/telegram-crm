# Chrome Extension Phase Roadmap

**Baseline:** CRM v1.0.0-rc.1 (`a01d55a`)
**Extension version:** 0.2.0 (MV3)

---

## TASK 1 — Extension Audit

### File Inventory

| File | Lines | Role |
|------|-------|------|
| `manifest.json` | 31 | MV3 declaration, permissions, content script (web.telegram.org), popup |
| `background.js` | 221 | Service worker — API bridge (17 message handlers) |
| `content.js` | 927 | Shadow DOM sidebar injected into Telegram Web |
| `popup.js` | ~1978 | Popup UI (contacts, send, AI, followups, campaigns, templates, snippets, labels, timeline) |
| `popup.html` | 274 | Popup markup + 219 lines of CSS |

### Existing Capabilities

#### 1. CRM Integration
- **background.js** acts as a thin API proxy — all CRM calls go through `crmFetch()` with X-API-Key
- 17 message types: PING, GET_CONTACTS, GET_FOLLOWUPS, GET_REENGAGEMENT_COUNTS, SEND_REENGAGEMENT, CREATE_CONTACT, GET_CONTACT, GET_MESSAGES, UPDATE_CONTACT, ADD_TAG, DELETE_TAG, SEND_MESSAGE, GENERATE_REPLY, GET_TIMELINE, ADD_NOTE, CREATE_FOLLOWUP
- Hardcoded `CRM_BASE = "http://localhost:3000"` and `CRM_KEY`

#### 2. AI Integration
- `GENERATE_REPLY` handler (background.js:161-175) calls `/api/ai/suggest-reply`
- **No mode selector** — always sends `{ contactId }` without mode parameter (defaults to "auto")
- Popup has "✨ AI" button next to send field that triggers generation
- No AI mode UI in popup or content sidebar

#### 3. Media Integration
- **None.** No media gallery, no PPV unlock, no upload capability in either popup or content sidebar
- Content sidebar shows revenue/purchases but no media

#### 4. Timeline Integration
- Content sidebar: `renderRecentActivitySection()` (content.js:623-669) — lazy-loads 5 recent timeline events with icons per type
- Popup: Detailed timeline section (popup.js:2099+) with filter buttons, expandable events, color-coded types
- Timeline shows: message_in, message_out, purchase, note, tag_added, tag_removed

#### 5. Notes/Tags/Followup Integration
- **Notes:** Add inline via content sidebar form (`renderAddNoteForm`); display notes in sidebar
- **Tags:** Displayed in sidebar with tag pills; labels with add/remove per-preset
- **Followups:** Dedicated collapsible section in popup with expandable groups; "Add Follow-up" form in content sidebar (stored as tagged notes)
- **Labels:** 5 preset labels (VIP, Hot Lead, Warm Lead, Buyer, Repeat Buyer) with add/remove toggle in sidebar

#### 6. Communication
- Popup: Message send form with text input + AI generate button
- Popup: Snippet system with `/` trigger dropdown (type `/` in send box to insert snippets)
- Popup: Reply template system (CRUD, categorized, variable substitution `{name}`)
- Popup: Campaigns section (view audience counts by segment, compose and send re-engagement campaigns)
- Content sidebar: No send-message capability; opens CRM in new tab for messaging

---

## TASK 2 — Gaps vs. Lustify-Style Workflow

| # | Lustify Workflow | Extension Status | Gap |
|---|-----------------|-----------------|-----|
| 1 | Click Telegram contact → auto-open CRM profile | Fragile — relies on DOM selector for @username, no click-to-open | High — no frictionless contact linking |
| 2 | View media gallery in sidebar | **Missing** | Cannot browse or sell media from extension |
| 3 | Unlock/Purchase PPV media from extension | **Missing** | Cannot complete PPV sale without opening CRM |
| 4 | Upload media and set price from extension | **Missing** | Must use CRM web UI to upload |
| 5 | Revenue trend visualization in sidebar | **Missing** | CRM has RevenueChart, extension does not |
| 6 | Analytics access from popup | **Missing** | Cannot view analytics without opening CRM |
| 7 | Broadcast composer + send from extension | **Missing** | Popup has campaigns (re-engagement) but not broadcasts |
| 8 | AI mode selector (Casual/Flirty/Sales/Re-engage) | **Missing** | Content sidebar AI uses "auto" only; popup has no AI mode selector |
| 9 | On-hover contact card in Telegram chat list | **Missing** | No Telegram DOM injection beyond sidebar toggle |
| 10 | Quick PPV: upload → price → send preview link | **Missing** | Requires 3 separate actions across CRM and extension |
| 11 | Conversation history in sidebar | Partial — timeline events only | No full message history view in sidebar |
| 12 | Revenue contribution per contact (chart) | Missing | Content sidebar shows raw revenue numbers only |
| 13 | Broadcast audience preview | **Missing** | Popup has re-engagement campaigns but no broadcast audience preview |
| 14 | Multi-select contacts for bulk actions | **Missing** | Contact list is read-only list with single-select for detail |
| 15 | Offline/cached contact data | **Missing** | Every open fetches from API; no localStorage cache |

---

## TASK 3 — Priority Matrix

### P1 (Critical — revenue-impacting workflows)
| Feature | User Impact | Complexity | Risk | Est. Checkpoints |
|---------|------------|-----------|------|-----------------|
| **PPV Selling Workflow** — upload media, set price, share preview, track unlock in sidebar | Very High | Medium | Low (media API exists, reuses existing upload/unlock routes) | 3 |
| **AI Mode Selector** — Casual/Flirty/Sales/Re-engage in sidebar + popup | High | Low | Low (pure UI, existing API supports mode param) | 1 |
| **Smart Contact Linking** — click any Telegram username → auto-load CRM profile | High | Medium | Medium (Telegram DOM may change) | 2 |

### P2 (Important — workflow completeness)
| Feature | User Impact | Complexity | Risk | Est. Checkpoints |
|---------|------------|-----------|------|-----------------|
| **Media Gallery in Sidebar** — browse, filter, see locked/unlocked | High | Medium | Low (media API exists) | 2 |
| **Revenue Chart in Popup** — monthly trend (reuse RevenueChart SVG) | Medium | Low | Low (already built for CRM) | 1 |
| **Broadcast Composer** — compose + send from popup | Medium | Medium | Low (reuses broadcast API) | 2 |
| **Analytics Quick-view** — top-level KPIs in popup header | Medium | Low | Low (analytics API exists) | 1 |
| **Conversation History in Sidebar** — last N messages in sidebar | Medium | Low | Low (uses GET_MESSAGES endpoint) | 1 |

### P3 (Nice-to-have — polish)
| Feature | User Impact | Complexity | Risk | Est. Checkpoints |
|---------|------------|-----------|------|-----------------|
| On-hover contact cards in Telegram chat list | Medium | High | High (DOM brittle) | 3 |
| Offline contact cache (localStorage) | Low | Medium | Low | 2 |
| Multi-select contacts for bulk tag/note | Low | High | Medium | 3 |
| Dark mode toggle for extension | Low | Low | Low | 1 |

---

## TASK 4 — Recommended Next Milestone

### **PPV Selling Workflow**

**Rationale:**

This is the highest-ROI milestone because:

1. **Direct revenue impact** — PPV media sales are the monetization core. Every friction point between "contact asks about content" and "sale completes" costs money. The extension currently requires opening the CRM in a separate tab to upload, price, and manage media.

2. **Lowest risk** — All backend APIs exist and are hardened (MIME whitelist in Phase 2, media unlock, Stripe checkout, preview endpoints, isMediaUnlocked). No schema changes needed. No new backend code.

3. **Clear UX path** — The content sidebar already shows the contact profile and revenue. Adding a media section with upload form, gallery view, and unlock button is a natural extension (no pun intended) of the existing sidebar layout.

4. **Complete loop** — From the Telegram conversation:
   - Fan asks "send me that exclusive video"
   - Creator opens sidebar → Media tab → Uploads file → Sets price
   - Shares blurred preview link (auto-generated)
   - Fan completes Stripe checkout
   - Sidebar shows "unlocked" status + revenue update
   - All without leaving Telegram Web

5. **Builds on existing work** — Media upload API (Phase 2 hardened), media preview/file endpoints, Stripe checkout, purchase tracking — all completed in the v1.0.0-rc.1 release.

---

## TASK 5 — Execution Plan

### Milestone: PPV Selling Workflow

```
Extension version bump: 0.3.0
Target: Complete PPV sale from within Telegram Web sidebar
No CRM web UI changes — all changes in extension/
```

---

### Checkpoint 1 — Media Gallery in Sidebar

**Goal:** Display contact's media in the content sidebar with locked/unlocked state.

**Files likely involved:**
- `extension/content.js` — new `renderMediaSection()` function in sidebar
- `extension/background.js` — new `GET_CONTACT_MEDIA` message handler calling `GET /api/media?contactId=X`
- `extension/popup.js` — optionally replicate in popup details panel

**Estimated effort:** 2-3 hours

**Dependencies:**
- `GET /api/media?contactId=X` — exists and working
- `GET /api/media/{id}` — exists
- `GET /api/media/{id}/preview?contactId=X` — exists (public route, no auth for preview)

**Risks:**
- Media route returns all media for contact; frontend must filter/display correctly
- Blurred preview images need `<img>` with correct URL construction
- Shadow DOM isolation may affect image loading

**Acceptance:**
- Sidebar shows media grid when contact has media
- Locked items show blurred thumbnail + price
- Unlocked items show full thumbnail
- "No media yet" empty state

---

### Checkpoint 2 — Upload Media from Sidebar

**Goal:** Upload a media file with price directly from the Telegram Web sidebar.

**Files likely involved:**
- `extension/content.js` — `renderMediaUploadForm()` with file picker + price input + submit
- `extension/background.js` — new `UPLOAD_MEDIA` message handler (must handle FormData/blob transfer from content script → background service worker)
- `extension/manifest.json` — may need `"file_system_provider"` permission or content script file input

**Estimated effort:** 4-6 hours

**Dependencies:**
- `POST /api/media/upload` — exists and hardened (Phase 2 MIME whitelist)
- File picker (`<input type="file">`) works in Shadow DOM
- Blob transfer from content.js → background.js (chrome.runtime.sendMessage cannot pass File objects directly; must convert to ArrayBuffer → base64 or use `chrome.runtime.connect` with transferable)

**Risks:**
- **HIGH** — Chrome extension messaging cannot pass `File` or `Blob` objects between content script and service worker. Must serialize to ArrayBuffer/base64 and reconstruct. This adds complexity.
- File size limits: MAX_UPLOAD_SIZE (100MB default) + extension memory limits for base64 encoding
- Alternative: Upload directly from content script using `fetch()` with X-API-Key (bypass background.js). This avoids the serialization issue but exposes the API key in content script.

**Acceptance:**
- File picker opens from sidebar
- Progress indicator during upload
- Success: media appears in gallery immediately
- Failure: error message (wrong type → 415, too large → 413)

---

### Checkpoint 3 — Unlock Flow from Sidebar

**Goal:** Complete Stripe checkout for paid media without leaving Telegram Web.

**Files likely involved:**
- `extension/content.js` — "Unlock for $X" button → calls background to create checkout session
- `extension/background.js` — new `CREATE_MEDIA_CHECKOUT` message handler calling `POST /api/checkout/create-session`
- `extension/popup.html` / `extension/popup.js` — optionally replicate unlock button

**Estimated effort:** 3-4 hours

**Dependencies:**
- `POST /api/checkout/create-session` with `{ contactId, amount, mediaId }` — exists
- Stripe Checkout opens in new tab/window (extension popup cannot display Stripe Checkout inline)
- After redirect: poll or manual refresh to check unlock status
- `isMediaUnlocked(mediaId, contactId)` — exists

**Risks:**
- Stripe Checkout redirects to CRM web URL (`http://localhost:3000/?checkout=success`). From extension context, the creator must return to the sidebar to see the unlock.
- Workaround: After Stripe redirect, add a "Refresh" button in sidebar that rechecks unlock status.
- `Content-Type: image/jpeg` (or whatever media MIME) is served correctly — verified in Phase 2.5 audit.

**Acceptance:**
- Click "Unlock for $X" → Stripe Checkout opens in new tab
- Complete payment → redirect to CRM
- Click "Refresh" in sidebar → media shows as unlocked
- Revenue stat updates
- Purchase appears in purchase history section

---

### Summary

| Checkpoint | Effort | Risk | Key Dependency |
|-----------|--------|------|---------------|
| 1. Media Gallery in Sidebar | 2-3h | Low | Media API exists |
| 2. Upload from Sidebar | 4-6h | **Medium-High** | Blob serialization in extension messaging |
| 3. Unlock Flow | 3-4h | Low-Medium | Stripe + Checkout API exist |
| **Total** | **9-13h** | | |

### Rollback Plan

Each checkpoint is independently reversible:
- Checkpoint 1: Remove `renderMediaSection()` call — gallery disappears
- Checkpoint 2: Remove upload form — upload capability removed
- Checkpoint 3: Remove checkout button — falls back to CRM web flow

No CRM backend changes = zero rollback risk to the core application.
