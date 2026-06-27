# Manual Steps (Required Before Production)

> These steps require human interaction and cannot be automated.

---

## 1. Rotate All Secrets 🔴

**Every secret in `.env` is compromised** because the file is committed to git.

### Minimum rotation:
| Secret | Rotate via |
|--------|-----------|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys → Generate new |
| `TELEGRAM_SESSION` | Delete session file, re-run `npm run telegram:login` |
| `CRM_API_KEY` | Generate new random string (e.g., `openssl rand -hex 32`) |
| `CRON_SECRET` | Generate new random string |
| `RAZORPAY_WEBHOOK_SECRET` | Regenerate in Razorpay Dashboard → Webhooks |
| `OPENROUTER_API_KEY` | OpenRouter Dashboard → Keys → Regenerate |
| Vercel OIDC tokens | Vercel Dashboard → Project → Settings → Environment → Regenerate |

### After rotation:
1. Update `.env` locally (do NOT commit it)
2. Set all vars in Vercel Dashboard

---

## 2. Telegram Login (OTP Required)

The Telegram session must be created interactively:

```bash
npm run telegram:login
```

You'll be prompted for:
- Phone number (with country code, e.g., `+919876543210`)
- OTP code (sent to Telegram app)
- 2FA password (if enabled)

After successful login, the session string is saved. Set it as `TELEGRAM_SESSION` in Vercel.

---

## 3. Razorpay Webhook Configuration

1. Go to [Razorpay Dashboard → Settings → Webhooks](https://dashboard.razorpay.com/app/webhooks)
2. Add webhook:
   - URL: `https://[your-vercel-domain]/api/razorpay/webhook`
   - Secret: Same as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment_link.paid`
3. Save and verify the webhook status is "Active"

---

## 4. Vercel Deployment

### Option A: Vercel Dashboard (Recommended)
1. Push to GitHub
2. Import project in Vercel Dashboard
3. Set all env vars (rotated copies)
4. Deploy
5. Set up cron jobs via `vercel.json` or Dashboard → Cron

### Option B: CLI
```bash
npx vercel --prod
npx vercel env add ... # for each env var
```

---

## 5. Chrome Extension (Optional)

If publishing to Chrome Web Store:
1. Create developer account ($5 one-time fee)
2. Prepare store assets (icon, screenshots, description)
3. Zip the `extension/` directory
4. Upload to Chrome Developer Dashboard
5. Set extension homepage to Vercel deployment URL

---

## Order of Operations

1. 🔴 **Rotate all secrets first** (before any deployment)
2. Update `.env` with rotated secrets
3. Add `.env` to `.gitignore`
4. Deploy to Vercel
5. Configure Razorpay webhook
6. Run Telegram login (requires OTP)
7. Test poll: `GET /api/telegram/poll`
8. Test payment: create link → pay → verify webhook
9. Submit Chrome extension (if needed)
10. Monitor logs for 24h
