DROP INDEX "events_uid_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "events_uid_uniq" ON "events" USING btree ("uid");