import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
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

export const profiles = pgTable("profile", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").unique(),
  zupassId: text("zupass_id"),
});

export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  theme: jsonb("theme").$type<{
    brandColor: string;
    contrastColor: string;
    background: string;
    headingFontFamily?: string;
    bodyFontFamily?: string;
  }>(),
});

export const roleEnum = pgEnum("role", ["attendee", "speaker", "organizer"]);

export const conferenceTickets = pgTable(
  "conference_tickets",
  {
    id: serial("id").primaryKey(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    collectionName: text("collection_name").notNull(),
    eventId: text("event_id").notNull(),
    signerPublicKey: text("signer_public_key").notNull(),
    productId: text("product_id"),
    role: roleEnum("role").default("attendee").notNull(),
  },
  (
    table,
  ) => [index("conference_tickets_conference_id_idx").on(table.conferenceId)],
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id")
    .notNull()
    .references(() => conferences.id, { onDelete: "cascade" }),
  uid: text("uid").notNull(),
  title: text("title").notNull(),
  submissionType: text("submission_type").default("talk"),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  description: text("description"),
  track: text("track"),
  cover: text("cover"),
  speaker: text("speaker"),
  live: boolean("live").notNull().default(false),
}, (table) => [
  uniqueIndex("events_uid_uniq").on(lower(table.uid)),
  index("events_conference_id_idx").on(table.conferenceId),
]);

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
  },
  (
    table,
  ) => [
    index("questions_event_id_idx").on(table.eventId),
    index("questions_user_id_idx").on(table.userId),
  ],
);

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
  },
  (
    table,
  ) => [
    primaryKey({ columns: [table.questionId, table.userId] }),
    index("votes_user_id_idx").on(table.userId),
    index("votes_question_id_idx").on(table.questionId),
  ],
);

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
);

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
);

export const features = pgTable("features", {
  conferenceId: integer("conference_id").notNull().references(
    () => conferences.id,
    { onDelete: "cascade" },
  ),
  name: text("name").notNull(),
  active: boolean("active").notNull(),
}, (table) => [primaryKey({ columns: [table.conferenceId, table.name] })]);

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (
    table,
  ) => [
    index("reactions_event_id_idx").on(table.eventId),
    index("reactions_user_id_idx").on(table.userId),
  ],
);

export function lower(column: AnyPgColumn) {
  return sql`lower(${column})`;
}
