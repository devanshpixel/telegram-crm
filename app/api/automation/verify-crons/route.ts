import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_ENDPOINTS = [
  { path: "/api/telegram/poll", expected: 200 },
  { path: "/api/telegram/remind", expected: 200 },
  { path: "/api/telegram/reengage", expected: 200 },
  { path: "/api/razorpay/reconcile", expected: 200 },
  { path: "/api/razorpay/recover", expected: 200 },
  { path: "/api/health", expected: 200 },
  { path: "/api/automation/stale-leads", expected: 200 },
  { path: "/api/automation/failed-unlock", expected: 200 },
  { path: "/api/automation/vip-followup", expected: 200 },
  { path: "/api/automation/whale-followup", expected: 200 },
  { path: "/api/automation/daily-summary", expected: 200 },
  { path: "/api/automation/retry-queue", expected: 200 },
];

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-cron-secret");
    if (authHeader !== `Bearer ${secret}` && cronHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.APP_URL || "http://localhost:3000";

  const results: { path: string; status: number; ok: boolean; error?: string }[] = [];

  const outcomes = await Promise.allSettled(
    CRON_ENDPOINTS.map(async (ep) => {
      const url = `${baseUrl}${ep.path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          headers: {
            "x-cron-secret": secret || "",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        return { path: ep.path, status: res.status, ok: res.status === ep.expected };
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
  for (const o of outcomes) {
    if (o.status === "fulfilled") {
      results.push(o.value);
    } else {
      results.push({ path: "unknown", status: 0, ok: false, error: o.reason?.message ?? String(o.reason) });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    ok: allOk,
    checked: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    details: results,
  });
}

export const GET = handle;
export const POST = handle;
