-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ethsfvpeidtojqarocxz/sql/new
CREATE TABLE IF NOT EXISTS category_defaults (
  id TEXT PRIMARY KEY DEFAULT 'current',
  residential_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  residential_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  condo_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  condo_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_sqft INTEGER NOT NULL DEFAULT 4000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);
