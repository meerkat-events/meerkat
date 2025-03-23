CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"conference_id" integer NOT NULL,
	"uid" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"submission_type" text NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"abstract" text,
	"description" text,
	"track" text,
	"cover" text,
	CONSTRAINT "events_uid_unique" UNIQUE("uid"),
	CONSTRAINT "events_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "conferences" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uid_idx" ON "events" USING btree ("uid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "code_idx" ON "events" USING btree ("code");