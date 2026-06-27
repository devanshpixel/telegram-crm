# Tasks

## RELEASE CANDIDATE — Complete ✅

### Phase 1: Production Audit ✅
- All features audited for production readiness

### Phase 2: Critical Bug Fixes ✅
- Phantom purchase (recordUpsell) — fixed
- Webhook 400→500 (Razorpay retry) — fixed
- Cursor advancement past unprocessed messages — fixed
- N+1 queries in poll loop — eliminated
- iterMessages OOM risk — limited to 50
- shouldSendLockedResponse side effects — removed
- Client-set price in create-order — enforced server-side
- NaN price bypass — validated
- Header injection via filename — sanitized

### Phase 3: HIGH Bug Fixes ✅
- LIKE wildcard injection — escaped
- Duplicate COUNT queries — deduplicated
- offerAcceptanceByTier — implemented
- joined_at locale format — ISO 8601
- Threshold mismatches — aligned
- Message sent before tracking insert — reordered
- Missing LIMIT in remind — added
- verify-crons timeout — parallelized
- Error message leaks — sanitized
- Silent poll failure — 500 status
- count = items.length — uses audience count

### Phase 4: Dead Code Removal ✅
- 4 unused exports removed
- 2 unused interfaces removed
- 2 unused helper functions removed
- 1 dead parameter removed

### Phase 5: Performance ✅
- N+1 elimination, LIMITs added, parallel verification

### Phase 6: Security ✅
- sign-out POST-only, health endpoint sanitized, sameSite strict, headers added

### Phase 7: Reliability ✅
- Error handlers, webhook retries, cursor safety

### Phase 8: Verification ✅
- TSC clean, lint clean, 54/54 tests pass

### Phase 9: Documentation ✅
- FINAL_AUDIT.md, FINAL_RELEASE_REPORT.md, LAUNCH_CHECKLIST.md
- PRODUCTION_ENVIRONMENT_CHECKLIST.md, MANUAL_STEPS.md
- KNOWN_LIMITATIONS.md (updated)

## Pre-Launch Blockers

- [ ] **Rotate all secrets** (`.env` committed to git)
- [ ] **Telegram OTP login** (interactive)
- [ ] **Razorpay webhook config** (dashboard)
- [ ] **Vercel deployment** (dashboard)
- [ ] **Chrome extension publish** (optional)

## Post-Launch

- [ ] Monitor error logs for 24h
- [ ] Verify all cron jobs ran
- [ ] Check payment conversion rate
- [ ] Add rate limiting (future enhancement)
- [ ] Add UNIQUE constraint on purchases.payment_id (future enhancement)
- [ ] Add AI fetch timeout (future enhancement)
