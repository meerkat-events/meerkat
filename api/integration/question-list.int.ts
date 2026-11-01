import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { questions } from "../schema.ts";
import {
  anonymousUser,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type ListedQuestion = {
  uid: string;
  question: string;
  votes: number;
  vote?: { weight: number } | null;
};

async function ask(eventUid: string, user: TestUser, question: string) {
  const response = await request(
    "POST",
    `/api/v1/events/${eventUid}/questions`,
    { token: user.token, body: { question } },
  );
  assert.equal(response.status, 200);
  const { data } = await response.json() as { data: { uid: string } };
  return data.uid;
}

async function list(
  eventUid: string,
  { user, query = "sort=popular" }: { user?: TestUser; query?: string } = {},
) {
  const response = await request(
    "GET",
    `/api/v1/events/${eventUid}/questions?${query}`,
    user ? { token: user.token } : {},
  );
  assert.equal(response.status, 200);
  const { data } = await response.json() as { data: ListedQuestion[] };
  return data;
}

describe("question list", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("a hidden question shows only in its author's list", async () => {
    const { event } = await seedConference({ name: "Hidden" });
    const author = await anonymousUser();
    const other = await anonymousUser();
    await ask(event.uid, other, "Visible question");
    const hiddenUid = await ask(event.uid, author, "Hidden question");
    await db.update(questions).set({ hiddenAt: new Date() })
      .where(eq(questions.uid, hiddenUid));

    const forGuest = await list(event.uid);
    const forOther = await list(event.uid, { user: other });
    const forAuthor = await list(event.uid, { user: author });

    assert.deepEqual(forGuest.map((q) => q.question), ["Visible question"]);
    assert.deepEqual(forOther.map((q) => q.question), ["Visible question"]);
    assert.deepEqual(
      forAuthor.map((q) => q.question).sort(),
      ["Hidden question", "Visible question"],
    );
  });

  test("a vote shows at once, with the voter's own vote", async () => {
    const { event } = await seedConference({ name: "Votes" });
    const author = await anonymousUser();
    const voter = await anonymousUser();
    const uid = await ask(event.uid, author, "Will this count?");
    assert.equal((await list(event.uid))[0]?.votes, 0);

    const vote = await request("POST", `/api/v1/questions/${uid}/upvote`, {
      token: voter.token,
    });
    assert.equal(vote.status, 200);
    const forVoter = await list(event.uid, { user: voter });
    const forAuthor = await list(event.uid, { user: author });
    const forGuest = await list(event.uid);

    assert.equal(forVoter[0]?.votes, 1);
    assert.deepEqual(forVoter[0]?.vote, { weight: 1 });
    assert.equal(forAuthor[0]?.vote, null);
    assert.equal(forGuest[0]?.votes, 1);
    assert.equal(forGuest[0]?.vote, undefined);
  });

  test("popular sorts by votes, newest by time", async () => {
    const { event } = await seedConference({ name: "Sorts" });
    const asker = await anonymousUser();
    const voter = await anonymousUser();
    const olderUid = await ask(event.uid, asker, "Older question");
    await ask(event.uid, asker, "Newer question");
    await request("POST", `/api/v1/questions/${olderUid}/upvote`, {
      token: voter.token,
    });

    const popular = await list(event.uid);
    const newest = await list(event.uid, { query: "sort=newest" });

    assert.deepEqual(
      popular.map((q) => q.question),
      ["Older question", "Newer question"],
    );
    assert.deepEqual(
      newest.map((q) => q.question),
      ["Newer question", "Older question"],
    );
  });

  test("answered filters the list", async () => {
    const { event } = await seedConference({ name: "Answered" });
    const asker = await anonymousUser();
    const answeredUid = await ask(event.uid, asker, "Answered question");
    await ask(event.uid, asker, "Open question");
    await db.update(questions).set({ answeredAt: new Date() })
      .where(eq(questions.uid, answeredUid));

    const answered = await list(event.uid, {
      user: asker,
      query: "sort=newest&answered=true",
    });
    const open = await list(event.uid, { query: "sort=newest&answered=false" });

    assert.deepEqual(answered.map((q) => q.question), ["Answered question"]);
    assert.deepEqual(open.map((q) => q.question), ["Open question"]);
  });

  test("the event's uid matches in any case", async () => {
    const { event } = await seedConference({ name: "Case" });

    const response = await request(
      "GET",
      `/api/v1/events/${event.uid.toUpperCase()}`,
    );

    assert.equal(response.status, 200);
  });
});
