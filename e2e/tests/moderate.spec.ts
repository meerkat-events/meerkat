import {
  emailUser,
  expect,
  grantTestRole,
  insertQuestions,
  resetDb,
  seedConference,
  signIn,
  test,
} from "./fixtures.ts";

test.beforeEach(async () => {
  await resetDb();
});

test("a moderator selects a question and the stage screen shows it", async ({ page, browser }) => {
  const { conference, event } = await seedConference({ name: "Moderate" });
  const asker = await emailUser("asker@example.com");
  await insertQuestions({ eventId: event.id, userId: asker.id, count: 1 });
  const moderator = await emailUser("moderator@example.com");
  await grantTestRole(moderator.id, conference.id, "moderator");

  const stageScreen = await (await browser.newContext()).newPage();
  await stageScreen.goto(`/stage/${event.stage}`);
  const onScreen = stageScreen.getByRole("listitem")
    .filter({ hasText: "Earlier question 1" });
  await expect(onScreen).toBeVisible();
  await expect(onScreen.getByText("Answering")).toHaveCount(0);

  await signIn(page, "moderator@example.com", event.uid);
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Select for answering" }).click();

  // Over the stream, without a reload
  await expect(onScreen.getByText("Answering")).toBeVisible();
});
