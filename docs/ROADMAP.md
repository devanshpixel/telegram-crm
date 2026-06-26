# ROADMAP.md

> **Master Roadmap (LOCKED)**
>
> This roadmap is the single source of truth for project priorities. Do
> not change priorities without a strong business reason.

------------------------------------------------------------------------

# Mission

Build the smallest production-ready Telegram relationship engine that:

-   reliably works
-   generates revenue
-   is easy to operate
-   is easy to extend later

Success is measured by **reliability and revenue**, not feature count.

------------------------------------------------------------------------

# Product Strategy

The product is built around this progression:

    Acquire User
          ↓
    Qualify User
          ↓
    Build Rapport
          ↓
    Create Curiosity
          ↓
    Natural Offer
          ↓
    Payment
          ↓
    Premium Experience
          ↓
    Retention
          ↓
    Upsell
          ↓
    Repeat Purchase

Conversation exists to support this journey.

------------------------------------------------------------------------

# Business KPIs

Primary KPIs

-   End-to-end payment success
-   First purchase conversion
-   Repeat purchase rate
-   Average Order Value (AOV)
-   Revenue per user

Secondary KPIs

-   Reply reliability
-   Conversation completion
-   Offer conversion
-   Payment completion

Ignore vanity metrics.

------------------------------------------------------------------------

# Locked Technology

Keep:

-   Next.js
-   TypeScript
-   GramJS
-   Turso
-   Razorpay
-   OpenRouter

Do NOT introduce:

-   Prisma
-   Firebase
-   Supabase
-   Stripe
-   Major architecture rewrites

------------------------------------------------------------------------

# Phase 0 --- Production Reliability (P0)

Goal:

A real user can complete the full journey without failure.

Checklist

-   Telegram stable
-   Incoming messages verified
-   Outgoing replies verified
-   AI generation verified
-   Razorpay verified
-   Webhook verified
-   Unlock verified
-   Scheduler verified
-   Database verified
-   Logging verified
-   Recovery from common failures

Exit Criteria

✓ Critical bugs = 0

✓ End-to-end purchase works

✓ Production logs clean

Nothing else starts before this phase is complete.

------------------------------------------------------------------------

# Phase 1 --- Core Conversation (P1)

Goal

Replace generic chatbot behavior with natural conversation.

Deliverables

-   Fast qualification
-   Natural replies
-   Context awareness
-   Reduced repetition
-   Better pacing
-   Human-like tone

Exit Criteria

Conversation feels consistent and natural.

------------------------------------------------------------------------

# Phase 2 --- Revenue Engine (P1)

Goal

Increase conversion using business logic, not longer chats.

Deliverables

-   Intent detection
-   Offer timing
-   Offer ladder
-   Spend segmentation
-   Restricted mode
-   Reminder flow
-   Re-engagement

Exit Criteria

Revenue flow verified.

------------------------------------------------------------------------

# Phase 3 --- Quality & Testing (P2)

Goal

Reduce regressions before launch.

Deliverables

-   Manual verification
-   Automated tests where practical
-   Error handling
-   Regression review

Exit Criteria

Critical flow verified.

------------------------------------------------------------------------

# Phase 4 --- Analytics (P3)

Track only:

-   Revenue
-   Conversion
-   AOV
-   Repeat purchases
-   Best-performing offers

Avoid unnecessary dashboards.

------------------------------------------------------------------------

# Explicitly Out of Scope

Do NOT build before launch:

-   Multiple creators
-   Multiple personas
-   WhatsApp
-   Instagram
-   Team accounts
-   Dark mode
-   Dashboard redesign
-   Cosmetic animations
-   Experimental AI features

Add them only after a successful launch.

------------------------------------------------------------------------

# Feature Acceptance Rule

Before building a feature ask:

1.  Does it improve reliability?
2.  Does it improve conversion?
3.  Does it improve repeat purchases?
4.  Does it reduce operational cost?

If all answers are "No":

Move it to the backlog.

------------------------------------------------------------------------

# Sprint Workflow

For every sprint:

Audit

↓

Prioritize

↓

Implement

↓

Test

↓

Verify

↓

Document

↓

Continue

------------------------------------------------------------------------

# Human Approval Required

Pause only for:

-   Credentials
-   .env changes
-   API keys
-   Secret rotation
-   Payment approval
-   Production deployment
-   Destructive actions

Everything else should continue autonomously.

------------------------------------------------------------------------

# Definition of Launch

Launch only when all are true:

-   Production stable
-   Telegram verified
-   AI verified
-   Payments verified
-   Unlock verified
-   Conversation quality approved
-   Revenue flow verified
-   Critical bugs resolved
-   Rollback plan available

------------------------------------------------------------------------

# Final Principle

When forced to choose between:

More features

or

Higher reliability

Always choose higher reliability.

When forced to choose between:

Longer conversations

or

Better conversions

Always choose better conversions.
