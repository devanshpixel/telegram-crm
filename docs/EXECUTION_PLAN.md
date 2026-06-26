# EXECUTION_PLAN.md

> **48-Hour Production Sprint (LOCKED)**

## Purpose

This document defines **how work is executed**.

It is the operating plan for Claude Code.

Do not skip phases.

Do not work on low-value features while higher priority work remains.

------------------------------------------------------------------------

# Mission

Deliver a production-ready Telegram relationship engine that:

-   reliably works
-   converts qualified users
-   minimizes operational failures
-   is ready for real users

Feature count is NOT a success metric.

Revenue reliability is.

------------------------------------------------------------------------

# Golden Rules

1.  Never rewrite the architecture.
2.  Never edit `.env`, secrets, API keys or sessions without explicit
    approval.
3.  Never claim success without verification.
4.  Never stop after one fix if related issues remain.
5.  Prefer one verified fix over five speculative improvements.
6.  Every code change must have a business reason.

------------------------------------------------------------------------

# Definition of Priority

Always work in this order:

P0 → Production blockers

P1 → Revenue blockers

P2 → Conversation quality

P3 → Testing

P4 → Analytics

P5 → Nice-to-have improvements

Never reverse this order.

------------------------------------------------------------------------

# Phase 0 --- Repository Audit

Before writing code:

-   Read SYSTEM.md
-   Read PRODUCT.md
-   Read PERSONA.md
-   Read CONVERSATION_ENGINE.md
-   Read CLAUDE.md

Then inspect the repository.

Build an internal understanding of:

-   architecture
-   routing
-   API endpoints
-   Telegram flow
-   payment flow
-   database schema
-   deployment

Do not modify anything yet.

Deliver:

-   Architecture summary
-   Bug list
-   Missing features
-   Risk list
-   Execution order

------------------------------------------------------------------------

# Phase 1 --- Production Audit

Verify:

-   Telegram authentication
-   Incoming messages
-   Outgoing replies
-   Scheduler
-   Polling
-   Webhooks
-   Razorpay
-   Unlock flow
-   Turso
-   Environment loading
-   Error logging

Fix production failures before anything else.

------------------------------------------------------------------------

# Phase 2 --- End-to-End Verification

Verify the complete user journey:

Telegram

↓

Conversation

↓

Offer

↓

Payment

↓

Webhook

↓

Database

↓

Unlock

↓

Analytics

Collect evidence.

Never assume.

------------------------------------------------------------------------

# Phase 3 --- Conversation Audit

Inspect:

-   generic replies
-   repetitive replies
-   robotic transitions
-   unnatural sales
-   poor offer timing
-   weak rapport

Fix root causes.

Do not patch prompts blindly.

------------------------------------------------------------------------

# Phase 4 --- Revenue Audit

Review:

-   qualification
-   intent detection
-   offer timing
-   offer ladder
-   reminder flow
-   restricted mode
-   re-engagement

Prioritize changes expected to improve:

-   conversion
-   repeat purchases
-   reliability

------------------------------------------------------------------------

# Phase 5 --- Testing

Every completed change must be verified.

Minimum:

-   unit/integration tests where appropriate
-   manual end-to-end validation
-   log inspection
-   regression check

No feature is complete without testing.

------------------------------------------------------------------------

# Phase 6 --- Deployment Readiness

Before deployment:

Confirm:

-   no critical errors
-   payment working
-   Telegram working
-   conversation verified
-   production configuration unchanged
-   rollback possible

Only then request deployment approval.

------------------------------------------------------------------------

# Multi-Agent Responsibilities

When work is large, internally split into:

## Architecture Agent

Understand structure.

## Backend Agent

API, database, business logic.

## Telegram Agent

Messaging reliability.

## Conversation Agent

Natural responses.

## Revenue Agent

Qualification, offers, reminders.

## QA Agent

Testing and regressions.

## Security Agent

Credential safety.

Merge only verified work.

------------------------------------------------------------------------

# Autonomous Behaviour

Claude should continue working automatically until blocked.

Do NOT ask for approval to:

-   inspect files
-   refactor safely
-   add tests
-   improve logs
-   fix verified bugs
-   update documentation
-   reorganize non-breaking code

Pause ONLY for:

-   credentials
-   secrets
-   .env changes
-   irreversible actions
-   production deployment approval

------------------------------------------------------------------------

# Reporting Format

After each milestone report:

Completed: - ...

Verified: - ...

Remaining: - ...

Risks: - ...

Next action: - ...

Keep reports concise.

------------------------------------------------------------------------

# Completion Criteria

Sprint ends only when:

✓ Production stable

✓ End-to-end flow verified

✓ Critical bugs resolved

✓ Conversation quality improved

✓ Revenue flow validated

✓ Tests completed

✓ Documentation updated

If any item is incomplete, continue working.
