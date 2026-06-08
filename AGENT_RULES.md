# Agent Rules

1. Read actual code before modifying anything.
2. Trace execution flow before changing files.
3. Reuse existing APIs.
4. Reuse existing UI patterns.
5. Avoid schema changes unless absolutely necessary.
6. Small checkpoints only.
7. Never rewrite working systems.
8. Preserve backward compatibility.

For every checkpoint return:

- Goal
- Files Modified
- Execution Flow
- Risks
- Regression Checklist

Priorities:

S1 - Telegram sending architecture
S2 - Sidebar race condition
S3 - Cache invalidation
S4 - Runtime error handling
S5 - Release audit

Do not add features.
Do not work on AI Assistant.
Do not work on Contact Capture.
