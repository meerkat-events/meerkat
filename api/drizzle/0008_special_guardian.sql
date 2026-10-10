ALTER TABLE "conferences" ADD COLUMN "moderation" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "moderation" jsonb;