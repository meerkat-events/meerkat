ALTER TYPE "role" ADD VALUE 'speaker';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conference_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"conference_id" integer NOT NULL,
	"event_id" text NOT NULL,
	"signer_public_key" text NOT NULL,
	"product_id" text,
	"role" "role" DEFAULT 'attendee' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conference_tickets" ADD CONSTRAINT "conference_tickets_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
