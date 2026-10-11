CREATE TABLE "supervote_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "supervote_balances_balance_not_negative" CHECK ("supervote_balances"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "supervote_balances" ADD CONSTRAINT "supervote_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;