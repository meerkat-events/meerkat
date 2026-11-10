import { expect, joinAnonymously, resetDb, seedConference, test } from "./fixtures.ts";

test.beforeEach(async () => {
  await resetDb();
});

test("an attendee asks a question and another attendee sees it", async ({ page, openPage }) => {
  const { event } = await seedConference({ name: "Ask" });
  const other = await openPage();
  await other.goto(`/e/${event.uid}/qa`);

  await joinAnonymously(page, event.uid);
  await page.getByPlaceholder("Type a question...").fill("How does the rollup settle?");
  await page.getByRole("button", { name: "Submit question" }).click();

  await expect(page.getByText("How does the rollup settle?")).toBeVisible();
  // Over the event's stream, without a reload
  await expect(other.getByText("How does the rollup settle?")).toBeVisible();
});
