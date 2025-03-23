DROP TABLE "tickets";--> statement-breakpoint
ALTER TABLE "conference_role" ALTER COLUMN "role" SET DEFAULT 'attendee';--> statement-breakpoint
ALTER TABLE "conferences" DROP COLUMN IF EXISTS "zu_auth_config";