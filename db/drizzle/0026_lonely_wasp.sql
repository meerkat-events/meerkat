CREATE TABLE IF NOT EXISTS "nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conference_tickets" ADD COLUMN "collection_name" text;--> statement-breakpoint
UPDATE "conference_tickets" SET "collection_name" = 'Devcon SEA';--> statement-breakpoint
ALTER TABLE "conference_tickets" ALTER COLUMN "collection_name" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nonces" ADD CONSTRAINT "nonces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
