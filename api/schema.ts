import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { ReactionEmoji } from "./reactions.ts";
import type {
  ConferenceModeration,
  QuestionModeration,
} from "./moderation.ts";

const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  aud: varchar("aud", { length: 255 }),
  role: varchar("role", { length: 255 }),
  email: varchar("email", { length: 255 }),
  userMetadata: jsonb("raw_user_meta_data").$type<
    Record<string, unknown>
  >(),
  bannedUntil: timestamp("banned_until"),
});

// Every table enables Row Level Security (`.enableRLS()`), so the migration
// that creates it also locks it. The anon key is public and Supabase's Data
// API exposes the `public` schema: RLS without a policy denies anon and
// authenticated everything, while the API connects as the table owner and is
// unaffected. No table has a policy: the browser reads nothing from the
// database directly (live updates are SSE from the API, api/realtime/).
// schema.test.ts fails for a table without RLS.
export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url"),
  externalId: text("external_id"),
  // Slug of the Pretalx event (on PRETALX_URL) whose schedule is synced into
  // this conference's events, e.g. "devcon8"; null = not synced (pretalx.ts).
  pretalxEvent: text("pretalx_event").unique(),
  // Start of the last sync; throttles POST /api/v1/pretalx/:event/sync.
  pretalxSyncedAt: timestamp("pretalx_synced_at"),
  theme: jsonb("theme").$type<{
    brandColor: string;
    textColor: string;
    contrastColor: string;
    background: string;
    systemTheme: "light" | "dark";
    headingFontFamily?: string;
    bodyFontFamily?: string;
    // Optional refinements; documented on the frontend's Theme type.
    brandHoverColor?: string;
    mutedTextColor?: string;
    accentColor?: string;
    highlightColor?: string;
    shadowColor?: string;
    floatingShadow?: string;
    inputOutlineColor?: string;
    successToastColor?: string;
    errorToastColor?: string;
    notLiveBannerColor?: string;
    buttonRadius?: string;
    buttonFontWeight?: string;
    questionInputRadius?: string;
    dialogPlacement?: "top" | "center";
    dialogGutter?: string;
    dialogTitleFontWeight?: string;
    dialogTitleSpacing?: string;
    dialogCloseIconSize?: string;
    dialogEmphasisFontWeight?: string;
    voteTextColor?: string;
    voteOutlineColor?: string;
    questionControlSize?: string;
    minTapTarget?: string;
    questionGap?: string;
    headerBarSpacing?: string;
    sessionTimeWidth?: string;
  }>(),
  // Automatic question moderation: written context and optional overrides
  // (conferenceModerationSchema in moderation.ts); null = not moderated.
  moderation: jsonb("moderation").$type<ConferenceModeration>(),
}).enableRLS();

/**
 * A person's role in one conference. Organizers moderate and see the
 * management pages; moderators moderate the Q&A (select, answer, hide, go
 * live, block) without them; attendees take part.
 */
export const roleEnum = pgEnum("role", ["attendee", "organizer", "moderator"]);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id")
    .notNull()
    .references(() => conferences.id, { onDelete: "cascade" }),
  uid: text("uid").notNull(),
  title: text("title").notNull(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  stage: text("stage").notNull(),
  description: text("description"),
  cover: text("cover"),
  speaker: text("speaker"),
  live: boolean("live").notNull().default(false),
}, (table) => [
  // The upserts' ON CONFLICT target.
  uniqueIndex("events_uid_uniq").on(table.uid),
  // getEventByUID matches lower(uid). Not unique: a second unique index
  // would make an upsert of a uid differing only in case fail instead of
  // insert.
  index("events_uid_lower_idx").on(lower(table.uid)),
  index("events_conference_id_idx").on(table.conferenceId),
  // The signage polls (getStageLiveEvent) first look for the stage's live
  // event: stage = ? and live, ordered by start. Partial, so it holds only
  // the few live rows.
  index("events_stage_live_idx").on(table.stage, table.start)
    .where(sql`${table.live}`),
  // When nothing is live, the stage's next event: stage = ? and
  // start >= now(), ordered by start. Also serves the stage filter of
  // getEvents and setEventLive's update.
  index("events_stage_start_idx").on(table.stage, table.start),
]).enableRLS();

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    uid: text("uid").notNull().unique(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    selectedAt: timestamp("selected_at"),
    answeredAt: timestamp("answered_at"),
    deletedAt: timestamp("deleted_at"),
    // Set when automatic moderation hid the question: only its author still
    // sees it. Null means visible.
    hiddenAt: timestamp("hidden_at"),
    // Verdict of automatic moderation; null when the question was not
    // classified (moderation off, or the classifier failed).
    moderation: jsonb("moderation").$type<QuestionModeration>(),
  },
  (
    table,
  ) => [
    index("questions_event_id_idx").on(table.eventId),
    index("questions_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const votes = pgTable(
  "votes",
  {
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // How much this vote counts: 1, or SUPERVOTE_WEIGHT when the voter
    // spent a supervote on it (models/supervotes.ts).
    weight: integer("weight").notNull().default(1),
  },
  (
    table,
  ) => [
    primaryKey({ columns: [table.questionId, table.userId] }),
    index("votes_user_id_idx").on(table.userId),
    index("votes_question_id_idx").on(table.questionId),
  ],
).enableRLS();

export const conferenceRole = pgTable(
  "conference_role",
  {
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").default("attendee").notNull(),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
  },
  (
    table,
  ) => [
    primaryKey({ columns: [table.conferenceId, table.userId] }),
    index("conference_role_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const invitations = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
  },
  (table) => [
    index("invitations_email_idx").on(table.email),
    index("invitations_conference_id_idx").on(table.conferenceId),
  ],
).enableRLS();

// Supervotes a user can spend, across all conferences. Selecting one of their
// questions adds one; spending one on a vote takes it (models/supervotes.ts).
export const supervoteBalances = pgTable(
  "supervote_balances",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
  },
  (table) => [
    check("supervote_balances_balance_not_negative", sql`${table.balance} >= 0`),
  ],
).enableRLS();

export const features = pgTable("features", {
  conferenceId: integer("conference_id").notNull().references(
    () => conferences.id,
    { onDelete: "cascade" },
  ),
  name: text("name").notNull(),
  active: boolean("active").notNull(),
}, (table) => [primaryKey({ columns: [table.conferenceId, table.name] })]).enableRLS();

export const reactions = pgTable(
  "reactions",
  {
    uid: text("uid").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    emoji: text("emoji").$type<ReactionEmoji>().notNull().default("heart"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (
    table,
  ) => [
    index("reactions_event_id_idx").on(table.eventId),
    index("reactions_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hashedKey: text("hashed_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until"),
}).enableRLS();

export function lower(column: AnyPgColumn) {
  return sql`lower(${column})`;
}
