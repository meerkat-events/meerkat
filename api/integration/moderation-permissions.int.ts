import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  anonymousUser,
  emailUser,
  grantTestRole,
  insertQuestion,
  request,
  resetDb,
  seedConference,
  type TestUser,
} from "./helpers.ts";

// Who may moderate a conference's Q&A. Hiding, restoring and blocking have
// their own tests (hide-question.int.ts, block-user.int.ts).

type Actor =
  | "anonymous"
  | "attendee"
  | "moderator elsewhere"
  | "moderator"
  | "organizer";

const ACTORS: Actor[] = [
  "anonymous",
  "attendee",
  "moderator elsewhere",
  "moderator",
  "organizer",
];

type ModerationAction = {
  name: string;
  allowed: Actor[];
  // `request` answers like Hono's app.request: a Response or its promise.
  call: (token: string) => Response | Promise<Response>;
};

describe("moderation permissions", () => {
  const actors = new Map<Actor, TestUser>();
  let actions: ModerationAction[];

  before(async () => {
    await resetDb();
    const { conference, event } = await seedConference({ name: "Moderated" });
    const { conference: elsewhere } = await seedConference({ name: "Elsewhere" });

    actors.set("anonymous", await anonymousUser());
    for (const actor of ["attendee", "moderator", "organizer"] as const) {
      const user = await emailUser(`${actor}@example.com`);
      await grantTestRole(user.id, conference.id, actor);
      actors.set(actor, user);
    }
    const elsewhereModerator = await emailUser("elsewhere@example.com");
    await grantTestRole(elsewhereModerator.id, elsewhere.id, "moderator");
    actors.set("moderator elsewhere", elsewhereModerator);

    const asker = await emailUser("asker@example.com");
    const { uid: questionUid } = await insertQuestion(event.id, asker.id, "moderated");

    const moderators: Actor[] = ["moderator", "organizer"];
    actions = [
      {
        name: "selecting a question for the stage",
        allowed: moderators,
        call: (token) =>
          request("POST", `/api/v1/questions/${questionUid}/select`, { token }),
      },
      {
        name: "marking a question answered",
        allowed: moderators,
        call: (token) =>
          request("POST", `/api/v1/questions/${questionUid}/mark-as-answered`, {
            token,
          }),
      },
      {
        name: "putting the session live",
        allowed: moderators,
        call: (token) =>
          request("POST", `/api/v1/events/${event.uid}/live`, { token }),
      },
      {
        name: "listing the conference's sessions to moderate",
        allowed: moderators,
        call: (token) =>
          request("GET", `/api/v1/conferences/${conference.id}/events`, { token }),
      },
      {
        name: "switching high engagement mode",
        allowed: ["organizer"],
        call: (token) =>
          request("POST", `/api/v1/events/${event.uid}/high-engagement`, {
            token,
            body: { enabled: true },
          }),
      },
    ];
  });

  test("each action is open to its roles in the conference only", async () => {
    for (const action of actions) {
      for (const actor of ACTORS) {
        const response = await action.call(actors.get(actor)!.token);
        const expected = action.allowed.includes(actor) ? 200 : 403;
        assert.equal(
          response.status,
          expected,
          `${action.name} as ${actor} answered ${response.status}`,
        );
      }
    }
  });
});
