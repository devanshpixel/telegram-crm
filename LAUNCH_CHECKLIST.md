# Launch Checklist

> Run through this checklist in order before production launch.

---

## 1. Environment Variables

- [ ] `TURSO_DB_URL` — set in Vercel dashboard
- [ ] `TURSO_DB_TOKEN` — set in Vercel dashboard
- [ ] `CRM_API_KEY` — strong random string (min 32 chars)
- [ ] `CRON_SECRET` — strong random string (min 32 chars)
- [ ] `RAZORPAY_KEY_ID` — from Razorpay dashboard
- [ ] `RAZORPAY_KEY_SECRET` — from Razorpay dashboard
- [ ] `RAZORPAY_WEBHOOK_SECRET` — from Razorpay webhook settings
- [ ] `OPENROUTER_API_KEY` — from OpenRouter dashboard
- [ ] `APP_URL` — production URL (`https://your-domain.vercel.app`)
- [ ] `MAX_UPLOAD_SIZE` — optional, default 100MB
- [ ] `TELEGRAM_API_ID` — from my.telegram.org
- [ ] `TELEGRAM_API_HASH` — from my.telegram.org
- [ ] `TELEGRAM_PHONE` — bot/account phone number

## 2. Vercel Deployment

- [ ] Connect GitHub repo to Vercel
- [ ] Set all environment variables in Vercel dashboard
- [ ] Deploy to production
- [ ] Verify health check: `GET {APP_URL}/api/health` returns 200
- [ ] Verify middleware protects non-public routes: `GET {APP_URL}/api/contacts` without auth returns 401

## 3. Database (Turso)

- [ ] Turso DB created and accessible
- [ ] Schema auto-initialized on first request (CREATE TABLE + ALTER TABLE)
- [ ] Verify tables exist: `contacts`, `conversations`, `messages`, `purchases`, `media`, `tags`, `notes`, `tag_events`, `broadcasts`, `failed_actions`, `settings`
- [ ] Backfill run on existing rows (ALTER TABLE defaults applied)

## 4. Telegram Session

- [ ] Run `npm run telegram:login`
- [ ] Enter phone number
- [ ] Enter OTP code
- [ ] Enter 2FA password if enabled
- [ ] Verify session saved in database

## 5. Poll Engine

- [ ] Poll cron configured: every 2 minutes
- [ ] Verify poll returns summary: `POST /api/telegram/poll`
- [ ] Check logs for message sync
- [ ] Verify `is_polling` lock prevents concurrent runs
- [ ] Verify lock auto-releases after 5 min stale timeout

## 6. AI Conversation

- [ ] Verify AI replies to incoming messages
- [ ] Verify persona prompt loads correctly
- [ ] Verify 7 funnel phases route correctly
- [ ] Verify emotional temp updates per message
- [ ] Verify intent score calculated per batch

## 7. Offer / Payment

- [ ] Manual payment link creation works: `POST /api/razorpay/create-order`
- [ ] Razorpay webhook configured: `{APP_URL}/api/razorpay/webhook`
- [ ] Event: `payment_link.paid`
- [ ] Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Test payment link flow end-to-end
- [ ] Verify purchase recorded in database
- [ ] Verify `conv_state` changes to `PAID`
- [ ] Verify media unlocked after payment
- [ ] Verify upsell ladder fires for first purchase (₹499 × 0.6 = ₹299)

## 8. Cron Jobs (Vercel)

Configure these Vercel Cron Jobs:

| Endpoint | Frequency | Purpose |
|---|---|---|
| `/api/telegram/poll` | Every 2 min | Poll Telegram for new messages & reply |
| `/api/telegram/remind` | Every 6 hours | Send locked response reminders |
| `/api/telegram/reengage` | Every 12 hours | Re-engage cold prospects |
| `/api/razorpay/reconcile` | Every 30 min | Reconcile Razorpay payment links |
| `/api/razorpay/recover` | Every 1 hour | Recover abandoned checkouts |
| `/api/automation/stale-leads` | Every 6 hours | Re-engage stale leads (7d+) |
| `/api/automation/failed-unlock` | Every 1 hour | Fix paid-but-not-unlocked contacts |
| `/api/automation/vip-followup` | Daily | VIP re-engagement |
| `/api/automation/whale-followup` | Daily | Whale re-engagement |
| `/api/automation/daily-summary` | Daily | Generate CRM summary |
| `/api/automation/retry-queue` | Every 30 min | Retry failed actions |

## 9. Verify All Cron Endpoints

- [ ] Run `GET /api/automation/verify-crons` with CRON_SECRET
- [ ] All endpoints return `ok: true`

## 10. Revenue Analytics

- [ ] GET `/api/analytics/revenue` returns all 10 metrics
- [ ] GET `/api/analytics/buyer-intelligence` returns summary
- [ ] GET `/api/analytics/crm-intelligence` returns summary

## 11. Final Checks

- [ ] Middleware correctly protects all non-public routes
- [ ] Media file/preview routes accessible without auth
- [ ] Media CRUD routes (upload, list, update, delete) require auth
- [ ] No `.env` or secrets committed to repository
- [ ] Database indexes created (check schema.ts for all indexes)
- [ ] Razorpay webhook returns 200 for valid events
- [ ] Upsell only fires for first-time buyers (upsell_count === 0, total_spent < 1000)
