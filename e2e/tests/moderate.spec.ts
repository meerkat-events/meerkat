import {
  emailUser,
  expect,
  grantTestRole,
  insertQuestion,
  resetDb,
  seedConference,
  signIn,
  test,
} from "./fixtures.ts";

test.beforeEach(async () => {
  await resetDb();
});

test("a moderator selects a question and the stage screen shows it", async ({ page, openPage }) => {
  const { conference, event } = await seedConference({ name: "Moderate" });
  const asker = await emailUser("asker@example.com");
  await insertQuestion(event.id, asker.id, "rollup-question");
  const moderator = await emailUser("moderator@example.com");
  await grantTestRole(moderator.id, conference.id, "moderator");

  const stageScreen = await openPage();
  await stageScreen.goto(`/stage/${event.stage}`);
  const onScreen = stageScreen.getByRole("listitem")
    .filter({ hasText: "Question rollup-question" });
  await expect(onScreen).toBeVisible();
  await expect(onScreen.getByText("Answering")).toHaveCount(0);

  await signIn(page, "moderator@example.com", event.uid);
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Select for answering" }).click();

  // Over the stream, without a reload
  await expect(onScreen.getByText("Answering")).toBeVisible();
});
