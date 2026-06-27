# Release Notes

## Version 1.0.0 — Production Launch

### Overview

Production-ready Telegram CRM with AI-powered conversation engine, multi-tier offer ladder, spend segmentation, buyer intelligence, and full revenue analytics.

### Architecture

- **Stack:** Next.js + TypeScript + GramJS + Turso (SQLite) + Razorpay + OpenRouter
- **State:** Server-rendered dashboard with session cookie auth
- **Automation:** 12 Vercel Cron Jobs for polling, reminders, reconciliation, recovery

### Core Features

#### Telegram Integration
- Real-time message polling via GramJS (every 2 minutes)
- Automatic contact/conversation sync
- Incoming message detection and automated AI reply
- 500 dialogs per poll cycle, 50-second timeout

#### AI Conversation Engine (V2)
- 7 funnel phases: greet → qualify → build rapport → build interest → offer → handle objections → close
- 3 prompt variants per phase (randomly selected)
- Emotional temperature tracking (0–100) per message
- Purchase intent scoring (0–100) per batch
- Dynamic pacing (skip reply if low temp + recently replied)
- Offer cooldown (7 days after exhausting locked responses)
- Objection detection via keyword rules
- Post-purchase lifecycle: welcome (24h) → nurture (1–7d) → reoffer (7d+)

#### Offer / Payment
- 5-tier pricing: ₹349 / ₹449 / ₹499 / ₹574 / ₹749 (base 499 × segment multipliers 0.7–2.0)
- Razorpay payment link creation + webhook confirmation
- Automated payment reconciliation
- Checkout abandonment recovery (30min+ unpaid links)
- First-purchase upsell ladder (60% of base price)
- Purchase idempotency (payment ID dedup inside transaction)
- Webhook HMAC signature verification

#### Media Management
- Upload, list, update price, delete media
- Blurred preview generation via Sharp
- Per-contact unlock tracking via purchase notes
- File and preview serving with `isMediaUnlocked()` gate

#### Spend Segmentation
- 6 tiers: prospect → buyer → premium → high_value → vip → whale
- Segment eligibility recalculated per poll cycle + per purchase
- Segment-specific pricing multipliers
- Segment-specific locked response intervals (12h–72h)
- Segment-specific reminder message copy (6 variants)
- Segment-specific follow-up queries (6 lists in CRM dashboard)

#### Buyer Intelligence
- HOT / WARM / COLD classification (composite of temp, score, recency, intent)
- Purchase probability (0–100)
- Churn risk (0–100)
- Conversation health (0–100)
- Lifetime spend score (0–100)
- Last objection + last successful offer logging

#### CRM Intelligence
- 8 automatic tags (rule-based, applied/removed dynamically)
- AI conversation summary (topics, sentiment, last snippet)
- Suggested next action (8-strategy rule engine)
- Favorite content type (photos/videos/custom/voice)
- Contact health composite (0–100)
- Operator notes integration

#### Revenue Analytics
- Revenue by offer tier (5 amount brackets)
- Revenue by segment (count + revenue)
- Funnel conversion (5-stage with 4 conversion rates)
- Reminder conversion (locked response → purchase)
- Re-engagement conversion (14d+ silence → purchase)
- Repeat purchase rate, LTV, AOV
- Top 10 buyers, top 5 offers

#### Automation
- Stale lead detection (7d+ inactive → AI re-engagement)
- Failed unlock recovery (paid → non-PAID state fix)
- VIP follow-up (45d+ inactive VIPs)
- Whale follow-up (60d+ inactive whales)
- Daily CRM summary
- Retry queue (3 action types, max 3 retries)
- Production cron verification endpoint

#### Production Hardening
- Stale poll lock recovery (5-min timeout)
- Transaction-safe database operations
- Purchase idempotency check
- Webhook signature verification
- CRON_SECRET auth on all automation endpoints
- CRM_API_KEY auth on dashboard + non-public API routes
- Media file/preview accessible without auth (isMediaUnlocked gate)
- Media CRUD routes protected by middleware
- Backfill for ALTER TABLE default values on existing rows

### Database

- 14 tables, 10+ indexes
- 20 ALTER TABLE migrations (safe to re-run)
- V2 columns: emotional_temp, relationship_score, offer tracking, spend_segment, buyer intelligence, CRM intelligence

### Tests

- 54 automated tests covering:
  - Pricing tier calculation
  - Intent detection (boolean + numerical scoring)
  - Media unlock logic
  - Purchase idempotency
  - Emotional temperature keywords
  - Offer cooldown logic
  - Post-purchase phase detection
  - Dynamic pacing rules
  - Upsell ladder logic
- Clean TypeScript compilation
- Zero ESLint warnings

### Known Limitations

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for full details.
