-- ============================================================
-- Budget Planner — Supabase Schema
-- Run this in the SQL Editor after project is ready
-- ============================================================

-- Budgets
CREATE TABLE budgets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_name TEXT,
  builder TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  modified_at TIMESTAMPTZ DEFAULT now(),
  views_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  current_state JSONB,
  is_customized BOOLEAN DEFAULT false,
  sqft_locked INTEGER,
  property_type_locked TEXT,
  category_config JSONB,
  custom_categories JSONB,
  customized_at TIMESTAMPTZ,
  created_by_email TEXT
);

CREATE INDEX idx_budgets_modified ON budgets(modified_at DESC);

-- Budget Versions
CREATE TABLE budget_versions (
  id BIGSERIAL PRIMARY KEY,
  budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
  version_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  state JSONB,
  note TEXT,
  is_pinned BOOLEAN DEFAULT false
);

CREATE INDEX idx_versions_budget ON budget_versions(budget_id);

-- Budget Views (analytics)
CREATE TABLE budget_views (
  id BIGSERIAL PRIMARY KEY,
  budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_views_budget ON budget_views(budget_id);

-- Short Links
CREATE TABLE short_links (
  code TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  client_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- All application table access goes through the Express server using the
-- service role. No direct browser/anon/authenticated table access is granted.
REVOKE ALL PRIVILEGES ON TABLE budgets FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE budget_versions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE budget_views FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE short_links FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE budgets TO service_role;
GRANT ALL PRIVILEGES ON TABLE budget_versions TO service_role;
GRANT ALL PRIVILEGES ON TABLE budget_views TO service_role;
GRANT ALL PRIVILEGES ON TABLE short_links TO service_role;
