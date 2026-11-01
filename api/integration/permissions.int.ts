import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  emailUser,
  grantTestRole,
  request,
  resetDb,
  rolesOf,
  seedConference,
  type TestUser,
} from "./helpers.ts";

type Permissions = {
  members: { userId: string; email: string | null; role: string }[];
  invitations: { id: number; email: string; role: string }[];
  attendeeCount: number;
};

type AttendeePage = {
  attendees: { userId: string; email: string | null; role: string }[];
  next: string | null;
};

describe("conference permissions", () => {
  let conferenceId: number;
  let path: string;
  let organizer: TestUser;

  const list = async () => {
    const response = await request("GET", path, { token: organizer.token });
    assert.equal(response.status, 200);
    return (await response.json() as { data: Permissions }).data;
  };

  const listAttendees = async (query = "") => {
    const response = await request("GET", `${path}/attendees${query}`, {
      token: organizer.token,
    });
    assert.equal(response.status, 200);
    return (await response.json() as { data: AttendeePage }).data;
  };

  const setRole = (email: string, role: string, user = organizer) =>
    request("POST", path, { token: user.token, body: { email, role } });

  beforeEach(async () => {
    await resetDb();
    const { conference } = await seedConference({ name: "Permissions" });
    conferenceId = conference.id;
    path = `/api/v1/conferences/${conferenceId}/permissions`;
    organizer = await emailUser("organizer@example.com");
    await grantTestRole(organizer.id, conferenceId, "organizer");
  });

  test("only this conference's organizers may read or change it", async () => {
    const moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conferenceId, "moderator");

    const { conference: other } = await seedConference({ name: "Other" });
    const otherOrganizer = await emailUser("other@example.com");
    await grantTestRole(otherOrganizer.id, other.id, "organizer");

    for (const user of [moderator, otherOrganizer]) {
      const read = await request("GET", path, { token: user.token });
      assert.equal(read.status, 403);
      const attendees = await request("GET", `${path}/attendees`, {
        token: user.token,
      });
      assert.equal(attendees.status, 403);
      assert.equal(
        (await setRole("new@example.com", "organizer", user)).status,
        403,
      );
      const remove = await request(
        "DELETE",
        `${path}/members/${organizer.id}`,
        { token: user.token },
      );
      assert.equal(remove.status, 403);
    }

    assert.deepEqual(await rolesOf(moderator.id), [
      { conferenceId, role: "moderator" },
    ]);
    assert.deepEqual((await list()).invitations, []);
  });

  test("lists organizers and moderators, and counts attendees", async () => {
    const moderator = await emailUser("moderator@example.com");
    await grantTestRole(moderator.id, conferenceId, "moderator");
    const attendee = await emailUser("attendee@example.com");
    await grantTestRole(attendee.id, conferenceId, "attendee");

    const { members, attendeeCount } = await list();

    assert.deepEqual(
      members.map(({ email, role }) => [email, role]),
      [
        ["organizer@example.com", "organizer"],
        ["moderator@example.com", "moderator"],
      ],
    );
    assert.equal(attendeeCount, 1);
  });

  test("lists attendees page by page, newest first", async () => {
    // Three granted in the same millisecond, which a page boundary splits.
    const oldest = new Date("2026-11-01T10:00:00.000Z");
    const tied = new Date("2026-11-01T11:00:00.000Z");
    const newest = new Date("2026-11-01T12:00:00.000Z");
    const grants: [string, Date][] = [
      ["oldest@example.com", oldest],
      ["tied-1@example.com", tied],
      ["tied-2@example.com", tied],
      ["tied-3@example.com", tied],
      ["newest@example.com", newest],
    ];
    for (const [email, grantedAt] of grants) {
      const attendee = await emailUser(email);
      await grantTestRole(attendee.id, conferenceId, "attendee", grantedAt);
    }

    const seen: string[] = [];
    let query = "?limit=2";
    for (let page = 0; page < 3; page++) {
      const { attendees, next } = await listAttendees(query);
      assert.ok(attendees.every(({ role }) => role === "attendee"));
      seen.push(...attendees.map(({ email }) => email ?? ""));
      if (!next) break;
      query = `?limit=2&after=${encodeURIComponent(next)}`;
    }

    assert.equal(seen.length, grants.length);
    assert.equal(seen[0], "newest@example.com");
    assert.equal(seen.at(-1), "oldest@example.com");
    assert.deepEqual(
      seen.toSorted(),
      grants.map(([email]) => email).toSorted(),
    );
  });

  test("searches attendees by email", async () => {
    for (const email of ["alice@example.com", "bob@example.com"]) {
      const attendee = await emailUser(email);
      await grantTestRole(attendee.id, conferenceId, "attendee");
    }

    const { attendees, next } = await listAttendees("?search=ALI");
    assert.deepEqual(attendees.map(({ email }) => email), [
      "alice@example.com",
    ]);
    assert.equal(next, null);

    // `%` matches itself, not everything.
    assert.deepEqual((await listAttendees("?search=%25")).attendees, []);
  });

  test("rejects a bad attendee page request", async () => {
    for (const query of ["?after=nonsense", "?limit=0", "?limit=201"]) {
      const response = await request("GET", `${path}/attendees${query}`, {
        token: organizer.token,
      });
      assert.equal(response.status, 400, query);
    }
  });

  test("changes the role of someone with an account", async () => {
    const someone = await emailUser("someone@example.com");

    for (const role of ["moderator", "attendee", "organizer"]) {
      const response = await setRole("Someone@Example.com", role);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { data: { status: "member" } });
      assert.deepEqual(await rolesOf(someone.id), [{ conferenceId, role }]);
    }
    assert.deepEqual((await list()).invitations, []);
  });

  test("invites an email without an account, once", async () => {
    const response = await setRole("New@Example.com", "moderator");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { status: "invited" } });

    await Promise.all([
      setRole("new@example.com", "organizer"),
      setRole("new@example.com", "organizer"),
      setRole("new@example.com", "organizer"),
    ]);

    const { invitations } = await list();
    assert.deepEqual(
      invitations.map(({ email, role }) => [email, role]),
      [["new@example.com", "organizer"]],
    );

    // Two pending invitations would fail the sign-up in handle_new_user.
    const invited = await emailUser("new@example.com");
    assert.deepEqual(await rolesOf(invited.id), [
      { conferenceId, role: "organizer" },
    ]);
    assert.deepEqual((await list()).invitations, []);
  });

  test("nobody can change or remove their own role", async () => {
    const change = await setRole("organizer@example.com", "attendee");
    assert.equal(change.status, 400);

    const remove = await request(
      "DELETE",
      `${path}/members/${organizer.id}`,
      { token: organizer.token },
    );
    assert.equal(remove.status, 400);

    assert.deepEqual(await rolesOf(organizer.id), [
      { conferenceId, role: "organizer" },
    ]);
  });

  test("removes members and invitations of this conference only", async () => {
    const member = await emailUser("member@example.com");
    await grantTestRole(member.id, conferenceId, "moderator");
    await setRole("invited@example.com", "moderator");
    const [invitation] = (await list()).invitations;
    assert.ok(invitation);

    const { conference: other } = await seedConference({ name: "Other" });
    const otherOrganizer = await emailUser("other@example.com");
    await grantTestRole(otherOrganizer.id, other.id, "organizer");
    const otherPath = `/api/v1/conferences/${other.id}/permissions`;

    const wrongMember = await request(
      "DELETE",
      `${otherPath}/members/${member.id}`,
      { token: otherOrganizer.token },
    );
    assert.equal(wrongMember.status, 404);
    const wrongInvitation = await request(
      "DELETE",
      `${otherPath}/invitations/${invitation.id}`,
      { token: otherOrganizer.token },
    );
    assert.equal(wrongInvitation.status, 404);

    const removeMember = await request(
      "DELETE",
      `${path}/members/${member.id}`,
      { token: organizer.token },
    );
    assert.equal(removeMember.status, 204);
    assert.deepEqual(await rolesOf(member.id), []);

    const removeInvitation = await request(
      "DELETE",
      `${path}/invitations/${invitation.id}`,
      { token: organizer.token },
    );
    assert.equal(removeInvitation.status, 204);
    assert.deepEqual((await list()).invitations, []);
  });

  test("rejects a bad email or role", async () => {
    assert.equal((await setRole("not-an-email", "moderator")).status, 400);
    assert.equal((await setRole("a@example.com", "admin")).status, 400);
  });
});
