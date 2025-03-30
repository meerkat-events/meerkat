import {
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
} from "drizzle-orm/pg-core";

export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
});

export const roleEnum = pgEnum("role", ["attendee", "speaker", "organizer"]);

export const conferenceTickets = pgTable("conference_tickets", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id")
    .notNull()
    .references(() => conferences.id, { onDelete: "cascade" }),
  collectionName: text("collection_name").notNull(),
  eventId: text("event_id").notNull(),
  signerPublicKey: text("signer_public_key").notNull(),
  productId: text("product_id"),
  role: roleEnum("role").default("attendee").notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id")
    .notNull()
    .references(() => conferences.id, { onDelete: "cascade" }),
  uid: text("uid").notNull().unique(),
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
});

// export const event_speakers = pgTable("event_speakers", {
//   eventId: integer("event_id")
//     .notNull()
//     .references(() => events.id, { onDelete: "cascade" }),
//   speakerId: integer("speaker_id")
//     .notNull()
//     .references(() => speakers.id, { onDelete: "cascade" }),
// }, (table) => ({
//   pk: primaryKey({ columns: [table.eventId, table.speakerId] }),
// }));

// export const speakers = pgTable("speakers", {
//   id: serial("id").primaryKey(),
//   sourceId: text("source_id").notNull(),
//   name: text("name").notNull(),
//   hash: text("hash").notNull(),
//   userId: integer("user_id")
//     .references(() => users.id, { onDelete: "cascade" }),
// });

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
}, (table) => ({
  eventPodsIdx: index("event_pods_event_id_idx").on(table.eventId),
}));

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
  (table) => ({
    eventIdx: index("questions_event_id_idx").on(table.eventId),
    userIdx: index("questions_user_id_idx").on(table.userId),
  }),
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
  (table) => ({
    pk: primaryKey({ columns: [table.questionId, table.userId] }),
    userIdx: index("votes_user_id_idx").on(table.userId),
    questionIdx: index("votes_question_id_idx").on(table.questionId),
  }),
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
  (table) => ({
    pk: primaryKey({ columns: [table.conferenceId, table.userId] }),
    userIdx: index("conference_role_user_id_idx").on(table.userId),
  }),
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
  (table) => ({
    providerId: unique("provider_id_uniq").on(table.provider, table.id),
    userIdx: index("accounts_user_id_idx").on(table.userId),
  }),
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
}, (table) => ({
  pk: primaryKey({ columns: [table.conferenceId, table.name] }),
}));

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
  (table) => ({
    eventIdx: index("reactions_event_id_idx").on(table.eventId),
    userIdx: index("reactions_user_id_idx").on(table.userId),
  }),
);
