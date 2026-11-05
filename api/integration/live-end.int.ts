import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import db from "../db.ts";
import { events, questions } from "../schema.ts";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

const HOUR = 60 * 60 * 1000;

// When another session on the stage goes live, the session that ends has
// its question on stage marked answered.
describe("ending a live session", () => {
  let organizer: TestUser;
  let conferenceId: number;
  let firstUid: string;
  let stage: string;

  const goLive = async (uid: string) => {
    const response = await request("POST", `/api/v1/events/${uid}/live`, {
      token: organizer.token,
    });
    assert.equal(response.status, 200);
  };

  const ask = async (eventUid: string, question: string) => {
    const author = await anonymousUser();
    const response = await request(
      "POST",
      `/api/v1/events/${eventUid}/questions`,
      { token: author.token, body: { question } },
    );
    assert.equal(response.status, 200);
    const { data } = await response.json() as { data: { uid: string } };
    return data.uid;
  };

  const select = async (uid: string) => {
    const response = await request("POST", `/api/v1/questions/${uid}/select`, {
      token: organizer.token,
    });
    assert.equal(response.status, 200);
  };

  const answeredAt = async (uid: string) => {
    const [question] = await db.select({ answeredAt: questions.answeredAt })
      .from(questions).where(eq(questions.uid, uid));
    return question?.answeredAt ?? null;
  };

  const addSession = async (uid: string, sessionStage: string) => {
    await db.insert(events).values({
      conferenceId,
      uid,
      title: uid,
      start: new Date(Date.now() + HOUR),
      end: new Date(Date.now() + 2 * HOUR),
      stage: sessionStage,
    });
  };

  beforeEach(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Live end" });
    conferenceId = conference.id;
    firstUid = event.uid;
    stage = event.stage;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");
  });

  test("marks the question on stage answered", async () => {
    await addSession("next-talk", stage);
    await goLive(firstUid);
    const onStage = await ask(firstUid, "What comes after this?");
    const waiting = await ask(firstUid, "Will the slides be shared?");
    await select(onStage);

    await goLive("next-talk");

    assert.ok(await answeredAt(onStage), "the question on stage wasn't answered");
    assert.equal(await answeredAt(waiting), null);
  });

  test("keeps an earlier answer's time", async () => {
    await addSession("next-talk", stage);
    await goLive(firstUid);
    const earlier = await ask(firstUid, "How long did this take?");
    const onStage = await ask(firstUid, "What comes after this?");
    await select(earlier);
    await select(onStage);
    const earlierAnswer = await answeredAt(earlier);

    await goLive("next-talk");

    assert.deepEqual(await answeredAt(earlier), earlierAnswer);
    assert.ok(await answeredAt(onStage));
  });

  test("leaves sessions that weren't live alone", async () => {
    await addSession("next-talk", stage);
    await addSession("later-talk", stage);
    const onStage = await ask("later-talk", "Is this recorded?");
    await select(onStage);

    await goLive("next-talk");

    assert.equal(await answeredAt(onStage), null);
  });

  test("leaves other stages alone", async () => {
    await addSession("side-talk", "side");
    await goLive(firstUid);
    const onStage = await ask(firstUid, "What comes after this?");
    await select(onStage);

    await goLive("side-talk");

    assert.equal(await answeredAt(onStage), null);
  });
});
