import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { ATTENDEES_ONLY_FEATURE } from "../features.ts";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  postedQuestionUid,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type ConferenceQuestion = {
  uid: string;
  votes: number;
  vote: { weight: number } | null;
};

describe("organizers voting from the management pages", () => {
  let conferenceId: number;
  let organizer: TestUser;
  let questionUid: string;

  /** The conference's questions as the organizer's management pages get them. */
  const conferenceQuestions = async () => {
    const response = await request(
      "GET",
      `/api/v1/conferences/${conferenceId}/questions?live=false&hidden=true`,
      { token: organizer.token },
    );
    assert.equal(response.status, 200);
    return (await response.json() as { data: ConferenceQuestion[] }).data;
  };

  const vote = (user: TestUser) =>
    request("POST", `/api/v1/questions/${questionUid}/upvote`, {
      token: user.token,
    });

  beforeEach(async () => {
    await resetDb();
    // Attendees-only: an organizer's role lets them take part too.
    const { conference, event } = await seedConference({
      name: "Organizer votes",
      featureNames: [ATTENDEES_ONLY_FEATURE],
    });
    conferenceId = conference.id;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conference.id, "organizer");

    const author = await emailUser("author@example.com");
    await grantTestRole(author.id, conference.id, "attendee");
    questionUid = await postedQuestionUid(event.uid, author);
  });

  test("the list carries the organizer's own vote, and voting again removes it", async () => {
    assert.deepEqual(
      (await conferenceQuestions()).map(({ uid, votes, vote }) => ({ uid, votes, vote })),
      [{ uid: questionUid, votes: 0, vote: null }],
    );

    assert.equal((await vote(organizer)).status, 200);
    const [voted] = await conferenceQuestions();
    assert.equal(voted?.votes, 1);
    assert.deepEqual(voted?.vote, { weight: 1 });

    assert.equal((await vote(organizer)).status, 200);
    const [unvoted] = await conferenceQuestions();
    assert.equal(unvoted?.votes, 0);
    assert.equal(unvoted?.vote, null);
  });

  test("someone else's vote counts, but isn't the organizer's", async () => {
    const attendee = await anonymousUser();
    await grantTestRole(attendee.id, conferenceId, "attendee");
    assert.equal((await vote(attendee)).status, 200);

    const [question] = await conferenceQuestions();
    assert.equal(question?.votes, 1);
    assert.equal(question?.vote, null);
  });
});
