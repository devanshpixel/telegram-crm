# Release Test Plan

**HEAD:** 6d09b52

---

## 1. Telegram Login Test

### Steps
1. Navigate to `/` — dashboard loads.
2. If no Telegram session: "Connect Telegram" button appears.
3. Click "Connect Telegram" → login modal opens (3-step: phone → code → 2FA).
4. Enter phone number → click "Send Code".
5. Enter received code → click "Verify".
6. If 2FA required: enter password → click "Verify".

### Expected Result
- Status transitions from "Connect Telegram" → "Connected" with green indicator.
- Modal closes on success.
- `POST /api/telegram/status` returns `{ connected: true }`.

### Failure Conditions
- Invalid phone: error message shown, no retry limit enforced.
- Wrong code: error "Invalid code", user can retry.
- Wrong 2FA password: error "Invalid password", user can retry.
- Network error: loading state stuck? Modal should show error.

---

## 2. Telegram Send Test

### Steps
1. Select a contact from the chat list.
2. Type a message in the textarea.
3. Click Send button (or press Enter).

### Expected Result
- Message appears in the conversation as outgoing.
- "Sent" confirmation (no explicit toast, but message appears in timeline).
- Message is persisted on page reload.

### Failure Conditions
- No Telegram connection: send should fail silently or show error.
- Empty message: Send button disabled.
- Very long message: no client-side truncation, depends on Telegram API limits.
- **Extension path**: Open extension popup, select contact, type text, click Send → message appears in CRM conversation.
- Extension send fails with 401 if CRM_API_KEY set (should be fixed by B1 — verify).

---

## 3. AI Reply Test

### Steps
1. Select a contact with at least 1 message.
2. Click the Sparkles (✨) button in MessageInput.

### Expected Result
- Sparkles button shows `animate-pulse` during generation.
- Generated text appears in the textarea.
- User can edit and send the generated text.

### Failure Conditions
- No OPENROUTER_API_KEY: error "OPENROUTER_API_KEY is not configured".
- No messages for contact: error "No messages found for this contact".
- OpenRouter timeout/error: error message shown.
- Contact with 0 messages: Sparkles button still visible, API returns 404.

---

## 4. AI Reply Modes Test

### Steps
1. Select a contact with messages.
2. Change mode dropdown from "Auto" to each mode: Casual, Flirty, Sales, Re-engage.
3. Click Sparkles for each mode.
4. Switch to "Auto" mode with a contact whose last messages contain sales keywords (price, cost, etc.).

### Expected Result
- Each mode produces a reply with a distinct tone matching the mode prompt.
- Auto mode detects sales keywords → generates sales-toned reply.
- Auto mode with 3+ outgoing messages with no reply → generates re-engagement-toned reply.
- Auto mode with casual conversation → generates casual-toned reply.
- Mode selector persists between generations within the same conversation.

### Failure Conditions
- Mode not sent in POST body (e.g., from extension): defaults to "auto" on server.
- Invalid mode value: defaults to "auto" on server.
- Flirty mode generates inappropriate content — no filter, accepted risk.

---

## 5. Media Upload Test

### Steps
1. Open a contact's sidebar (click CRM icon in conversation header).
2. Scroll to the Upload Media section.
3. Select an image file (<100MB).
4. Enter a price (e.g., 9.99).
5. Click Upload.

### Expected Result
- "Media uploaded" confirmation message.
- Media appears in Media Gallery after page refresh.
- Blurred preview file exists on disk at `uploads/media/{filename}_blurred.{ext}`.

### Failure Conditions
- No file selected: upload button should be disabled.
- File >100MB: error "File exceeds maximum size of 100MB".
- Invalid price (negative): error "Price cannot be negative".
- Corrupted image: upload succeeds, media listed, but no blurred preview (Sharp failure is caught and logged).
- Non-image file (PDF, video): upload succeeds, no blurred preview.
- Upload from extension popup: not supported (CRM UI only).

---

## 6. Blur Preview Test

### Steps
1. Upload a paid image for a contact.
2. As the same contact: view Media Gallery → thumbnail shows blurred preview.
3. Open the preview URL directly: `/api/media/{id}/preview?contactId={contactId}`.
4. Open the preview URL without contactId: `/api/media/{id}/preview`.
5. Open the preview URL for an unlocked media item.
6. Upload a non-image (PDF) with price > 0 and view its preview.

### Expected Result
- Step 2: Blurred thumbnail visible in gallery.
- Step 3: Blurred image returned (locked).
- Step 4: Blurred image returned (no contactId = not unlocked).
- Step 5: Original full-res image returned.
- Step 6: 403 "Locked" response (non-image, no blurred file exists).

### Failure Conditions
- Blurred file deleted from disk: locked media returns 403 (fixed by B3, was serving original).
- Non-image with price > 0: must NOT return original file (B3 fix).
- Missing contactId for locked media: must NOT return original.
- Unlocked media always returns original regardless of blurred file existence.
- Gallery `<img>` tag fails with 401 if CRM_API_KEY set: fixed by B2 (media routes whitelisted).

---

## 7. Stripe Checkout Test

### Steps
1. Ensure STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are set.
2. Click "Unlock for $X" on a paid media item in the gallery.
3. Complete payment on Stripe Checkout page (use test card 4242 4242 4242 4242).
4. After redirect back to CRM, refresh the page.

### Expected Result
- Step 2: Redirected to Stripe Checkout page.
- Step 3: Payment succeeds, redirects to CRM with `?checkout=success`.
- Step 4: Media should ideally show as unlocked (requires refresh, no polling implemented).
- Purchase record created in `purchases` table with kind='ppv', note='media_unlock:{mediaId}:stripe_checkout:{sessionId}'.

### Failure Conditions
- Stripe not configured: error "Stripe is not configured".
- Invalid amount (0 or negative): error "Valid amount is required".
- Invalid contactId: error "Valid contactId is required".
- Payment declined (test card 4000 0000 0000 0002): Stripe shows decline page.
- Checkout cancelled: redirects back to CRM with `?checkout=cancelled`.
- After successful payment, media still shows as locked until page refresh (known limitation).

---

## 8. Webhook Test

### Steps
1. Use Stripe CLI to trigger a test event:
   ```
   stripe trigger checkout.session.completed
   ```
2. Or complete a real Checkout session from step 7.
3. Verify the webhook endpoint receives the event.
4. Check the `purchases` table for the new record.

### Expected Result
- Webhook returns `{ received: true }` with 200.
- Purchase record created with correct contactId, amount, kind='ppv'.
- For media unlocks: note=`media_unlock:{mediaId}:stripe_checkout:{sessionId}`.
- Duplicate webhook events: second event is skipped (dedup via `%stripe_checkout:{sessionId}%` lookup).

### Failure Conditions
- Missing STRIPE_WEBHOOK_SECRET: error "Stripe webhook not configured".
- Invalid signature: error "Webhook processing failed".
- Missing stripe-signature header: error "Missing stripe-signature header".
- Session missing contactId or amount_total: purchase silently skipped (no error returned).
- Webhook URL not exposed to internet: Stripe can't deliver events (use Stripe CLI or ngrok).

---

## 9. Purchase History Test

### Steps
1. Open a contact that has purchases (e.g., after completing step 7 or 8).
2. View the Purchase History section in the sidebar or Media Gallery.

### Expected Result
- Purchases listed with amount, date, kind, and note.
- Media unlocks show raw note string (e.g., `media_unlock:42:stripe_checkout:cs_test_abc`) — known cosmetic issue.
- Empty state: "No purchases yet" for contacts with no purchases.
- Multiple purchases: listed in date order (most recent first if sorted).

### Failure Conditions
- Contact with no purchases: empty state renders correctly.
- Purchase with null note: displays as empty string.
- Very old purchase dates: format should still display correctly.

---

## 10. Unlock Test

### Steps
1. Upload a paid media item for Contact A.
2. As Contact A, view the media in the gallery → shows "Unlock for $X" button.
3. Click "Unlock for $X" → redirected to Stripe.
4. Complete payment.
5. Refresh page → media should show as unlocked (lock icon → unlock icon).
6. Open preview endpoint for Contact A: should return original image.
7. Open file endpoint for Contact A: should return original file.
8. As Contact B (different contact), view the same media → should still show as locked.

### Expected Result
- Step 2: Unlock button visible for paid, locked media.
- Step 5: Lock icon changes to unlock icon after payment + refresh.
- Step 6: Original image served because unlocked.
- Step 7: Original file served because unlocked.
- Step 8: Contact B still sees locked state.

### Failure Conditions
- Contact A unlocks, Contact B can access the same media for free: must NOT happen (isMediaUnlocked checks contactId).
- Free media (price=0): shows unlock icon, no "Unlock" button.
- Missing contactId on file endpoint: 400 error.
- Contact B calling file endpoint with Contact A's media ID and their own contactId: 403 (not unlocked for Contact B).
- After unlock, no polling — requires manual refresh.

---

## 11. Revenue Test

### Steps
1. Complete a purchase (via Stripe checkout).
2. Check the contact's sidebar: Revenue section should update.
3. Check the Dashboard stats: totalRevenue should reflect new purchase.
4. Check the Analytics modal: revenue data should be consistent.

### Expected Result
- Contact's total_spent and revenue increase by the purchase amount.
- Dashboard totalRevenue increases (SUM of contacts.revenue).
- Revenue section shows updated lifetime revenue.

### Failure Conditions
- Dashboard totalRevenue differs from sum of purchases (should match via contacts.revenue).
- Revenue trend always shows "flat" (known limitation — never auto-computed).
- RevenueChart.tsx does not exist (known — monthly revenue has no UI).
- Zero-revenue contacts: display "$0.00" consistently.

---

## 12. Analytics Test

### Steps
1. Click the Analytics button on the dashboard.
2. Verify the Analytics modal opens.
3. Check each section: Overview, VIP Levels, Fan Status, Fan Scores, Most Active, Inactive Contacts, Recent Purchasers, Retention, Campaigns.

### Expected Result
- Modal renders with all sections populated from `/api/analytics`.
- Data matches the current database state.
- Charts and lists render without errors.

### Failure Conditions
- Empty database: analytics shows all zeros, empty lists. No crash.
- Very large dataset: no pagination on lists (e.g., Most Active capped at 5).
- Retention calculations with zero buyers: handled (divides by 0 check exists).
- Campaign analytics with no campaigns: shows 0 totalCampaigns.
