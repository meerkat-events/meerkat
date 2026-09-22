ALTER TABLE "conferences" ADD COLUMN "pretalx_event" text;--> statement-breakpoint
ALTER TABLE "conferences" ADD COLUMN "pretalx_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_pretalx_event_unique" UNIQUE("pretalx_event");