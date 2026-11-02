import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type ListedQuestion = { uid: string };

describe("hiding a question", () => {
  let eventUid: string;
  let organizer: TestUser;
  let moderator: TestUser;
  let author: TestUser;
  let questionUid: string;

  /** The uids of the event's questions as `viewer` gets them, or a guest. */
  const listedUids = async (viewer?: TestUser) => {
    const response = await request(
      "GET",
      `/api/v1/events/${eventUid}/questions`,
      viewer ? { token: viewer.token } : {},
    );
    assert.equal(response.status, 200);
    const { data } = await response.json() as { data: ListedQuestion[] };
    return data.map((q) => q.uid);
  };

  const hide = (user: TestUser) =>
    request("POST", `/api/v1/questions/${questionUid}/hide`, {
      token: user.token,
    });

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Hide" });
    eventUid = event.uid;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conference.id, "moderator");
    author = await anonymousUser();

    const asked = await request("POST", `/api/v1/events/${eventUid}/questions`, {
      token: author.token,
      body: { question: "How does this scale?" },
    });
    assert.equal(asked.status, 200);
    questionUid = (await asked.json() as { data: ListedQuestion }).data.uid;
  });

  test("its author still sees it, nobody else does", async () => {
    assert.equal((await hide(moderator)).status, 200);

    assert.deepEqual(await listedUids(author), [questionUid]);
    assert.deepEqual(await listedUids(), []);
    assert.deepEqual(await listedUids(await anonymousUser()), []);
    assert.deepEqual(await listedUids(moderator), []);
  });

  test("an organizer can restore it", async () => {
    assert.equal((await hide(moderator)).status, 200);

    const restored = await request(
      "POST",
      `/api/v1/questions/${questionUid}/restore`,
      { token: organizer.token },
    );
    assert.equal(restored.status, 200);
    assert.deepEqual(await listedUids(), [questionUid]);
  });

  test("only moderators and organizers may hide it", async () => {
    assert.equal((await hide(author)).status, 403);
    assert.equal((await hide(await anonymousUser())).status, 403);
    assert.deepEqual(await listedUids(), [questionUid]);
  });
});
