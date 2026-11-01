import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Starts a process the way main.ts runs (`node --import ./instrumentation.ts`)
// against a stand-in PostHog, writes one log line and shuts telemetry down,
// which sends what is buffered.
const LOG_ONE_LINE = `
const { default: logger } = await import("./logger.ts");
logger.info("instrumentation test");
const { shutdownTelemetry } = await import("./instrumentation.ts");
await shutdownTelemetry();
`;

/** Runs LOG_ONE_LINE and returns the paths it sent requests to. */
async function pathsSentToPostHog() {
  const paths: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url ?? "");
    request.resume();
    request.on("end", () => response.end("{}"));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const child = spawn(
      process.execPath,
      ["--import", "./instrumentation.ts", "--input-type=module", "--eval", LOG_ONE_LINE],
      {
        cwd: import.meta.dirname,
        stdio: ["ignore", "ignore", "inherit"],
        // Only what env.ts requires; nothing connects to the database.
        env: {
          PATH: process.env["PATH"],
          DATABASE_URL: "unused",
          DEVCON_VERIFICATION_SECRET: "unused",
          SUPABASE_SERVICE_ROLE_KEY: "unused",
          POSTHOG_PROJECT_TOKEN: "test",
          POSTHOG_HOST: `http://127.0.0.1:${port}`,
        },
      },
    );
    const exitCode = await new Promise((resolve) => child.on("exit", resolve));
    assert.equal(exitCode, 0);
  } finally {
    server.close();
  }
  return paths;
}

// Pino is instrumented only if it loads after instrumentation.ts has
// registered the hook, so nothing instrumentation.ts imports may load
// logger.ts.
test("log lines are sent to PostHog", async () => {
  const paths = await pathsSentToPostHog();
  assert.ok(paths.includes("/i/v1/logs"), `requests: ${paths.join(", ")}`);
});
