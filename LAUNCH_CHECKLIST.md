# Launch Checklist

## Pre-Launch

### Code Quality
- [x] TypeScript: `npx tsc --noEmit` — clean
- [x] Lint: `npx next lint` — clean
- [x] Tests: `npm test` — 54/54 pass
- [x] No TODO/FIXME/HACK/XXX in app code
- [x] No `@ts-ignore` in app code
- [x] All error handlers sanitized

### Security
- [x] Webhook returns 500 (not 400) for transient errors
- [x] sign-out endpoint is POST-only
- [x] Health endpoint doesn't leak env var names
- [x] Error messages sanitized in API responses
- [ ] **Rotate all secrets in `.env`** (currently committed to git)
- [ ] **Generate new RAZORPAY_KEY_ID/SECRET** (compromised)
- [ ] **Generate new TELEGRAM_API_ID/HASH/SESSION** (compromised)
- [ ] **Generate new CRM_API_KEY** (compromised)
- [ ] **Generate new CRON_SECRET** (compromised)
- [ ] **Generate new RAZORPAY_WEBHOOK_SECRET** (compromised)
- [ ] **Generate new OPENROUTER_API_KEY** (compromised)
- [ ] **Rotate Vercel OIDC tokens** (compromised via .env files)
- [ ] Add `.env` to `.gitignore` (prevent future leaks)

### Infrastructure
- [ ] Deploy to Vercel
- [ ] Configure Vercel environment variables (all rotated secrets)
- [ ] Set Vercel CRON_JOBS for all automation endpoints
- [ ] Configure Razorpay webhook to point to `/api/razorpay/webhook`
- [ ] Set up custom domain (if applicable)
- [ ] Enable Vercel logging/monitoring

### Telegram
- [ ] Complete Telegram login (requires OTP)
- [ ] Verify bot is responding to messages
- [ ] Run initial poll: `GET /api/telegram/poll`
- [ ] Verify messages are being ingested
- [ ] Verify AI replies are being sent

### Payment Flow
- [ ] Create test payment link
- [ ] Complete test payment
- [ ] Verify webhook received
- [ ] Verify contact marked as PAID
- [ ] Verify upsell flow triggered
- [ ] Verify media unlock works
- [ ] Test reconcile endpoint
- [ ] Test recover endpoint

### Automation
- [ ] Verify stale lead detection
- [ ] Verify failed unlock recovery
- [ ] Verify VIP follow-up
- [ ] Verify whale follow-up
- [ ] Verify daily CRM summary
- [ ] Verify retry queue
- [ ] Verify cron verification endpoint

## Launch Day

### Final Checks
- [ ] Smoke test all API routes
- [ ] Smoke test admin dashboard pages
- [ ] Verify middleware auth works
- [ ] Check Vercel function logs for errors
- [ ] Monitor webhook delivery for 5xx responses
- [ ] Monitor poll engine for message ingestion

### Post-Launch Monitoring (24h)
- [ ] Check no unexpected errors in logs
- [ ] Verify all cron jobs ran on schedule
- [ ] Monitor payment conversion rate
- [ ] Verify media delivery works
- [ ] Check database connection stability

## Rollback Plan
1. Redeploy previous working commit
2. Disable webhook in Razorpay dashboard
3. Revoke compromised API keys
4. Update DNS if custom domain
