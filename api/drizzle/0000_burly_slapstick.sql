CREATE TYPE "public"."role" AS ENUM('attendee', 'speaker', 'organizer');--> statement-breakpoint
CREATE TABLE "conference_role" (
	"conference_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'attendee' NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conference_role_conference_id_user_id_pk" PRIMARY KEY("conference_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conference_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"conference_id" integer NOT NULL,
	"collection_name" text NOT NULL,
	"event_id" text NOT NULL,
	"signer_public_key" text NOT NULL,
	"product_id" text,
	"role" "role" DEFAULT 'attendee' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"theme" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"conference_id" integer NOT NULL,
	"uid" text NOT NULL,
	"title" text NOT NULL,
	"submission_type" text DEFAULT 'talk',
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"description" text,
	"track" text,
	"cover" text,
	"speaker" text,
	"live" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"conference_id" integer NOT NULL,
	"name" text NOT NULL,
	"active" boolean NOT NULL,
	CONSTRAINT "features_conference_id_name_pk" PRIMARY KEY("conference_id","name")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" uuid NOT NULL,
	"name" text,
	"zupass_id" text,
	CONSTRAINT "profile_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"event_id" integer NOT NULL,
	"question" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"selected_at" timestamp,
	"answered_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "questions_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"uid" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- CREATE TABLE "auth"."users" (
-- 	"id" uuid PRIMARY KEY NOT NULL,
-- 	"aud" varchar(255),
-- 	"role" varchar(255),
-- 	"email" varchar(255),
-- 	"banned_until" timestamp
-- );
--> statement-breakpoint
CREATE TABLE "votes" (
	"question_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "votes_question_id_user_id_pk" PRIMARY KEY("question_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "conference_role" ADD CONSTRAINT "conference_role_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_role" ADD CONSTRAINT "conference_role_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_tickets" ADD CONSTRAINT "conference_tickets_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conference_role_user_id_idx" ON "conference_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conference_tickets_conference_id_idx" ON "conference_tickets" USING btree ("conference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_uid_uniq" ON "events" USING btree (lower("uid"));--> statement-breakpoint
CREATE INDEX "events_conference_id_idx" ON "events" USING btree ("conference_id");--> statement-breakpoint
CREATE INDEX "questions_event_id_idx" ON "questions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "questions_user_id_idx" ON "questions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reactions_event_id_idx" ON "reactions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "reactions_user_id_idx" ON "reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "votes_user_id_idx" ON "votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "votes_question_id_idx" ON "votes" USING btree ("question_id");