CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hashed_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "stage" text;--> statement-breakpoint
UPDATE "events" SET "stage" = 'main' WHERE "stage" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "stage" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "submission_type";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "track";--> statement-breakpoint
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_name_unique" UNIQUE("name");