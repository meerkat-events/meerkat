import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { SCORING } from "../models/points.ts";
import { SUPERVOTE_WEIGHT } from "../models/supervotes.ts";
import { MIN_CONTRIBUTORS } from "../tiers.ts";
import { questions, users, votes } from "../schema.ts";
import {
  anonymousUser,
  emailUser,
  insertQuestion,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type Participant = {
  points: number;
  picked: number;
  votesReceived: number;
  tier: number | null;
  contributors: number;
};

const castVote = (questionId: number, user: TestUser, weight = 1) =>
  db.insert(votes).values({ questionId, userId: user.id, weight });

const banUntilTomorrow = (user: TestUser) =>
  db.update(users)
    .set({ bannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    .where(eq(users.id, user.id));

describe("points", () => {
  let conferenceId: number;
  let eventId: number;
  let viewer: TestUser;

  /** The participant's points as their profile shows them, or the status. */
  const participant = async (user: TestUser) => {
    const response = await request(
      "GET",
      `/api/v1/conferences/${conferenceId}/participants/${user.id}`,
      { token: viewer.token },
    );
    if (response.status !== 200) return response.status;
    return (await response.json() as { data: Participant }).data;
  };

  /** A new question by `author`, stored directly. */
  const questionBy = async (author: TestUser) => {
    const question = await insertQuestion(eventId, author.id, crypto.randomUUID());
    return question.id;
  };

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Points" });
    conferenceId = conference.id;
    eventId = event.id;
    viewer = await emailUser("viewer@example.com");
  });

  test("come from picks and from others' votes, a supervote counting three", async () => {
    const author = await emailUser("author@example.com");
    const voter = await emailUser("voter@example.com");
    const supervoter = await emailUser("supervoter@example.com");
    const picked = await questionBy(author);
    const notPicked = await questionBy(author);
    await db.update(questions)
      .set({ selectedAt: new Date(), answeredAt: new Date() })
      .where(eq(questions.id, picked));
    await castVote(picked, voter);
    await castVote(notPicked, voter);
    await castVote(picked, supervoter, SUPERVOTE_WEIGHT);
    // Cast before nobody could vote for their own question; still not counted
    await castVote(picked, author);

    const expectedVotes = 2 + SUPERVOTE_WEIGHT;
    const points = await participant(author);
    assert.ok(typeof points === "object");
    assert.equal(points.points, SCORING.picked + expectedVotes * SCORING.vote);
    assert.equal(points.picked, 1);
    assert.equal(points.votesReceived, expectedVotes);
    // The author, the voter and the supervoter
    assert.equal(points.contributors, 3);
  });

  test("leave out hidden and deleted questions", async () => {
    const author = await emailUser("author@example.com");
    const voter = await emailUser("voter@example.com");
    const visible = await questionBy(author);
    const hidden = await questionBy(author);
    const deleted = await questionBy(author);
    await db.update(questions).set({ hiddenAt: new Date(), selectedAt: new Date() })
      .where(eq(questions.id, hidden));
    await db.update(questions).set({ deletedAt: new Date() })
      .where(eq(questions.id, deleted));
    for (const questionId of [visible, hidden, deleted]) {
      await castVote(questionId, voter);
    }

    const points = await participant(author);
    assert.ok(typeof points === "object");
    assert.equal(points.points, SCORING.vote);
    assert.equal(points.picked, 0);
  });

  test("a voter who asked nothing has none, and no tier", async () => {
    const author = await emailUser("author@example.com");
    const voter = await emailUser("voter@example.com");
    await castVote(await questionBy(author), voter);

    const points = await participant(voter);
    assert.ok(typeof points === "object");
    assert.equal(points.points, 0);
    assert.equal(points.tier, null);
  });

  test("someone who neither asked nor voted isn't a participant", async () => {
    assert.equal(await participant(await emailUser("lurker@example.com")), 404);
  });

  test("a banned asker isn't a participant", async () => {
    const author = await emailUser("author@example.com");
    const voter = await emailUser("voter@example.com");
    await castVote(await questionBy(author), voter);
    await banUntilTomorrow(author);

    assert.equal(await participant(author), 404);
  });

  test("a banned voter isn't a participant, but their votes still count", async () => {
    const author = await emailUser("author@example.com");
    const voter = await emailUser("voter@example.com");
    await castVote(await questionBy(author), voter);
    await banUntilTomorrow(voter);

    assert.equal(await participant(voter), 404);
    const points = await participant(author);
    assert.ok(typeof points === "object");
    assert.equal(points.votesReceived, 1);
    assert.equal(points.contributors, 1);
  });

  describe("tiers", () => {
    /** Two askers and enough voters for `contributors` people in all. */
    async function conferenceOf(contributors: number) {
      const first = await anonymousUser();
      const second = await anonymousUser();
      const firstQuestion = await questionBy(first);
      const secondQuestion = await questionBy(second);
      const voters = await Promise.all(
        Array.from({ length: contributors - 2 }, () => anonymousUser()),
      );
      for (const voter of voters) {
        await castVote(firstQuestion, voter);
      }
      // One vote fewer, so `second` ranks below `first`
      for (const voter of voters.slice(1)) {
        await castVote(secondQuestion, voter);
      }
      return { first, second };
    }

    test(`need at least ${MIN_CONTRIBUTORS} contributors`, async () => {
      const { first } = await conferenceOf(MIN_CONTRIBUTORS - 1);

      const points = await participant(first);
      assert.ok(typeof points === "object");
      assert.equal(points.contributors, MIN_CONTRIBUTORS - 1);
      assert.equal(points.tier, null);
    });

    test(`rank the top of ${MIN_CONTRIBUTORS} in the top 10%`, async () => {
      const { first, second } = await conferenceOf(MIN_CONTRIBUTORS);

      const top = await participant(first);
      const runnerUp = await participant(second);
      assert.ok(typeof top === "object" && typeof runnerUp === "object");
      assert.equal(top.contributors, MIN_CONTRIBUTORS);
      assert.equal(top.tier, 10);
      assert.equal(runnerUp.tier, 10);
    });

    test("share the better tier on a tie", async () => {
      const { first, second } = await conferenceOf(MIN_CONTRIBUTORS);
      const tieBreaker = await anonymousUser();
      const [secondQuestion] = await db.select({ id: questions.id })
        .from(questions)
        .where(eq(questions.userId, second.id));
      await castVote(secondQuestion!.id, tieBreaker);

      const top = await participant(first);
      const tied = await participant(second);
      assert.ok(typeof top === "object" && typeof tied === "object");
      assert.equal(tied.points, top.points);
      assert.equal(tied.tier, top.tier);
    });
  });
});
