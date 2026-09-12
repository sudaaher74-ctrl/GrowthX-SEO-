import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config.
 *
 * Runs against a production build, not `next dev`: the crash this suite exists
 * to catch behaved differently between the two, and production is what
 * customers get.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3210",
    trace: "retain-on-failure",
    // Set PLAYWRIGHT_CHROMIUM_PATH to run against a Chromium that is already on
    // the machine (some sandboxes ship one that predates this Playwright's
    // pinned build). Unset in CI, where `playwright install` provides its own.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Reuses an already-running server locally; CI always starts its own.
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3210",
        url: "http://127.0.0.1:3210/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
