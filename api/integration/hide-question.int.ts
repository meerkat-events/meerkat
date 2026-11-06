import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  getPresenterEvent,
  getStagePresenterEvent,
} from "../app/lib/presenter-event.server.ts";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  postedQuestionUid,
  request,
  resetDb,
  seedConference,
  type TestUser,
  upvote,
} from "./helpers.ts";

type ListedQuestion = { uid: string };

describe("hiding a question", () => {
  let eventUid: string;
  let stage: string;
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
    stage = event.stage;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
    moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conference.id, "moderator");
    author = await anonymousUser();

    questionUid = await postedQuestionUid(eventUid, author);
  });

  test("its author still sees it, nobody else does", async () => {
    const voter = await anonymousUser();
    assert.equal((await upvote(questionUid, voter)).status, 200);

    assert.equal((await hide(moderator)).status, 200);

    assert.deepEqual(await listedUids(author), [questionUid]);
    assert.deepEqual(await listedUids(), []);
    assert.deepEqual(await listedUids(voter), []);
    assert.deepEqual(await listedUids(await anonymousUser()), []);
    assert.deepEqual(await listedUids(moderator), []);
  });

  test("the presenter view and the stage screen leave it out", async () => {
    assert.equal((await hide(moderator)).status, 200);

    const presented = await getPresenterEvent(eventUid);
    assert.deepEqual(presented.questions, []);
    assert.equal(presented.votes, 0);
    const onStage = await getStagePresenterEvent(stage);
    assert.equal(onStage.uid, eventUid);
    assert.deepEqual(onStage.questions, []);
  });

  test("hiding the question on stage takes it off the presenter view", async () => {
    const selected = await request(
      "POST",
      `/api/v1/questions/${questionUid}/select`,
      { token: moderator.token },
    );
    assert.equal(selected.status, 200);
    assert.deepEqual(
      (await getPresenterEvent(eventUid)).questions.map((q) => q.uid),
      [questionUid],
    );

    assert.equal((await hide(moderator)).status, 200);

    assert.deepEqual((await getPresenterEvent(eventUid)).questions, []);
  });

  test("hiding the question on stage unselects it without answering it", async () => {
    const selected = await request(
      "POST",
      `/api/v1/questions/${questionUid}/select`,
      { token: moderator.token },
    );
    assert.equal(selected.status, 200);

    assert.equal((await hide(moderator)).status, 200);

    const response = await request(
      "GET",
      `/api/v1/events/${eventUid}/questions`,
      { token: author.token },
    );
    const { data } = await response.json() as {
      data: { uid: string; selectedAt: string | null; answeredAt: string | null }[];
    };
    assert.equal(data[0]?.uid, questionUid);
    assert.equal(data[0]?.selectedAt ?? null, null);
    assert.equal(data[0]?.answeredAt ?? null, null);
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
