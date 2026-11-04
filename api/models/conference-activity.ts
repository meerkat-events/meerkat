import {
  and,
  type AnyColumn,
  count,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import db from "../db.ts";
import { summarizeModeration, tallyModeration } from "../moderation-summary.ts";
import {
  events,
  lower,
  questions,
  reactions,
  users,
  votes,
} from "../schema.ts";
import { REACTION_EMOJIS, type ReactionEmoji } from "../reactions.ts";
import { voteTotal, voteTotalOf } from "./votes.ts";

const notBlocked = () =>
  or(isNull(users.bannedUntil), lte(users.bannedUntil, new Date()));

// Questions automatic moderation hid are shadow-hidden: attendees never see
// them, so counts of what happened in a session leave them out. Organizers
// see them only where they review moderation (feed, person history).
const notModerationHidden = isNull(questions.hiddenAt);

/** A time span, from inclusive to `to` exclusive; either end may be open. */
export type TimeWindow = { from?: Date | undefined; to?: Date | undefined };

/** Whether `column` falls in the window; always true for an open window. */
function within(column: AnyColumn, { from, to }: TimeWindow) {
  return and(
    from ? gte(column, from) : undefined,
    to ? lt(column, to) : undefined,
  ) ?? sql`TRUE`;
}

// Questions automatic moderation hid or marked for review, restored ones
// included. A refused verdict has no decision and counts as hidden.
const moderatedByModeration = and(
  isNotNull(questions.moderation),
  sql`${questions.moderation}->>'decision' IS DISTINCT FROM 'show'`,
);

/**
 * Questions across a conference, newest first, for organizers moderating
 * several stages at once. Questions from blocked users are left out. Hidden
 * ones, by an organizer or by automatic moderation, only with `includeHidden`.
 * With a viewer, each question also carries the weight of the viewer's vote
 * on it (`viewerVoteWeight`, null when they haven't voted), so organizers can
 * vote from the feed.
 */
export function getConferenceQuestions(
  conferenceId: number,
  options: {
    live?: boolean;
    eventUid?: string;
    limit?: number;
    /** Also what organizers or automatic moderation hid, to review it. */
    includeHidden?: boolean;
    /** Only what automatic moderation hid or marked for review. */
    moderated?: boolean;
    /** Only questions asked in this window. */
    asked?: TimeWindow;
    viewerId?: string;
  } = {},
) {
  const conditions = [
    eq(events.conferenceId, conferenceId),
    notBlocked(),
  ];
  if (!options.includeHidden) {
    conditions.push(isNull(questions.deletedAt), notModerationHidden);
  }
  if (options.live) conditions.push(eq(events.live, true));
  if (options.moderated) conditions.push(moderatedByModeration);
  if (options.asked) conditions.push(within(questions.createdAt, options.asked));
  if (options.eventUid) {
    conditions.push(eq(lower(events.uid), options.eventUid.toLowerCase()));
  }

  const viewerVoteWeight = options.viewerId
    ? sql<number | null>`MAX(${votes.weight}) FILTER (WHERE ${votes.userId} = ${options.viewerId})`
    : sql<null>`NULL`;

  return db
    .select({
      id: questions.id,
      uid: questions.uid,
      eventId: questions.eventId,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      hiddenAt: questions.hiddenAt,
      moderation: questions.moderation,
      userId: questions.userId,
      user: users,
      votes: voteTotal,
      viewerVoteWeight: viewerVoteWeight.as("viewer_vote_weight"),
      event: {
        id: events.id,
        uid: events.uid,
        title: events.title,
        stage: events.stage,
      },
    })
    .from(questions)
    .innerJoin(events, eq(questions.eventId, events.id))
    .leftJoin(votes, eq(questions.id, votes.questionId))
    .leftJoin(users, eq(questions.userId, users.id))
    .where(and(...conditions))
    .groupBy(questions.id, users.id, events.id)
    .orderBy(desc(questions.createdAt))
    .limit(options.limit ?? 500)
    .execute();
}

export type ConferenceQuestions = Awaited<
  ReturnType<typeof getConferenceQuestions>
>;

type EventCounts = {
  questions: number;
  votes: number;
  reactions: number;
  participants: number;
  /** Questions automatic moderation hid and nobody restored. */
  autoHidden: number;
  /** Questions moderation shows but marked for an organizer to check. */
  review: number;
  /** Average relevance (0 to 4) of the questions attendees saw. */
  relevance: number | null;
};

/**
 * Activity totals for a conference and for each of its sessions. Participants
 * are people who asked or voted (as in `countParticipants`), counted once
 * across the whole conference for the totals. Counts cover what attendees
 * saw; `moderation` adds what automatic moderation did. With a `window`, only
 * what happened in it counts: questions asked, votes and reactions given,
 * questions picked.
 */
export async function getConferenceStats(
  conferenceId: number,
  { moderationEnabled, supervotesEnabled, window = {} }: {
    moderationEnabled: boolean;
    supervotesEnabled: boolean;
    window?: TimeWindow;
  },
) {
  const inConference = eq(events.conferenceId, conferenceId);
  const asked = within(questions.createdAt, window);

  const [
    questionRows,
    voteRows,
    reactionRows,
    participantRows,
    total,
    verdictRows,
    emojiRows,
    supervotesGiven,
    supervotesReceived,
  ] = await Promise.all([
      // Same questions the feed and Q&A show: not hidden, author not blocked.
      db.select({ eventId: questions.eventId, n: count() })
        .from(questions)
        .innerJoin(events, eq(questions.eventId, events.id))
        .leftJoin(users, eq(questions.userId, users.id))
        .where(and(
          inConference,
          asked,
          isNull(questions.deletedAt),
          notModerationHidden,
          notBlocked(),
        ))
        .groupBy(questions.eventId)
        .execute(),
      db.select({ eventId: questions.eventId, n: count() })
        .from(votes)
        .innerJoin(questions, eq(votes.questionId, questions.id))
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(and(inConference, within(votes.createdAt, window), notModerationHidden))
        .groupBy(questions.eventId)
        .execute(),
      db.select({ eventId: reactions.eventId, n: count() })
        .from(reactions)
        .innerJoin(events, eq(reactions.eventId, events.id))
        .where(and(inConference, within(reactions.createdAt, window)))
        .groupBy(reactions.eventId)
        .execute(),
      db.execute<{ event_id: number; n: number }>(sql`
        SELECT p.event_id, COUNT(DISTINCT p.user_id)::int AS n
        FROM (${participantsSql(conferenceId, window)}) AS p
        GROUP BY p.event_id`),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(DISTINCT p.user_id)::int AS n
        FROM (${participantsSql(conferenceId, window)}) AS p`),
      // Every verdict, to tally moderation and relevance.
      db.select({
        eventId: questions.eventId,
        hiddenAt: questions.hiddenAt,
        deletedAt: questions.deletedAt,
        moderation: questions.moderation,
      })
        .from(questions)
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(and(inConference, asked, isNotNull(questions.moderation)))
        .execute(),
      db.select({ emoji: reactions.emoji, n: count() })
        .from(reactions)
        .innerJoin(events, eq(reactions.eventId, events.id))
        .where(and(inConference, within(reactions.createdAt, window)))
        .groupBy(reactions.emoji)
        .execute(),
      // Supervotes spent, on questions attendees saw (like the vote counts).
      db.select({ n: count() })
        .from(votes)
        .innerJoin(questions, eq(votes.questionId, questions.id))
        .innerJoin(events, eq(questions.eventId, events.id))
        .where(and(
          inConference,
          within(votes.createdAt, window),
          gt(votes.weight, 1),
          notModerationHidden,
        ))
        .execute(),
      // Picking a question earns its author a supervote, the first time only,
      // and `selectedAt` keeps that first pick (models/questions.ts).
      supervotesEnabled
        ? db.select({ n: count() })
          .from(questions)
          .innerJoin(events, eq(questions.eventId, events.id))
          .where(and(
            inConference,
            isNotNull(questions.selectedAt),
            within(questions.selectedAt, window),
          ))
          .execute()
        : Promise.resolve([{ n: 0 }]),
    ]);

  const moderation = tallyModeration(verdictRows, moderationEnabled);

  const byEvent = new Map<number, EventCounts>();
  const get = (eventId: number) => {
    let counts = byEvent.get(eventId);
    if (!counts) {
      counts = {
        questions: 0,
        votes: 0,
        reactions: 0,
        participants: 0,
        autoHidden: 0,
        review: 0,
        relevance: null,
      };
      byEvent.set(eventId, counts);
    }
    return counts;
  };
  questionRows.forEach((r) => (get(r.eventId).questions = r.n));
  voteRows.forEach((r) => (get(r.eventId).votes = r.n));
  reactionRows.forEach((r) => (get(r.eventId).reactions = r.n));
  for (const r of participantRows) get(r.event_id).participants = r.n;
  for (const [eventId, m] of moderation.perEvent) {
    const counts = get(eventId);
    counts.autoHidden = m.autoHidden;
    counts.review = m.review;
    counts.relevance = m.scored > 0 ? m.relevanceSum / m.scored : null;
  }

  const sum = (key: "questions" | "votes" | "reactions") =>
    [...byEvent.values()].reduce((acc, counts) => acc + counts[key], 0);

  return {
    totals: {
      questions: sum("questions"),
      votes: sum("votes"),
      reactions: sum("reactions"),
      participants: total.at(0)?.n ?? 0,
    },
    // Every emoji, most used first; ones nobody sent count 0.
    reactions: REACTION_EMOJIS
      .map((emoji): { emoji: ReactionEmoji; count: number } => ({
        emoji,
        count: emojiRows.find((r) => r.emoji === emoji)?.n ?? 0,
      }))
      .sort((a, b) => b.count - a.count),
    supervotes: {
      enabled: supervotesEnabled,
      /** Earned by authors whose question was picked. */
      received: supervotesReceived.at(0)?.n ?? 0,
      /** Spent on questions. */
      given: supervotesGiven.at(0)?.n ?? 0,
    },
    moderation: moderation.totals,
    events: [...byEvent.entries()].map(([eventId, counts]) => ({
      eventId,
      ...counts,
    })),
  };
}

// Everyone who asked or voted in a conference session (in the window), one
// row per (session, person).
function participantsSql(conferenceId: number, window: TimeWindow) {
  return sql`
    SELECT ${questions.eventId} AS event_id, ${questions.userId} AS user_id
    FROM ${questions}
    INNER JOIN ${events} ON ${events.id} = ${questions.eventId}
    WHERE ${events.conferenceId} = ${conferenceId}
      AND ${questions.hiddenAt} IS NULL
      AND ${within(questions.createdAt, window)}
    UNION
    SELECT ${questions.eventId} AS event_id, ${votes.userId} AS user_id
    FROM ${votes}
    INNER JOIN ${questions} ON ${questions.id} = ${votes.questionId}
    INNER JOIN ${events} ON ${events.id} = ${questions.eventId}
    WHERE ${events.conferenceId} = ${conferenceId}
      AND ${questions.hiddenAt} IS NULL
      AND ${within(votes.createdAt, window)}`;
}

export type UserActivity = Awaited<ReturnType<typeof getConferenceUserActivity>>;

/**
 * One person's history in a conference: the questions they asked (hidden ones
 * included, so moderators can see the whole picture) and the sessions they
 * took part in by asking or voting.
 */
export async function getConferenceUserActivity(
  conferenceId: number,
  userId: string,
) {
  const [person] = await db
    .select({
      id: users.id,
      userMetadata: users.userMetadata,
      bannedUntil: users.bannedUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .execute();

  if (!person) return null;

  const [asked, upvoted, votesCast, sessionRows] = await Promise.all([
    db.select({
      id: questions.id,
      eventId: questions.eventId,
      uid: questions.uid,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      hiddenAt: questions.hiddenAt,
      moderation: questions.moderation,
      votes: voteTotal,
      event: {
        uid: events.uid,
        title: events.title,
        stage: events.stage,
        start: events.start,
      },
    })
      .from(questions)
      .innerJoin(events, eq(questions.eventId, events.id))
      .leftJoin(votes, eq(questions.id, votes.questionId))
      .where(and(
        eq(questions.userId, userId),
        eq(events.conferenceId, conferenceId),
      ))
      .groupBy(questions.id, events.id)
      .orderBy(desc(questions.createdAt))
      .execute(),
    // The questions they upvoted, with whoever asked them and that question's
    // total votes (not just this person's).
    db.select({
      id: questions.id,
      eventId: questions.eventId,
      uid: questions.uid,
      question: questions.question,
      createdAt: questions.createdAt,
      selectedAt: questions.selectedAt,
      answeredAt: questions.answeredAt,
      deletedAt: questions.deletedAt,
      votes: voteTotalOf(questions.id),
      askedById: questions.userId,
      askedByMetadata: users.userMetadata,
      event: {
        uid: events.uid,
        title: events.title,
        stage: events.stage,
        start: events.start,
      },
    })
      .from(questions)
      .innerJoin(events, eq(questions.eventId, events.id))
      .leftJoin(users, eq(questions.userId, users.id))
      .where(and(
        eq(events.conferenceId, conferenceId),
        notModerationHidden,
        sql`EXISTS (SELECT 1 FROM votes v WHERE v.question_id = ${questions.id} AND v.user_id = ${userId})`,
      ))
      .orderBy(desc(questions.createdAt))
      .execute(),
    db.select({ n: count() })
      .from(votes)
      .innerJoin(questions, eq(votes.questionId, questions.id))
      .innerJoin(events, eq(questions.eventId, events.id))
      .where(and(
        eq(votes.userId, userId),
        eq(events.conferenceId, conferenceId),
        notModerationHidden,
      ))
      .execute(),
    // Every session they touched, with what they did there.
    db.execute<{
      uid: string;
      title: string;
      stage: string;
      start: Date;
      questions: number;
      votes: number;
      reactions: number;
    }>(sql`
      SELECT e.uid, e.title, e.stage, e.start,
        (SELECT COUNT(*)::int FROM questions q
          WHERE q.event_id = e.id AND q.user_id = ${userId}) AS questions,
        (SELECT COUNT(*)::int FROM votes v
          INNER JOIN questions q ON q.id = v.question_id
          WHERE q.event_id = e.id AND v.user_id = ${userId}
            AND q.hidden_at IS NULL) AS votes,
        (SELECT COUNT(*)::int FROM reactions r
          WHERE r.event_id = e.id AND r.user_id = ${userId}) AS reactions
      FROM ${events} e
      WHERE e.conference_id = ${conferenceId}
        AND (
          EXISTS (SELECT 1 FROM questions q WHERE q.event_id = e.id AND q.user_id = ${userId})
          OR EXISTS (SELECT 1 FROM votes v INNER JOIN questions q ON q.id = v.question_id
                      WHERE q.event_id = e.id AND v.user_id = ${userId}
                        AND q.hidden_at IS NULL)
          OR EXISTS (SELECT 1 FROM reactions r WHERE r.event_id = e.id AND r.user_id = ${userId})
        )
      ORDER BY e.start DESC`),
  ]);

  const blocked = !!person.bannedUntil && person.bannedUntil > new Date();
  // Hidden by an organizer or by automatic moderation.
  const isHidden = (q: { deletedAt: Date | null; hiddenAt: Date | null }) =>
    q.deletedAt !== null || q.hiddenAt !== null;

  return {
    user: {
      id: person.id,
      name: (person.userMetadata?.["name"] as string | undefined) ?? person.id,
      blocked,
    },
    summary: {
      questions: asked.filter((q) => !isHidden(q)).length,
      hidden: asked.filter(isHidden).length,
      votes: votesCast.at(0)?.n ?? 0,
      reactions: sessionRows.reduce((total, s) => total + s.reactions, 0),
      sessions: sessionRows.length,
    },
    sessions: sessionRows,
    questions: asked.map(({ moderation, ...rest }) => ({
      ...rest,
      moderation: summarizeModeration(moderation),
    })),
    upvoted: upvoted.map(({ askedById, askedByMetadata, ...rest }) => ({
      ...rest,
      user: {
        id: askedById,
        name: (askedByMetadata?.["name"] as string | undefined) ?? askedById,
      },
    })),
  };
}
