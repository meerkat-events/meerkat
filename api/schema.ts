import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  theme: jsonb("theme").$type<{
    brandColor: string;
    contrastColor: string;
    backgroundColor: string;
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
  submissionType: text("submission_type").notNull(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  abstract: text("abstract"),
  description: text("description"),
  track: text("track"),
  cover: text("cover"),
  speaker: text("speaker"),
  secret: text("secret"),
  live: boolean("live").notNull().default(false),
}, (table) => [
  uniqueIndex("events_uid_uniq").on(lower(table.uid)),
  index("events_conference_id_idx").on(table.conferenceId),
]);

export const event_pods = pgTable("event_pods", {
  uid: text("uid").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  pod: jsonb("pod").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("event_pods_event_id_idx").on(table.eventId)]);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    uid: text("uid").notNull().unique(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    userId: integer("user_id")
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
    userId: integer("user_id")
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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  name: text("name").unique(),
  blocked: boolean("blocked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conferenceRole = pgTable(
  "conference_role",
  {
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    userId: integer("user_id")
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

export const accounts = pgTable(
  "accounts",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    id: text("id").notNull().unique(),
    hash: text("hash"),
  },
  (
    table,
  ) => [
    unique("provider_id_uniq").on(table.provider, table.id),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const nonces = pgTable("nonces", {
  nonce: text("nonce").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    userId: integer("user_id")
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
