ALTER TABLE "events" DROP CONSTRAINT "events_uid_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "events_uid_uniq" ON "events" USING btree (lower("uid"));