CREATE TABLE IF NOT EXISTS "conference_role" (
	"conference_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "role" NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conference_role_conference_id_user_id_pk" PRIMARY KEY("conference_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conference_role" ADD CONSTRAINT "conference_role_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conference_role" ADD CONSTRAINT "conference_role_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conference_role_user_id_idx" ON "conference_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_event_id_idx" ON "questions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_event_id_idx" ON "reactions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "votes_user_id_idx" ON "votes" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";