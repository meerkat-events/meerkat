import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import db from "../db.ts";
import { getSupervoteBalance, SUPERVOTES_FEATURE } from "../models/supervotes.ts";
import { supervoteBalances } from "../schema.ts";
import {
  emailUser,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type ListedQuestion = { uid: string; votes: number };

const upvote = (questionUid: string, user: TestUser, weight?: number) =>
  request("POST", `/api/v1/questions/${questionUid}/upvote`, {
    token: user.token,
    ...(weight !== undefined ? { body: { weight } } : {}),
  });

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
    const { event } = await seedConference({
      name: "Own votes",
      featureNames: [SUPERVOTES_FEATURE],
    });
    eventUid = event.uid;
    author = await emailUser("author@example.com");
    await db.insert(supervoteBalances).values({ userId: author.id, balance: 1 });

    const asked = await request("POST", `/api/v1/events/${eventUid}/questions`, {
      token: author.token,
      body: { question: "How does this scale?" },
    });
    assert.equal(asked.status, 200);
    questionUid = (await asked.json() as { data: ListedQuestion }).data.uid;
  });

  test("is refused", async () => {
    assert.equal((await upvote(questionUid, author)).status, 403);
    assert.equal(await votesOnQuestion(), 0);
  });

  test("is refused for a supervote, which stays unspent", async () => {
    assert.equal((await upvote(questionUid, author, 3)).status, 403);
    assert.equal(await votesOnQuestion(), 0);
    assert.equal(await getSupervoteBalance(author.id), 1);
  });

  test("leaves voting for it open to everyone else", async () => {
    const voter = await emailUser("voter@example.com");
    assert.equal((await upvote(questionUid, voter)).status, 200);
    assert.equal(await votesOnQuestion(), 1);
  });
});
