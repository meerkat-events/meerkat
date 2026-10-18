CREATE INDEX "events_uid_lower_idx" ON "events" USING btree (lower("uid"));--> statement-breakpoint
CREATE INDEX "events_stage_live_idx" ON "events" USING btree ("stage","start") WHERE "events"."live";--> statement-breakpoint
CREATE INDEX "events_stage_start_idx" ON "events" USING btree ("stage","start");