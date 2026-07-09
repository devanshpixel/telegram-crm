# Deploy Commands

## 1. Git

```bash
git add -A
git commit -m "release: $(date +%Y-%m-%d)"
git push origin main
```

## 2. Vercel deploy

```bash
vercel --prod
# or: wait for GitHub push → auto-deploy
```

## 3. Telethon start

```bash
cd telegram-engine
pip install -r requirements.txt
python app.py
```

## 4. Verify logs

```bash
# Telethon output:
# [RX] ...  (message received)
# [API] ... (POST to Next.js)
# [AI] ...  (reply received)
# [TX] ...  (reply sent)

# Next.js health:
curl https://your-app.vercel.app/api/health
```

## 5. Rollback

```bash
git revert HEAD --no-edit
git push origin main
# Vercel redeploys automatically
# Restart Telethon engine
```
