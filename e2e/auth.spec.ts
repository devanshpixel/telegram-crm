import { test, expect, request as pwRequest } from "@playwright/test";
import { BASE_URL, TEST_CRM_KEY, TEST_CRON_SECRET } from "../playwright.config";

// These tests exercise the middleware auth boundary directly via the API
// request context. They deliberately avoid rendering dashboard pages (which
// would require a live DB) — every assertion is about the auth decision the
// middleware makes before the app is ever reached.

// Each test uses a fresh request context with a unique X-Forwarded-For so the
// per-IP brute-force counter never bleeds between tests.
async function ctx(ip: string) {
  return pwRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
}

test("unauthenticated dashboard request returns 401 sign-in page", async () => {
  const c = await ctx("10.0.0.1");
  const res = await c.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.text()).toContain("Unauthorized");
  await c.dispose();
});

test("unauthenticated API request returns 401 JSON", async () => {
  const c = await ctx("10.0.0.2");
  const res = await c.get("/api/stats", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  await c.dispose();
});

test("login via ?key sets httpOnly session cookie and strips the key", async () => {
  const c = await ctx("10.0.0.3");
  const res = await c.get(`/?key=${TEST_CRM_KEY}`, { maxRedirects: 0 });
  // Middleware redirects to the same URL with ?key removed.
  expect([302, 307, 308]).toContain(res.status());
  const location = res.headers()["location"] || "";
  expect(location).not.toContain("key=");
  const setCookie = res.headers()["set-cookie"] || "";
  expect(setCookie).toContain("crm_session=");
  expect(setCookie.toLowerCase()).toContain("httponly");
  await c.dispose();
});

test("wrong key does not authenticate", async () => {
  const c = await ctx("10.0.0.4");
  const res = await c.get("/?key=totally-wrong-key", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  await c.dispose();
});

test("valid session cookie authorizes and gets security headers", async () => {
  const c = await ctx("10.0.0.5");
  const res = await c.get("/api/stats", {
    headers: { cookie: `crm_session=${TEST_CRM_KEY}` },
    maxRedirects: 0,
  });
  // Auth passes at the middleware; downstream may 200 or 500 depending on DB,
  // but it must NOT be 401/429. Security headers are attached on the pass path.
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(429);
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  await c.dispose();
});

test("logout endpoint clears the session cookie", async () => {
  const c = await ctx("10.0.0.6");
  const res = await c.post("/api/auth/logout", {
    headers: { cookie: `crm_session=${TEST_CRM_KEY}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ success: true });
  const setCookie = res.headers()["set-cookie"] || "";
  expect(setCookie).toContain("crm_session=");
  // An expiring cookie: Max-Age=0 (or an Expires in the past).
  expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
  await c.dispose();
});

test("cron endpoint rejects missing secret and accepts the right one", async () => {
  const c = await ctx("10.0.0.7");
  const bad = await c.get("/api/automation/verify-crons", { maxRedirects: 0 });
  expect(bad.status()).toBe(401);
  const good = await c.get("/api/automation/verify-crons", {
    headers: { "x-cron-secret": TEST_CRON_SECRET },
    maxRedirects: 0,
  });
  // Right secret passes middleware — not a 401.
  expect(good.status()).not.toBe(401);
  await c.dispose();
});

test("brute-force throttle returns 429 after repeated failed key attempts", async () => {
  // Isolated IP so the counter starts clean. 10 failures allowed per window,
  // the 11th+ should be throttled.
  const c = await ctx("10.9.9.9");
  let sawLimit = false;
  for (let i = 0; i < 15; i++) {
    const res = await c.get("/?key=wrong-guess", { maxRedirects: 0 });
    if (res.status() === 429) {
      sawLimit = true;
      expect(res.headers()["retry-after"]).toBe("60");
      break;
    }
    expect(res.status()).toBe(401);
  }
  expect(sawLimit).toBe(true);
  await c.dispose();
});
