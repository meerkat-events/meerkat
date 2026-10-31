// Deploy smoke test: Fly runs it as a machine check (fly.template.toml) in a
// throwaway Machine before the canary gets traffic; a non-zero exit stops the
// deploy. Checks the API and a server-rendered page. Locally:
//   SMOKE_TEST_BASE_URL=http://localhost:8000 node scripts/smoke-test.ts

import { setTimeout as sleep } from "node:timers/promises";

const PATHS = ["/api/v1/health", "/login"];
const ATTEMPTS = 15;
const DELAY_MS = 2000;

function baseUrl(): string {
  const explicit = process.env["SMOKE_TEST_BASE_URL"];
  if (explicit) {
    return explicit;
  }
  const machineIp = process.env["FLY_TEST_MACHINE_IP"];
  if (!machineIp) {
    throw new Error("Set FLY_TEST_MACHINE_IP or SMOKE_TEST_BASE_URL");
  }
  return `http://[${machineIp}]:8000`;
}

// Retries until the server answers, since the app may still be starting.
async function check(url: string): Promise<void> {
  let lastProblem = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status === 200) {
        console.log(`ok ${url}`);
        return;
      }
      lastProblem = `HTTP ${response.status}`;
    } catch (error) {
      lastProblem = String(error);
    }
    await sleep(DELAY_MS);
  }
  throw new Error(`${url}: ${lastProblem}`);
}

const base = baseUrl();
for (const path of PATHS) {
  await check(base + path);
}
