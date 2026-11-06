import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import db from "../db.ts";
import { getQuestionByUID } from "../models/questions.ts";
import { getSupervoteBalance } from "../models/supervotes.ts";
import { createVote } from "../models/votes.ts";
import { OWN_QUESTION_MESSAGE } from "../routes/questions.ts";
import { supervoteBalances } from "../schema.ts";
import {
  emailUser,
  postedQuestionUid,
  request,
  resetDb,
  seedConference,
  type TestUser,
  upvote,
} from "./helpers.ts";

type ListedQuestion = { uid: string; votes: number };

/** Asserts the own-question refusal, not some other 403. */
async function assertRefused(response: Response) {
  assert.equal(response.status, 403);
  assert.equal(await response.text(), OWN_QUESTION_MESSAGE);
}

describe("voting for your own question", () => {
  let eventUid: string;
  let questionUid: string;
  let author: TestUser;

  const votesOnQuestion = async () => {
    const response = await request("GET", `/api/v1/events/${eventUid}/questions`);
    const { data } = await response.json() as { data: ListedQuestion[] };
    return data.find((question) => question.uid === questionUid)?.votes;
  };

  beforeEach(async () => {
    await resetDb();
    const { event } = await seedConference({ name: "Own votes" });
    eventUid = event.uid;
    author = await emailUser("author@example.com");
    await db.insert(supervoteBalances).values({ userId: author.id, balance: 1 });

    questionUid = await postedQuestionUid(eventUid, author);
  });

  test("is refused", async () => {
    await assertRefused(await upvote(questionUid, author));
    assert.equal(await votesOnQuestion(), 0);
  });

  test("is refused for a supervote, which stays unspent", async () => {
    await assertRefused(await upvote(questionUid, author, 3));
    assert.equal(await votesOnQuestion(), 0);
    assert.equal(await getSupervoteBalance(author.id), 1);
  });

  test("lets a vote cast before the rule be removed, not added back", async () => {
    const question = await getQuestionByUID(questionUid);
    assert.ok(question);
    await createVote(question.id, author.id);
    assert.equal(await votesOnQuestion(), 1);

    assert.equal((await upvote(questionUid, author)).status, 200);
    assert.equal(await votesOnQuestion(), 0);
    await assertRefused(await upvote(questionUid, author));
  });

  test("leaves voting for it open to everyone else", async () => {
    const voter = await emailUser("voter@example.com");
    assert.equal((await upvote(questionUid, voter)).status, 200);
    assert.equal(await votesOnQuestion(), 1);
  });
});
