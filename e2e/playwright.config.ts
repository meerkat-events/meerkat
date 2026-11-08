import { defineConfig, devices } from "@playwright/test";

// Run through scripts/test-e2e.sh, which starts the local Supabase stack,
// builds the app and sets the environment: E2E_PORT and the stack's
// variables. Playwright evaluates this file in every worker, so the port is
// chosen once, by the script, not here.
const port = process.env["E2E_PORT"];
if (!port) {
  throw new Error("E2E_PORT is not set: run the tests with scripts/test-e2e.sh");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  // Every test empties the one shared database.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  // Slower than the default, for the stage screen's jittered refetches.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // The built app, as `pnpm start` runs it, with the environment the script
    // passed in (no api/.env).
    command: "node --import ./instrumentation.ts ./main.ts",
    cwd: "../api",
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
