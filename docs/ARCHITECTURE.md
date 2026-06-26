# ARCHITECTURE.md

> **Architecture Contract (LOCKED)**

## Purpose

This document explains how the system is organized.

It is **not** a redesign proposal.

Claude must understand the existing architecture before changing any
code.

------------------------------------------------------------------------

# Architecture Philosophy

Improve.

Do not replace.

Refactor only when it provides measurable benefits and does not increase
launch risk.

------------------------------------------------------------------------

# Locked Stack

Frontend - Next.js - React - TypeScript - TailwindCSS

Backend - Next.js Route Handlers - TypeScript

Messaging - GramJS

Database - Turso (Production) - SQLite (Local if present)

Payments - Razorpay

LLM - OpenRouter

Deployment - Vercel

------------------------------------------------------------------------

# High-Level Flow

``` text
Telegram User
      │
      ▼
Telegram Client (GramJS)
      │
      ▼
Conversation Engine
      │
      ├──────────────┐
      ▼              ▼
Business Logic   OpenRouter
      │
      ▼
Offer Engine
      │
      ▼
Razorpay
      │
      ▼
Webhook
      │
      ▼
Database
      │
      ▼
Unlock + Analytics
```

Every code change should preserve this flow.

------------------------------------------------------------------------

# System Layers

## Layer 1 -- Transport

Responsible for:

-   Telegram connectivity
-   Receiving messages
-   Sending replies
-   Session management

Must remain stable.

------------------------------------------------------------------------

## Layer 2 -- Conversation

Responsible for:

-   qualification
-   context
-   conversation state
-   response generation
-   offer timing

Business logic belongs here.

------------------------------------------------------------------------

## Layer 3 -- Revenue

Responsible for:

-   offers
-   purchases
-   reminders
-   segmentation
-   re-engagement

Never mix payment logic into UI.

------------------------------------------------------------------------

## Layer 4 -- Persistence

Responsible for:

-   users
-   conversations
-   purchases
-   analytics

Database changes must be backwards compatible whenever possible.

------------------------------------------------------------------------

## Layer 5 -- Presentation

Dashboard only displays system state.

Never move business logic into the frontend.

------------------------------------------------------------------------

# API Principles

Every API should:

-   validate input
-   return predictable errors
-   avoid hidden side effects
-   log failures

------------------------------------------------------------------------

# Database Rules

Never:

-   delete production data casually
-   rename columns without migration
-   introduce breaking schema changes

Prefer additive migrations.

------------------------------------------------------------------------

# Environment Rules

Never modify:

-   .env
-   API keys
-   Telegram sessions
-   production secrets

without explicit approval.

Read configuration.

Do not rewrite configuration.

------------------------------------------------------------------------

# Error Handling

Every critical failure should:

-   produce logs
-   return useful errors
-   avoid silent failure
-   fail safely

------------------------------------------------------------------------

# Logging

Important events:

-   Telegram receive
-   Telegram send
-   AI generation
-   Offer created
-   Payment created
-   Webhook received
-   Unlock completed
-   Errors

Logs should help reproduce bugs.

------------------------------------------------------------------------

# Performance

Optimize only after correctness.

Correctness

↓

Reliability

↓

Performance

Never reverse this order.

------------------------------------------------------------------------

# Refactoring Policy

Before refactoring ask:

-   Is the current code incorrect?
-   Is it blocking delivery?
-   Is the benefit measurable?
-   Can it be tested safely?

If not, postpone.

------------------------------------------------------------------------

# Production Checklist

Every deployment should verify:

-   Telegram works
-   AI replies
-   Offer flow
-   Payment
-   Webhook
-   Unlock
-   Database writes
-   Logs

------------------------------------------------------------------------

# Definition of Architectural Success

The architecture is successful when:

-   easy to debug
-   easy to extend
-   production stable
-   no unnecessary complexity
-   business flow preserved

Do not optimize architecture at the cost of launch.
