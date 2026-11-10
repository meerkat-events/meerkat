import {
  emailUser,
  expect,
  grantTestRole,
  insertConference,
  insertEvent,
  resetDb,
  signIn,
  test,
} from "./fixtures.ts";

const HOUR = 60 * 60 * 1000;

test.beforeEach(async () => {
  await resetDb();
});

test("the stage screen follows its stage to the session put live", async ({ page, openPage }) => {
  const conference = await insertConference("Go live");
  // Event titles are their uids (insertEvent).
  await insertEvent({
    conferenceId: conference.id,
    uid: "opening-keynote",
    stage: "main",
    startOffsetMs: -HOUR,
    endOffsetMs: HOUR,
    live: true,
  });
  await insertEvent({
    conferenceId: conference.id,
    uid: "next-panel",
    stage: "main",
    startOffsetMs: 2 * HOUR,
    endOffsetMs: 3 * HOUR,
  });
  const moderator = await emailUser("moderator@example.com");
  await grantTestRole(moderator.id, conference.id, "moderator");

  const stageScreen = await openPage();
  await stageScreen.goto("/stage/main");
  await expect(stageScreen.getByRole("heading", { name: "opening-keynote" })).toBeVisible();

  await signIn(page, "moderator@example.com", "next-panel");
  await page.getByRole("button", { name: "Go Live" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Go Live" }).click();

  // The `live` message makes the screen look the stage up and reload, well
  // before its 30-second poll would.
  await expect(stageScreen.getByRole("heading", { name: "next-panel" })).toBeVisible();
  await expect(stageScreen).toHaveURL(/\/stage\/main$/);
});
