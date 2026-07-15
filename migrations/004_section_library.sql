-- Shared storage for beta's reusable budget section library.
-- Production code ignores this additive column until the feature is promoted.
ALTER TABLE public.category_defaults
  ADD COLUMN IF NOT EXISTS section_library JSONB NOT NULL DEFAULT '[]'::jsonb;
