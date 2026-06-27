# Production Environment Checklist

## Required Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CRM_API_KEY` | Admin dashboard auth key | `crm_sk_...` | Yes |
| `CRON_SECRET` | Shared secret for cron auth | `cron_secret_...` | Yes |
| `RAZORPAY_KEY_ID` | Razorpay API key ID | `rzp_live_...` | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret | (sha256 hex) | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret | (string) | Yes |
| `TELEGRAM_API_ID` | Telegram app API ID | `12345678` | Yes |
| `TELEGRAM_API_HASH` | Telegram app API hash | (hex string) | Yes |
| `TELEGRAM_SESSION` | Serialized Telegram session | `1BQA...` | Yes |
| `OPENROUTER_API_KEY` | AI API key | `sk-or-v1-...` | Yes |
| `APP_URL` | Public base URL | `https://crm.example.com` | No* |
| `TURSO_DB_URL` | Turso database URL | `libsql://...` | Yes** |
| `TURSO_DB_TOKEN` | Turso auth token | (string) | Yes** |

* `APP_URL` defaults to `http://localhost:3000` if not set  
** Required for Turso production. Local dev uses `better-sqlite3`.

## Vercel Project Settings

### Environment
- All env vars must be set in Vercel project settings
- Use "Production" and "Preview" environments

### Cron Jobs
Configure in `vercel.json` or Vercel dashboard:

| Endpoint | Frequency | Description |
|----------|-----------|-------------|
| `GET /api/telegram/poll` | Every 1 min | Poll incoming messages |
| `GET /api/telegram/remind` | Every 30 min | Send locked response reminders |
| `GET /api/razorpay/reconcile` | Every 60 min | Reconcile missed webhooks |
| `GET /api/razorpay/recover` | Every 30 min | Recover abandoned checkouts |
| `GET /api/automation/stale-leads` | Every 60 min | Detect stale leads |
| `GET /api/automation/failed-unlock` | Every 30 min | Recover failed unlocks |
| `GET /api/automation/vip-followup` | Every 24h | VIP follow-up |
| `GET /api/automation/whale-followup` | Every 24h | Whale follow-up |
| `GET /api/automation/daily-summary` | Every 24h | Daily CRM summary |
| `GET /api/automation/retry-queue` | Every 15 min | Retry failed actions |
| `GET /api/automation/verify-crons` | Every 60 min | Verify cron health |

### Function Settings
- Default memory: 512MB
- Max duration: 60s (set per-route with `maxDuration` export)

### Razorpay Webhook Configuration

| Setting | Value |
|---------|-------|
| Webhook URL | `https://[your-domain]/api/razorpay/webhook` |
| Events | `payment_link.paid` |
| Secret | Matches `RAZORPAY_WEBHOOK_SECRET` |

## Database

### Schema
The schema is auto-created on first start (`lib/db/index.ts`). No manual migration needed.

### Tables
- `contacts` — CRM contacts with all V2 fields
- `conversations` — One per contact
- `messages` — Chat history
- `purchases` — Payment records
- `media` — Uploaded media files
- `settings` — Key-value store
- `failed_actions` — Retry queue
- `notes` — Operator notes
- `tags` — Contact tags
- `broadcast_history` — Sent broadcast campaigns
- `broadcast_recipients` — Per-recipient broadcast status

## Monitoring

### Vercel Logs
- Check `https://vercel.com/[team]/[project]/logs`
- Filter by status 500
- Check cron function logs

### Key Metrics to Watch
- Webhook 5xx rate (should be 0)
- Poll engine error rate
- Payment conversion rate
- AI reply success rate
- Database query latency
