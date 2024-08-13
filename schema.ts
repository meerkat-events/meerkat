import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  zuAuthConfig: jsonb("zu_auth_config"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id").notNull().references(
    () => conferences.id,
    { onDelete: "cascade" },
  ),
  uid: text("uid").notNull().unique(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  submissionType: text("submission_type").notNull(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  abstract: text("abstract"),
  description: text("description"),
  track: text("track"),
  cover: text("cover"),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  eventId: integer("event_id").notNull().references(
    () => events.id,
    { onDelete: "cascade" },
  ),
  question: text("question").notNull(),
  userId: integer("user_id").notNull().references(
    () => users.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  zuTicketId: text("zu_ticket_id").notNull().unique(),
  userId: integer("user_id").notNull().references(
    () => users.id,
    { onDelete: "cascade" },
  ),
  conferenceId: integer("conference_id").notNull().references(
    () => conferences.id,
    { onDelete: "cascade" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});