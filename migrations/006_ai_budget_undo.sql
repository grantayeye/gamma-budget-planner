-- One safe, short-lived undo snapshot per budget. Service-role access only.
CREATE TABLE IF NOT EXISTS public.ai_budget_undo (
  budget_id TEXT PRIMARY KEY REFERENCES public.budgets(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  applied_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_budget_undo ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ai_budget_undo FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.ai_budget_undo TO service_role;
