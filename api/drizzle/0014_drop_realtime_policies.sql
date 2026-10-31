-- Browsers no longer subscribe to Supabase Realtime: live updates come from
-- the API's SSE streams (api/realtime/). Remove what api/scripts/
-- supabase-policies.sql set up for `postgres_changes`. Row Level Security
-- stays enabled on every table: with no policy, anon and authenticated
-- (the public anon key) can read nothing.
DROP POLICY IF EXISTS "Realtime" ON "questions";--> statement-breakpoint
DROP POLICY IF EXISTS "Realtime" ON "reactions";--> statement-breakpoint
DROP POLICY IF EXISTS "Realtime" ON "votes";--> statement-breakpoint
-- Only Supabase has the publication; plain Postgres skips this.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions', 'reactions', 'votes'] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
