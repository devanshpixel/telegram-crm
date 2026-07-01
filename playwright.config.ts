import { defineConfig } from "@playwright/test";

// E2E config. Tests target the middleware auth boundary (login / logout /
// brute-force throttle), which short-circuits before any page render — so the
// suite needs no live Telegram, Razorpay, or database. The server is started
// from the existing production build with fixed test secrets.
const PORT = 3100;
export const TEST_CRM_KEY = "e2e-test-crm-key";
export const TEST_CRON_SECRET = "e2e-test-cron-secret";
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
  },
  webServer: {
    command: `next start -H 127.0.0.1 -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      CRM_API_KEY: TEST_CRM_KEY,
      CRON_SECRET: TEST_CRON_SECRET,
      NODE_ENV: "production",
    },
  },
});
