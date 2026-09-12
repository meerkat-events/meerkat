-- Supabase-specific setup that the Drizzle migrations in api/drizzle/ do not
-- manage. Run once per new Supabase project, after `pnpm migrate`:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql
--
-- Idempotent: safe to re-run. Requires the Supabase roles (anon, authenticated)
-- and the supabase_realtime publication, so it does not work on plain Postgres.

-- 1. Row Level Security on every public table.
--    The public schema is exposed through PostgREST with the anon key that every
--    browser receives from /api/v1/config. RLS with no policy means no access
--    for anon/authenticated. The API connects as the table owner (postgres) and
--    is not affected.
ALTER TABLE public.profile            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_role    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys           ENABLE ROW LEVEL SECURITY;

-- 2. Browser realtime (supabase-js `postgres_changes`) needs a SELECT policy for
--    the subscribing role: questions (app/hooks/use-all-questions.ts), reactions
--    (app/hooks/use-reactions-subscription.ts) and votes.
DROP POLICY IF EXISTS "Realtime" ON public.questions;
CREATE POLICY "Realtime" ON public.questions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Realtime" ON public.reactions;
CREATE POLICY "Realtime" ON public.reactions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Realtime" ON public.votes;
CREATE POLICY "Realtime" ON public.votes
  FOR SELECT TO anon, authenticated USING (true);

-- 3. Publish those tables on the realtime publication.
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
