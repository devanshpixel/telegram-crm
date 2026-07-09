# Deployment Checklist

## 1. Local pre-check

- [ ] `npm run build` passes (zero errors)
- [ ] `python -m py_compile telegram-engine/app.py` passes
- [ ] `python -m py_compile telegram-engine/handlers.py` passes
- [ ] `python -m py_compile telegram-engine/ai_client.py` passes
- [ ] No staged secrets in `git diff --cached`
- [ ] `git status` shows only intended files

## 2. Vercel deployment

- [ ] Push to `origin/main`
- [ ] Vercel build succeeds (check dashboard)
- [ ] Verify `/api/health` returns 200
- [ ] Verify `/api/telethon/reply` returns 401 without auth (public path removed or secured)
- [ ] Verify cron endpoints respond (CRON_SECRET configured)
- [ ] Verify dashboard login works (`?key=CRM_API_KEY`)

## 3. Telethon deployment

- [ ] VPS / server has Python 3.12+
- [ ] `pip install -r telegram-engine/requirements.txt` succeeds
- [ ] `.env` file present with all variables
- [ ] `nayra.session` present or generated on first run
- [ ] Telethon engine starts without errors
- [ ] Process manager configured (systemd / supervisor / screen)

## 4. Environment variables

- [ ] `CRM_API_KEY` — Vercel env
- [ ] `CRON_SECRET` — Vercel env
- [ ] `OPENROUTER_API_KEY` — Vercel env
- [ ] `API_ID` — Telethon `.env`
- [ ] `API_HASH` — Telethon `.env`
- [ ] `SESSION_NAME` — Telethon `.env` (default: `nayra`)
- [ ] `NEXTJS_API` — Telethon `.env` (default: `http://127.0.0.1:3000/api/telethon/reply`)

## 5. Production smoke test

- [ ] Send `hi` from Telegram
- [ ] `[RX]` logged in Telethon output
- [ ] `[API]` logged in Telethon output
- [ ] `[AI]` logged in Telethon output
- [ ] Reply visible in Telegram chat
- [ ] CRM shows incoming + outgoing message
- [ ] No duplicate messages
- [ ] Send second message — no duplicates

## 6. Rollback steps

- [ ] `git revert HEAD` on main
- [ ] Force push to `origin/main`
- [ ] Vercel redeploys automatically
- [ ] Restart Telethon engine
- [ ] Verify `/api/health` 200
