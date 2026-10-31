DROP TABLE "conference_tickets" CASCADE;--> statement-breakpoint
DROP TABLE "profile" CASCADE;--> statement-breakpoint
-- The Zupass "collect" flow (Event Card, attendance PODs) is gone.
DELETE FROM "features" WHERE "name" = 'collect';