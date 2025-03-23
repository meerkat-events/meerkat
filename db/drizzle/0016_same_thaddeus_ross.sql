ALTER TABLE "events" DROP CONSTRAINT "events_code_unique";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "code";