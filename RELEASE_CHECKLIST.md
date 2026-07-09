# Release Checklist

- [ ] `npm run build` passes (zero errors)
- [ ] `telegram-engine/requirements.txt` exists with pinned versions
- [ ] `telegram-engine/README.md` exists
- [ ] `.gitignore` covers `__pycache__/`, `*.pyc`, `*.session`, `.venv/`
- [ ] No secrets in tracked files (`git diff --cached`)
- [ ] Telethon login works (`python telegram-engine/app.py`)
- [ ] Auto reply works (send `hi` → AI replies in Telegram)
- [ ] CRM saves incoming and outgoing messages
- [ ] Payment flow works (Razorpay link → purchase → confirmation)
- [ ] Unlock flow works (payment → media delivered)
- [ ] Push to `origin/main`
- [ ] Deploy (Vercel + Telethon server)
- [ ] Final production test: send message → AI reply received in Telegram
