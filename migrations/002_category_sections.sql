-- Additive section model for category defaults.
-- Safe to run before app code deploys: existing JSON category arrays remain intact.
ALTER TABLE category_defaults
  ADD COLUMN IF NOT EXISTS residential_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS condo_sections JSONB NOT NULL DEFAULT '[]'::jsonb;
