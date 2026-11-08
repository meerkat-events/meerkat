import {
  emailUser,
  expect,
  insertQuestion,
  joinAnonymously,
  resetDb,
  seedConference,
  test,
} from "./fixtures.ts";

test.beforeEach(async () => {
  await resetDb();
});

test("an attendee votes for a question and takes the vote back", async ({ page }) => {
  const { event } = await seedConference({ name: "Vote" });
  const asker = await emailUser("asker@example.com");
  await insertQuestion(event.id, asker.id, "rollup-question");

  await joinAnonymously(page, event.uid);
  await page.getByRole("button", { name: "Upvote, 0 votes" }).click();

  const voted = page.getByRole("button", { name: "Upvote, 1 vote" });
  await expect(voted).toHaveAttribute("aria-pressed", "true");

  await voted.click();
  await expect(page.getByRole("button", { name: "Upvote, 0 votes" }))
    .toHaveAttribute("aria-pressed", "false");
});
