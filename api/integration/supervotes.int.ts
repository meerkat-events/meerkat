import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import db from "../db.ts";
import { getSupervoteBalance, SUPERVOTE_WEIGHT } from "../models/supervotes.ts";
import { supervoteBalances } from "../schema.ts";
import {
  emailUser,
  grantTestRole,
  postedQuestionUid,
  request,
  resetDb,
  seedConference,
  type TestUser,
  upvote,
} from "./helpers.ts";

type ListedQuestion = { uid: string; votes: number };

const supervote = (questionUid: string, user: TestUser) =>
  upvote(questionUid, user, SUPERVOTE_WEIGHT);

const giveSupervotes = (user: TestUser, balance: number) =>
  db.insert(supervoteBalances).values({ userId: user.id, balance });

describe("supervotes", () => {
  let eventUid: string;
  let author: TestUser;
  let voter: TestUser;
  let moderator: TestUser;

  const ask = (question: string) => postedQuestionUid(eventUid, author, question);

  const votesOn = async (questionUid: string) => {
    const response = await request("GET", `/api/v1/events/${eventUid}/questions`);
    const { data } = await response.json() as { data: ListedQuestion[] };
    return data.find((question) => question.uid === questionUid)?.votes;
  };

  const moderate = (path: string) =>
    request("POST", path, { token: moderator.token });

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Supervotes" });
    eventUid = event.uid;
    author = await emailUser("author@example.com");
    voter = await emailUser("voter@example.com");
    moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conference.id, "moderator");
  });

  test("spending one counts as three votes and lowers the balance", async () => {
    const questionUid = await ask("How does this scale?");
    await giveSupervotes(voter, 2);

    assert.equal((await supervote(questionUid, voter)).status, 200);

    assert.equal(await votesOn(questionUid), SUPERVOTE_WEIGHT);
    const balance = await request("GET", "/api/v1/users/me/supervotes", {
      token: voter.token,
    });
    assert.deepEqual(await balance.json(), {
      data: { available: 1, weight: SUPERVOTE_WEIGHT },
    });
  });

  test("without one left answers 409 and casts no vote", async () => {
    const questionUid = await ask("How does this scale?");

    assert.equal((await supervote(questionUid, voter)).status, 409);
    assert.equal(await votesOn(questionUid), 0);
  });

  test("a supervote can't be removed", async () => {
    const questionUid = await ask("How does this scale?");
    await giveSupervotes(voter, 1);
    assert.equal((await supervote(questionUid, voter)).status, 200);

    assert.equal((await upvote(questionUid, voter)).status, 409);
    assert.equal(await votesOn(questionUid), SUPERVOTE_WEIGHT);
  });

  test("a supervote on top of a vote answers 409 and spends nothing", async () => {
    const questionUid = await ask("How does this scale?");
    await giveSupervotes(voter, 1);
    assert.equal((await upvote(questionUid, voter)).status, 200);

    assert.equal((await supervote(questionUid, voter)).status, 409);
    assert.equal(await votesOn(questionUid), 1);
    assert.equal(await getSupervoteBalance(voter.id), 1);
  });

  test("two at once spend the last one only once", async () => {
    const first = await ask("How does this scale?");
    const second = await ask("What breaks first?");
    await giveSupervotes(voter, 1);

    const statuses = await Promise.all([
      supervote(first, voter),
      supervote(second, voter),
    ]).then((responses) => responses.map((response) => response.status));

    assert.deepEqual(statuses.toSorted(), [200, 409]);
    assert.equal(await getSupervoteBalance(voter.id), 0);
  });

  // Known bug: the upvote route checks for an existing vote, then inserts,
  // so taps that race all pass the check and the extra inserts hit the
  // votes primary key (500). Drop `todo` with the fix.
  test("quick repeated taps on one question never answer 500", {
    todo: "concurrent upvotes violate the votes primary key",
  }, async () => {
    // One burst doesn't always hit the race; five nearly always do.
    for (let round = 1; round <= 5; round++) {
      const questionUid = await ask(`Question ${round}?`);

      const statuses = await Promise.all([
        upvote(questionUid, voter),
        upvote(questionUid, voter),
        upvote(questionUid, voter),
      ]).then((responses) => responses.map((response) => response.status));

      assert.ok(
        statuses.every((status) => status < 500),
        `round ${round} answered ${statuses.join(", ")}`,
      );
      assert.ok([0, 1].includes(await votesOn(questionUid) ?? -1));
    }
  });

  test("a question's first selection earns its author one", async () => {
    const first = await ask("How does this scale?");
    const second = await ask("What breaks first?");

    assert.equal((await moderate(`/api/v1/questions/${first}/select`)).status, 200);
    assert.equal(await getSupervoteBalance(author.id), 1);

    assert.equal((await moderate(`/api/v1/questions/${second}/select`)).status, 200);
    assert.equal(await getSupervoteBalance(author.id), 2);

    assert.equal((await moderate(`/api/v1/questions/${first}/select`)).status, 200);
    assert.equal(await getSupervoteBalance(author.id), 2);
  });
});
