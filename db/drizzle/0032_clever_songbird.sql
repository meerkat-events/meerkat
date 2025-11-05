ALTER TABLE "event_pods" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nonces" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_pods" CASCADE;--> statement-breakpoint
DROP TABLE "nonces" CASCADE;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "submission_type" SET DEFAULT 'talk';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "submission_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "abstract";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "secret";