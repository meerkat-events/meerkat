DROP TABLE "conference_tickets" CASCADE;--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "zupass_id";--> statement-breakpoint
-- The Zupass "collect" flow (Event Card, attendance PODs) is gone.
DELETE FROM "features" WHERE "name" = 'collect';