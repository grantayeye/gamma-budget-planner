-- Lock application data behind the Express API. The browser does not access
-- these tables directly; the server uses the Supabase service role.
-- Safe for the shared beta/production project once the server routes are live.

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_defaults ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'budgets',
        'budget_versions',
        'budget_views',
        'short_links',
        'category_defaults'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON TABLE public.budgets FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.budget_versions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.budget_views FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.short_links FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.category_defaults FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.budgets TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.budget_versions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.budget_views TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.short_links TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.category_defaults TO service_role;
