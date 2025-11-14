CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hashed_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "stage" text NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "submission_type";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "track";--> statement-breakpoint
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_name_unique" UNIQUE("name");