ALTER TABLE "conference_role" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "conference_role" ALTER COLUMN "role" SET DEFAULT 'attendee'::text;--> statement-breakpoint
ALTER TABLE "conference_tickets" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "conference_tickets" ALTER COLUMN "role" SET DEFAULT 'attendee'::text;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('attendee', 'organizer', 'moderator');--> statement-breakpoint
ALTER TABLE "conference_role" ALTER COLUMN "role" SET DEFAULT 'attendee'::"public"."role";--> statement-breakpoint
ALTER TABLE "conference_role" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "conference_tickets" ALTER COLUMN "role" SET DEFAULT 'attendee'::"public"."role";--> statement-breakpoint
ALTER TABLE "conference_tickets" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";