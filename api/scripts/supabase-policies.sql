-- Supabase-specific setup that the Drizzle migrations in api/drizzle/ do not
-- manage. Run once per new Supabase project, after `pnpm migrate`:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql
--
-- Idempotent: safe to re-run. Requires the Supabase roles (anon, authenticated)
-- and the supabase_realtime publication, so it does not work on plain Postgres.

-- Row Level Security itself is not here: every table in api/schema.ts calls
-- .enableRLS(), so the migration that creates a table also enables it
-- (api/schema.test.ts checks this). RLS with no policy means no access for
-- anon/authenticated; the API connects as the table owner and is unaffected.

-- 1. Browser realtime (supabase-js `postgres_changes`) needs a SELECT policy for
--    the subscribing role: questions (app/hooks/use-all-questions.ts), reactions
--    (app/hooks/use-reactions-subscription.ts) and votes. Questions hidden by
--    automatic moderation (hidden_at set) must never reach other browsers.
DROP POLICY IF EXISTS "Realtime" ON public.questions;
CREATE POLICY "Realtime" ON public.questions
  FOR SELECT TO anon, authenticated USING (hidden_at IS NULL);

DROP POLICY IF EXISTS "Realtime" ON public.reactions;
CREATE POLICY "Realtime" ON public.reactions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Realtime" ON public.votes;
CREATE POLICY "Realtime" ON public.votes
  FOR SELECT TO anon, authenticated USING (true);

-- 2. Publish those tables on the realtime publication.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions', 'reactions', 'votes'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
