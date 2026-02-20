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
  customized_at TIMESTAMPTZ
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

-- Budgets: authenticated users can do everything, anon can read/update (for live budget links)
CREATE POLICY "Authenticated users full access to budgets"
  ON budgets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read budgets by ID"
  ON budgets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can update budgets (live budget auto-save)"
  ON budgets FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Budget Versions: authenticated full access, anon can insert (auto-save creates versions)
CREATE POLICY "Authenticated users full access to versions"
  ON budget_versions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can insert versions (auto-save)"
  ON budget_versions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read versions"
  ON budget_versions FOR SELECT
  TO anon
  USING (true);

-- Budget Views: anyone can insert (view tracking), authenticated can read
CREATE POLICY "Anyone can insert views"
  ON budget_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read views"
  ON budget_views FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Short Links: authenticated full access, anon can read + update access count
CREATE POLICY "Authenticated users full access to short_links"
  ON short_links FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read short_links"
  ON short_links FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can update short_links (access tracking)"
  ON short_links FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
