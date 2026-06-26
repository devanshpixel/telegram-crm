# BRAIN.md

> **Project Decision Engine (LOCKED)**

## Purpose

This document defines **how decisions are made**.

Do not optimize for: - More code - More features - Bigger architecture

Optimize for: - Reliability - Revenue - Maintainability - Verified
outcomes

------------------------------------------------------------------------

# Mission

Ship the smallest product that consistently:

-   works
-   converts qualified users
-   supports repeat purchases
-   can be safely extended later

------------------------------------------------------------------------

# Decision Framework

Before implementing anything ask:

1.  What problem does this solve?
2.  Is the problem real or assumed?
3.  Is there evidence?
4.  Is this the smallest solution?
5.  Can the current architecture support it?
6.  Will this increase reliability, conversion, AOV, retention, or
    reduce failures?
7.  Can it ship within the current sprint?

If most answers are "No", do not implement it.

------------------------------------------------------------------------

# Evidence First

Never rely on assumptions.

Collect evidence from:

-   code
-   logs
-   tests
-   production behavior
-   user reports

Treat opinions as hypotheses until verified.

------------------------------------------------------------------------

# Revenue Impact Score

Classify every task.

## High

Examples:

-   broken payments
-   Telegram failures
-   poor conversation quality
-   offer timing
-   repeat purchase flow
-   webhook failures

Do immediately.

## Medium

Examples:

-   analytics
-   testing improvements
-   refactoring with measurable benefit

Do after High.

## Low

Examples:

-   visual polish
-   animations
-   cosmetic refactors
-   dashboard redesign

Backlog.

------------------------------------------------------------------------

# Engineering Philosophy

Prefer:

-   simple
-   predictable
-   testable
-   reversible

Avoid:

-   clever code
-   unnecessary abstractions
-   speculative optimization

------------------------------------------------------------------------

# Product Philosophy

Conversation exists to:

-   qualify
-   engage
-   convert
-   retain

Not to maximize free chatting.

------------------------------------------------------------------------

# Feature Acceptance

A feature is accepted only if at least one is true:

-   increases conversion
-   improves repeat purchases
-   improves reliability
-   reduces operational cost
-   improves maintainability without delaying launch

Otherwise reject or postpone.

------------------------------------------------------------------------

# Self Review

Before every commit:

-   Root cause fixed?
-   Regression risk checked?
-   Existing architecture preserved?
-   Tests completed?
-   Logs reviewed?
-   Documentation updated if needed?

------------------------------------------------------------------------

# Failure Recovery

If a change fails:

1.  Stop.
2.  Identify cause.
3.  Reproduce.
4.  Roll back if required.
5.  Implement safer solution.
6.  Verify again.

Never hide failures.

------------------------------------------------------------------------

# Anti-Patterns

Never:

-   rewrite because it is "cleaner"
-   change providers without evidence
-   edit secrets
-   remove working code without proof
-   claim "done" before verification

------------------------------------------------------------------------

# Sprint Loop

Repeat until launch:

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

Never wait for the next prompt if meaningful verified work remains.

------------------------------------------------------------------------

# Launch Checklist

Required:

-   Production stable
-   Telegram verified
-   Payments verified
-   Unlock verified
-   Conversation quality reviewed
-   Critical bugs resolved
-   Rollback available

Launch only after all are complete.

------------------------------------------------------------------------

# Final Rule

Think like the owner of the product.

Protect reliability.

Protect revenue.

Protect user experience.

When trade-offs exist:

Choose the option with the highest long-term business value and the
lowest operational risk.
