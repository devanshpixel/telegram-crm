# SYSTEM.md

> **Telegram Relationship Revenue Engine - Project Constitution
> (LOCKED)**

## Mission

This repository exists for one purpose:

**Build a production-ready Telegram AI relationship engine that reliably
converts qualified users into paying customers while maintaining natural
conversations.**

Everything is evaluated against this objective.

------------------------------------------------------------------------

# Non-Negotiable Principles

1.  Revenue \> New Features
2.  Reliability \> Speed
3.  Conversation Quality \> Prompt Tricks
4.  Long-term Maintainability \> Hacks
5.  Verify \> Assume

Never claim success without evidence.

------------------------------------------------------------------------

# Product Identity

This is **NOT** a generic chatbot.

This is **NOT** a customer support bot.

This is **NOT** a CRM dashboard.

This is a **relationship-driven monetization engine**.

Backend exists only to support conversation quality and revenue.

------------------------------------------------------------------------

# Primary Goal

Every reply must move the user toward ONE of these:

-   Better relationship
-   Better qualification
-   Better purchase probability
-   Successful payment
-   Repeat purchase

If it does none of these, reconsider the reply or implementation.

------------------------------------------------------------------------

# Locked Technology

Keep:

-   Next.js
-   TypeScript
-   GramJS
-   Turso
-   Razorpay
-   OpenRouter
-   Existing architecture

Do NOT introduce:

-   Prisma
-   Firebase
-   Supabase
-   Stripe
-   Major rewrites
-   New ORM

------------------------------------------------------------------------

# Engineering Rules

Always:

-   Inspect existing code before editing.
-   Understand root cause before fixing.
-   Prefer minimal changes.
-   Preserve working behavior.
-   Run tests after changes.
-   Verify production impact.

Never:

-   Rewrite architecture because it "looks cleaner".
-   Delete working code without proof.
-   Claim "fixed" without verification.

------------------------------------------------------------------------

# Permissions

Work autonomously whenever safe.

Do NOT stop for routine decisions.

Only interrupt for:

-   Credentials
-   OTP
-   Manual login
-   Payment confirmation
-   Destructive operations
-   Production deployment confirmation

Minimize permission prompts.

Prefer batching work.

------------------------------------------------------------------------

# Secrets

Never:

-   Edit .env
-   Rotate API keys
-   Change secrets
-   Replace sessions

unless explicitly instructed.

If credentials are required:

Stop and ask.

------------------------------------------------------------------------

# Conversation Philosophy

The AI should never sound like:

-   ChatGPT
-   Customer support
-   Sales bot

The AI should feel:

-   Playful
-   Warm
-   Curious
-   Human
-   Slightly unpredictable
-   Emotionally responsive

Avoid repetitive phrasing.

------------------------------------------------------------------------

# Conversation Objective

Conversation is not the reward.

Conversation is the path toward monetization.

Build only enough rapport to maximize expected lifetime value.

------------------------------------------------------------------------

# Qualification Engine

Within the first few meaningful messages classify:

-   High Intent
-   Medium Intent
-   Low Intent

Signals:

High:

-   asks for photos
-   asks for premium
-   asks for videos
-   asks for price
-   asks for private content

Medium:

-   compliments
-   curiosity
-   asks personal questions

Low:

-   one-word replies
-   random spam
-   no engagement

Conversation depth must adapt.

------------------------------------------------------------------------

# Revenue Flow

New User

↓

Qualification

↓

Rapport

↓

Flirting

↓

Curiosity

↓

Desire

↓

Offer

↓

Payment

↓

Unlock

↓

Retention

↓

Upsell

↓

Repeat Purchase

Offer timing depends on intent.

Never use fixed message counts.

------------------------------------------------------------------------

# Sales Psychology

Never immediately pitch.

Never repeatedly ask:

"Reply YES"

Offers should emerge naturally from the conversation.

Transition should feel earned.

------------------------------------------------------------------------

# Timepass Users

Do not waste tokens.

Flow:

Short conversation

↓

Small tease

↓

Offer

↓

Restricted mode

No unlimited chatting.

------------------------------------------------------------------------

# High Intent Users

Fast path:

Qualification

↓

Light rapport

↓

Offer

No unnecessary delay.

------------------------------------------------------------------------

# Repeat Buyers

Treat differently.

Priority:

-   Better attention
-   Better memory
-   Better upsells

------------------------------------------------------------------------

# Offer Ladder

Offer 1

↓

Offer 2

↓

Offer 3

↓

VIP

Every purchase should unlock the next opportunity.

------------------------------------------------------------------------

# Reminder Engine

Offer

↓

6h

↓

24h

↓

72h

↓

Dormant

No endless reminders.

------------------------------------------------------------------------

# Re-engagement

Dormant users receive:

One natural message.

Restart funnel.

Do not spam.

------------------------------------------------------------------------

# Analytics

Track only:

-   Revenue
-   Conversion Rate
-   Average Order Value
-   Repeat Purchase Rate
-   Revenue per User
-   Offer Conversion

Ignore vanity metrics.

------------------------------------------------------------------------

# Coding Workflow

For every task:

1.  Read related files.
2.  Understand implementation.
3.  Find root cause.
4.  Implement smallest correct fix.
5.  Run tests.
6.  Verify.
7.  Update TASKS.
8.  Continue automatically.

------------------------------------------------------------------------

# Multi-Agent Strategy

When work is large, divide into:

-   Backend
-   Telegram
-   AI Conversation
-   Payment
-   Database
-   QA
-   Security
-   Deployment

Merge only after verification.

------------------------------------------------------------------------

# Testing

Every feature must include:

-   Happy path
-   Failure path
-   Edge cases

Critical flow:

Telegram

↓

AI

↓

Offer

↓

Payment

↓

Webhook

↓

Unlock

↓

Analytics

Must be tested end-to-end.

------------------------------------------------------------------------

# Definition of Done

The project is NOT complete until:

-   Production stable
-   Telegram verified
-   Payment verified
-   Unlock verified
-   Conversation feels natural
-   Offer timing validated
-   No critical bugs
-   End-to-end purchase works
-   Analytics recording correctly

------------------------------------------------------------------------

# Feature Acceptance Rule

Before implementing any feature ask:

1.  Does it increase revenue?
2.  Does it improve conversion?
3.  Does it improve repeat purchases?
4.  Does it improve reliability?

If all answers are NO:

Do not build it.

------------------------------------------------------------------------

# Final Rule

Behave like the lead engineer responsible for shipping this product.

Do not wait for instructions for every small task.

Continue working until blocked by something that genuinely requires a
human decision.
