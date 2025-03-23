DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('anonymous', 'attendee', 'organizer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "role" DEFAULT 'anonymous' NOT NULL;