CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"id" text NOT NULL,
	CONSTRAINT "provider_id_uniq" UNIQUE("provider","id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
