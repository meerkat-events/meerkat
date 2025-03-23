CREATE TABLE IF NOT EXISTS "event_pods" (
	"uid" text PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"pod" jsonb NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "hash" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_pods" ADD CONSTRAINT "event_pods_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_pods" ADD CONSTRAINT "event_pods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_pods_event_id_idx" ON "event_pods" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "votes_question_id_idx" ON "votes" USING btree ("question_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_id_unique" UNIQUE("id");