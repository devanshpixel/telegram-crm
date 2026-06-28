# Secret Rotation Guide

> **Do NOT rotate anything without reading this document in full.**
>
> This document is for preparation only. No secrets have been rotated.

---

## Executive Summary

**10 unique secret values** are exposed on local disk across **12 `.env*` files**.

**Git status: SAFE** — No secrets were ever committed to git. The `.gitignore` correctly
excludes `.env*` files (except `.env.example`). Git history is clean of credentials.

**Risk:** Anyone with file-system access to this development machine can read live
production credentials.

---

## Secrets Found

### Tier 1 — Production Access (exposed)

| # | Secret | Value (first 12 chars) | Files Where Found |
|---|--------|------------------------|-------------------|
| 1 | `TELEGRAM_SESSION` | `1BQANOTEuMTA4Lj...` | `.env` |
| 2 | `TELEGRAM_API_ID` | `33840331` | `.env` |
| 3 | `TELEGRAM_API_HASH` | `96223c40e445...` | `.env` |
| 4 | `CRM_API_KEY` | `31619d130140...` | `.env` |
| 5 | `RAZORPAY_KEY_ID` | `rzp_live_T59k...` | `.env` |
| 6 | `RAZORPAY_KEY_SECRET` | `HgNQTYyB66Fq...` | `.env` |
| 7 | `RAZORPAY_WEBHOOK_SECRET` | `velvet_webhook...` | `.env` |
| 8 | `OPENROUTER_API_KEY` | `sk-or-v1-b90f...` | `.env` |
| 9 | `CRON_SECRET` | `devansh-crm-se...` | `.env` |

### Tier 2 — Vercel Infrastructure (exposed)

| # | Secret | Unique Values | Files Where Found |
|---|--------|---------------|-------------------|
| 10 | `VERCEL_OIDC_TOKEN` | **6 unique JWT tokens** | `.env.prod`, `.env.local`, `.env.prod-actual`, `.env.production.check`, `.env.turso-prod`, `.env.vercel`, `.env.vercel.prod`, `.env.forensic` |

### Tier 3 — Weak/Empty (low concern)

| # | Secret | Value | Files Where Found |
|---|--------|-------|-------------------|
| 11 | `CRM_API_KEY` (alt) | `16be7932a405cf8d` (16 hex chars — weak) | `.env.tmp` |

---

## Where Each Secret Is Used

### 1. `TELEGRAM_SESSION`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `src/lib/telegram/client.ts` | `process.env.TELEGRAM_SESSION` — deserialized to authenticate as the Telegram bot |
| Vercel env (production) | Must be set for Telegram polling to work |

**Rotation:** Must re-run `npm run telegram:login` (interactive — requires OTP).

### 2. `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `src/lib/telegram/client.ts` | Passed to `TelegramClient()` constructor |
| Vercel env (production) | Required |

**Rotation:** Regenerate at https://my.telegram.org/apps

### 3. `CRM_API_KEY`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `middleware.ts` | Compared against `?key=` query param, `x-api-key` header, and session cookie |
| `.env.tmp` (weak copy) | Same key, weaker value (16 hex chars) |
| Vercel env (production) | Required |

**Rotation:** Generate new random hex string (recommended: `openssl rand -hex 32` = 64 chars).

### 4. `RAZORPAY_KEY_ID`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `lib/razorpay/index.ts` | Passed to `new Razorpay()` constructor |
| Vercel env (production) | Required |
| Razorpay Dashboard | Visible in API Keys section |

**Rotation:** Razorpay Dashboard → Settings → API Keys → Regenerate.

### 5. `RAZORPAY_KEY_SECRET`
| Location | How It's Used |
|----------|---------------|
| `.env` | Passed to `new Razorpay()` constructor |
| Vercel env (production) | Required |

**Rotation:** Razorpay Dashboard → Settings → API Keys → Regenerate.

### 6. `RAZORPAY_WEBHOOK_SECRET`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `app/api/razorpay/webhook/route.ts` | `WEBHOOK_SECRET` — validates `x-razorpay-signature` |
| Vercel env (production) | Required |
| Razorpay Dashboard | Must match webhook configuration |

**Rotation:** Razorpay Dashboard → Settings → Webhooks → Edit → Regenerate secret.

### 7. `OPENROUTER_API_KEY`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `lib/ai/suggest-reply.ts` | `process.env.OPENROUTER_API_KEY` — authenticates AI requests |
| Vercel env (production) | Required |

**Rotation:** OpenRouter Dashboard → Keys → Regenerate.

### 8. `CRON_SECRET`
| Location | How It's Used |
|----------|---------------|
| `.env` | Loaded at startup |
| `middleware.ts` | Compared against `Authorization: Bearer` and `x-cron-secret` header |
| All 11 cron endpoints | Do their own `CRON_SECRET` check |
| Vercel Cron jobs | Must match the value sent in `x-cron-secret` header |

**Rotation:** Generate new random string (recommended: `openssl rand -hex 32` = 64 chars).

### 9. `VERCEL_OIDC_TOKEN` (6 unique values)
| Location | How It's Used |
|----------|---------------|
| `.env.prod`, `.env.local`, `.env.prod-actual`, etc. | Created by `vercel env pull` — NOT read by the application |
| Vercel CI/CD | Authenticates `vercel deploy` commands as the project owner |

**Rotation:** Vercel Dashboard → Project → Settings → Environment → Regenerate OIDC tokens.
Or run `vercel env pull --environment=production` after rotating.

---

## Rotation Procedure

### Prerequisites
- [ ] Access to Razorpay Dashboard (https://dashboard.razorpay.com)
- [ ] Access to OpenRouter Dashboard (https://openrouter.ai/keys)
- [ ] Access to my.telegram.org (for API ID/Hash)
- [ ] Access to Vercel Dashboard (https://vercel.com)
- [ ] Telegram OTP-capable device (for TELEGRAM_SESSION)

---

### Step 1: Rotate `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
1. Go to https://dashboard.razorpay.com/app/keys
2. Click "Generate new key"
3. Copy both `Key ID` and `Key Secret`
4. Update `.env`: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
5. Update Vercel environment variables

### Step 2: Rotate `RAZORPAY_WEBHOOK_SECRET`
1. Go to https://dashboard.razorpay.com/app/webhooks
2. Edit the existing webhook
3. Click "Regenerate secret"
4. Copy the new secret
5. Update `.env`: `RAZORPAY_WEBHOOK_SECRET`
6. Update Vercel environment variable
7. Verify webhook is still active (test event)

### Step 3: Rotate `OPENROUTER_API_KEY`
1. Go to https://openrouter.ai/keys
2. Click "Regenerate" on the existing key
3. Copy the new key
4. Update `.env`: `OPENROUTER_API_KEY`
5. Update Vercel environment variable

### Step 4: Rotate `TELEGRAM_API_ID` + `TELEGRAM_API_HASH`
1. Go to https://my.telegram.org/apps
2. Under "API Configuration", click "Revoke" then "Create new application"
3. Copy the new `api_id` and `api_hash`
4. Update `.env`: `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`
5. Update Vercel environment variables

### Step 5: Rotate `TELEGRAM_SESSION`
**This is the trickiest step — requires interactive OTP.**
1. Delete all session files: `rm -f data/session/* data/*.session`
2. Run: `npm run telegram:login`
3. Follow the prompts (phone → OTP → 2FA if needed)
4. Copy the printed session string
5. Update `.env`: `TELEGRAM_SESSION`
6. Update Vercel environment variable

### Step 6: Rotate `CRM_API_KEY`
1. Generate new key: `openssl rand -hex 32`
2. Update `.env`: `CRM_API_KEY`
3. Update Vercel environment variable
4. All existing browser sessions will be invalidated (users must re-login)

### Step 7: Rotate `CRON_SECRET`
1. Generate new key: `openssl rand -hex 32`
2. Update `.env`: `CRON_SECRET`
3. Update Vercel environment variable
4. Update Vercel Cron job headers if they hardcode this value

### Step 8: Rotate `VERCEL_OIDC_TOKEN`
1. Go to Vercel Dashboard → Project → Settings → Environment
2. Regenerate OIDC tokens
3. Or run: `vercel env pull --environment=production` after regeneration
4. Delete all stale `.env.*` files on local machine that contain old tokens

### Step 9: Clean Up Exposed Files
After all secrets are rotated:
```
# Delete stale env files with old credentials
del .env.forensic
del .env.local
del .env.prod
del .env.prod-actual
del .env.production.check
del .env.tmp
del .env.turso-prod
del .env.vercel
del .env.vercel.prod
```

### Step 10: Verify
- [ ] `npm run dev` starts without errors
- [ ] Razorpay webhook test event succeeds
- [ ] OpenRouter API responds (send a test prompt)
- [ ] Telegram poll runs (if OTP was done)
- [ ] All cron endpoints respond with 200 when accessed with new `CRON_SECRET`

---

## Files Summary

| File | Tracked by Git? | Contains Live Secrets? | Action |
|------|----------------|------------------------|--------|
| `.env` | No (gitignored) | **YES — all 9 secrets** | Keep, update with rotated values |
| `.env.example` | **Yes** | No (empty placeholders) | Keep as-is |
| `.env.forensic` | No (gitignored) | VERCEL_OIDC_TOKEN | Delete after rotation |
| `.env.local` | No (gitignored) | VERCEL_OIDC_TOKEN | Delete after rotation |
| `.env.prod` | No (gitignored) | VERCEL_OIDC_TOKEN + empty placeholders | Delete after rotation |
| `.env.prod-actual` | No (gitignored) | VERCEL_OIDC_TOKEN + empty placeholders | Delete after rotation |
| `.env.production.check` | No (gitignored) | VERCEL_OIDC_TOKEN | Delete after rotation |
| `.env.test-clean` | No (gitignored) | None (clean) | Keep or delete |
| `.env.tmp` | No (gitignored) | Weak CRM_API_KEY (16-char) | Delete after rotation |
| `.env.turso-prod` | No (gitignored) | VERCEL_OIDC_TOKEN + empty placeholders | Delete after rotation |
| `.env.vercel` | No (gitignored) | VERCEL_OIDC_TOKEN + empty placeholders | Delete after rotation |
| `.env.vercel.prod` | No (gitignored) | VERCEL_OIDC_TOKEN + empty placeholders | Delete after rotation |

---

## Hardcoded Secrets in Source Code

**Result: NONE FOUND**

All secrets are loaded from `process.env` at runtime. No API keys, tokens, or
passwords are hardcoded in:
- `lib/` — all service code reads from env vars
- `src/` — Telegram client reads from env vars
- `app/` — API routes read from env vars
- `scripts/` — test scripts read from env vars
- `extension/` — reads from CRM API (not hardcoded)
- Configuration files (`vercel.json`, `next.config.*`) — empty or no secrets
- Git history — clean of any secret patterns
