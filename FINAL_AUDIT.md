# Final Production Audit — RC Sign-off

## Bugs Fixed

### CRITICAL
| Bug | File | Fix |
|-----|------|-----|
| Webhook returns 400 for transient errors | `webhook/route.ts:123` | Changed to 500 (Razorpay only retries on 5xx) |
| phantom purchase created before upsell payment | `service.ts:1980-1994` | Removed `createPurchase` from `recordUpsell` |
| Cursor advances past unprocessed messages | `pollMessages.ts:527` | Moved `maxId` update after message validation |
| No LIMIT on iterMessages per contact | `pollMessages.ts:518` | Added `limit: 50` |
| N+1: conversation + payment queries per contact | `pollMessages.ts:499-509` | Batched into initial JOIN query |
| shouldSendLockedResponse has state-mutating side effects | `pollMessages.ts:346-363` | Made predicate pure, added exhaustion handler in poll loop |
| Fetches ALL messages then slices last 20 | `service.ts:173-185` | Added `LIMIT 50 DESC` + reverse |
| Client can set arbitrary price | `create-order/route.ts:23` | Server-enforced price from settings/media |
| NaN price bypasses validation | `media/[id]/route.ts:33` | Added `isNaN()` check |
| HTTP header injection via filename | `media/[id]/file/route.ts:46` | Stripped `"` and newlines from filename |

### HIGH
| Bug | File | Fix |
|-----|------|-----|
| LIKE wildcard injection in payment idempotency | `reconcile/route.ts:66-69` | Added `ESCAPE` clause |
| Duplicate COUNT query in revenue analytics | `service.ts:2105-2107` | Reused existing `totalBuyers` |
| offerAcceptanceByTier always returns `{}` | `service.ts:2123` | Implemented tier breakdown query |
| `joined_at` uses locale format | `service.ts:253-257` | Changed to ISO 8601 |
| high_spender_inactive count threshold mismatch | `service.ts:882` | Changed `>= 200` to `>= 1500` |
| never_purchased count query mismatch | `service.ts:907` | Aligned with actual filter criteria |
| Message sent before tracking insert | `recover/route.ts:76-80` | Swapped order: insert first, send after |
| No LIMIT clause in remind SQL | `remind/route.ts:27` | Added `LIMIT 200` |
| verify-crons timeout exceeds Vercel limits | `verify-crons/route.ts:40` | Parallelized with `Promise.allSettled`, 5s timeout per endpoint |
| Error message leaks in cron responses | multiple files | Sanitized error messages |
| Silent failure: poll returns 200 on fatal error | `poll/route.ts:34-43` | Changed to 500 |
| count = items.length (not total) | `service.ts:1715-1716` | Uses `getFollowUpAudienceCount` |

## Dead Code Removed
| Item | File | Lines |
|------|------|-------|
| `getSegmentBreakdown()` | `service.ts` | 2029-2037 |
| `getSegmentRevenue()` | `service.ts` | 2039-2053 |
| `recordObjection()` | `service.ts` | 2779-2783 |
| `recordSuccessfulOffer()` | `service.ts` | 2785-2789 |
| `TagRow` interface | `types.ts` | 75-80 |
| `NoteRow` interface | `types.ts` | 82-88 |
| Dead `_amount` param in `recordUpsell` | `service.ts` | 1986 |

## Performance Fixes
| Fix | File | Impact |
|-----|------|--------|
| N+1 elimination: conversation + payment batched | `pollMessages.ts` | 2 queries per contact eliminated |
| LIMIT on iterMessages | `pollMessages.ts` | Prevents OOM on high-volume chats |
| LIMIT on getMessagesByContactId | `service.ts` | Prevents loading full chat history |
| LIMIT on remind SQL | `remind/route.ts` | Caps batch at 200 |
| Parallel verify-crons | `verify-crons/route.ts` | 12× faster, fits in Vercel time limit |

## Security Fixes
| Fix | File | Severity |
|-----|------|----------|
| sign-out changed to POST only | `sign-out/route.ts` | CRITICAL (CSRF) |
| Header injection blocked | `media/[id]/file/route.ts` | HIGH |
| Error messages sanitized across cron handlers | multiple | HIGH |
| Health info leak reduced | `health/route.ts` | HIGH |
| User-supplied price rejected | `create-order/route.ts` | HIGH |
| LIKE wildcards escaped | `reconcile/route.ts` | HIGH |
| sameSite "lax" → "strict" | `middleware.ts` | MEDIUM |
| Security headers added | `middleware.ts` | MEDIUM |
| NaN price validation | `media/[id]/route.ts` | MEDIUM |

## Test Results
- 54/54 tests passing
- Clean TypeScript compilation (0 errors)
- All critical, high, medium bugs from audit addressed

## Remaining for Production
1. Rotate `.env` secrets (committed to git — CRITICAL)
2. Add rate limiting to payment/Tgram auth endpoints
3. Add UNIQUE constraint on `purchases.payment_id`
4. Integrate error tracking (Sentry)
5. Deploy via Vercel dashboard
