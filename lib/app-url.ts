/**
 * Resolve the public base URL used for Razorpay callback redirects.
 *
 * Priority:
 *   1. APP_URL (set this explicitly in production to your real domain)
 *   2. VERCEL_URL (auto-set by Vercel at runtime — better than localhost)
 *   3. http://localhost:3000 (local dev fallback)
 */
export function getAppUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
