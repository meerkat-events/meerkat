/**
 * What every spec shares: a page that fails the test on errors the user
 * would hit, and signing in the way ticket holders do, through the Devcon
 * handover. Database setup comes from the integration tests' db-helpers.ts,
 * against the same local stack (scripts/test-e2e.sh sets its environment).
 */
import { expect, test as base, type Page } from "@playwright/test";
import { handoverToken } from "../../api/integration/db-helpers.ts";

export * from "../../api/integration/db-helpers.ts";
export { expect };

// Console errors that mean the page broke: a hydration mismatch between the
// server's render and the browser's, or an error React recovered from by
// rendering again. Failed requests (an expected 401 or 429) and stream
// reconnects log errors too, and don't count.
const BROKEN_PAGE_MESSAGES = /hydrat|did not match|recoverable error|Minified React error/i;

/** Collects what broke on a page while a test ran. */
function watchForErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && BROKEN_PAGE_MESSAGES.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
}

export const test = base.extend<{ pageErrors: string[] }>({
  // Checked after every test, for the default page and any page a test opens
  // in its own browser context.
  pageErrors: [async ({ page, context }, use) => {
    const errors: string[] = [];
    watchForErrors(page, errors);
    context.on("page", (other) => watchForErrors(other, errors));
    await use(errors);
    expect(errors, "errors on the page").toEqual([]);
  }, { auto: true }],
});

/**
 * Signs `email` in on the event's Q&A page through the Devcon handover: the
 * page's loader verifies the token and hands the browser a session.
 */
export async function signIn(page: Page, email: string, eventUid: string) {
  const token = await handoverToken(email);
  await page.goto(`/e/${eventUid}/qa?token=${token}`);
  // The loader redirects without the token once the session is minted.
  await expect(page).not.toHaveURL(/token=/);
  await expect(page.getByPlaceholder("Type a question...")).toBeEditable();
}

/** Opens the event's Q&A page as a guest and joins anonymously. */
export async function joinAnonymously(page: Page, eventUid: string) {
  await page.goto(`/e/${eventUid}/qa`);
  await page.getByRole("button", { name: "Join conversation" }).click();
  await expect(page.getByPlaceholder("Type a question...")).toBeEditable();
}
