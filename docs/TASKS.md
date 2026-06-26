# TASKS.md

> **Live Execution Board (LOCKED)**

> This file is the single execution board for Claude Code.
>
> Keep it updated throughout the project. Never silently abandon work.
> Every completed task must move through:
>
> **TODO → IN PROGRESS → VERIFIED → DONE**

------------------------------------------------------------------------

# Rules

## Always

-   Work from highest priority to lowest.
-   Finish current critical task before starting another.
-   Verify every completed task.
-   Update this file after every milestone.

## Never

-   Mark DONE without verification.
-   Work on cosmetic improvements while critical bugs remain.
-   Leave partially completed work undocumented.

------------------------------------------------------------------------

# Priority Matrix

## P0 --- Critical

Anything that prevents revenue.

Examples:

-   Telegram broken
-   AI not replying
-   Payment failure
-   Webhook failure
-   Unlock failure
-   Database corruption
-   Production crash

Must be fixed immediately.

------------------------------------------------------------------------

## P1 --- High

Anything that directly affects conversion.

Examples:

-   Poor conversation quality
-   Generic AI replies
-   Wrong offer timing
-   Broken reminder flow
-   Repeat purchase issues

------------------------------------------------------------------------

## P2 --- Medium

Reliability improvements.

Examples:

-   Better logging
-   Test coverage
-   Error handling
-   Refactoring with measurable benefit

------------------------------------------------------------------------

## P3 --- Low

Post-launch only.

Examples:

-   Dashboard polish
-   UI improvements
-   Animations
-   Nice-to-have features

------------------------------------------------------------------------

# Execution Plan (from PROJECT_KNOWLEDGE.md)

| # | Task | Status |
|---|------|--------|
| 1 | **Make production storage safe** — BUG-2 (throw on no Turso in prod), BUG-1 (Turso transactions), missing indexes | DONE |
| 2 | **Harden the money path** — BUG-3 (webhook idempotency), BUG-4 (payment reconciliation) | PENDING |
| 3 | **Improve conversation conversion quality** — BUG-5 (one reply per burst), BUG-8 (Hinglish locked copy), [LINK] robustness | PENDING |
| 4 | **Fix currency consistency** to INR — BUG-6 | PENDING |
| 5 | **Add automated tests** — webhook, purchase/unlock, poll state machine, middleware | PENDING |
| 6 | **Complete extension PPV loop** — gallery + upload + unlock UI | PENDING |
| 7 | **Secrets & hygiene** — rotate committed keys, prune artifacts, quiet logging, rewrite stale docs | PENDING |
| 8 | **Lower-priority polish** — backup API/UI, message pagination, extension analytics/AI-mode/icons | PENDING |

------------------------------------------------------------------------

# Verification Log

## Batch 1: Production storage safety

| Task | Status | How Verified |
|------|--------|-------------|
| BUG-2: throw in production when Turso unconfigured | VERIFIED | `lib/db/index.ts:202-208` — `throw new Error(...)` replaces `console.error` |
| BUG-1: Turso transactions use tx handle | VERIFIED | `lib/db/adapters.ts:83-84` — `currentTx` flag routes `prepare()` calls to `tx.execute()` instead of `client.execute()` during transactions |
| Missing indexes in SCHEMA_SQL | VERIFIED | `lib/db/schema.ts:147-149` — 3 `CREATE INDEX IF NOT EXISTS` added |
| Build | PASS | `npx tsc --noEmit` exits clean |
| Lint | PASS | `npm run lint` — "No ESLint warnings or errors" |

------------------------------------------------------------------------

# Blockers

None.

------------------------------------------------------------------------

# Daily Summary

Completed:
  - BUG-2: Production DB guard now throws instead of logging
  - BUG-1: Turso transactions now execute on the tx handle
  - Missing indexes added to SCHEMA_SQL (3 indexes)
  - TASKS.md updated with execution plan

In Progress:
  - (none — ready for next task)

Blocked:
  - None

Next Highest Priority:
  Task 2: Harden the money path (BUG-3 webhook idempotency, BUG-4 payment reconciliation)

------------------------------------------------------------------------

# Completion Criteria

Project is complete only when:

-   Production stable
-   Telegram verified
-   AI verified
-   Payments verified
-   Unlock verified
-   Conversation quality approved
-   Revenue flow verified
-   Critical bugs resolved
-   Documentation updated

Do not stop before these conditions are satisfied.
