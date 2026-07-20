-- Team-wide reusable budget sections with row-level writes and audit metadata.
CREATE TABLE IF NOT EXISTS public.section_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  tags TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS section_library_name_lower_idx
  ON public.section_library (lower(name));

ALTER TABLE public.section_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.section_library FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.section_library TO service_role;

-- Preserve any beta v1 library entries stored in category_defaults JSON.
INSERT INTO public.section_library (
  id, name, description, category, tags, payload, created_at, updated_at, created_by
)
SELECT
  item->>'id',
  item->>'name',
  COALESCE(item->>'description', ''),
  COALESCE(item->>'category', 'Other'),
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'tags', '[]'::jsonb))),
  item->'payload',
  COALESCE((item->>'createdAt')::timestamptz, now()),
  COALESCE((item->>'updatedAt')::timestamptz, now()),
  COALESCE(item->>'createdBy', '')
FROM public.category_defaults defaults,
LATERAL jsonb_array_elements(COALESCE(defaults.section_library, '[]'::jsonb)) item
WHERE defaults.id = 'current'
  AND item ? 'id'
  AND item ? 'name'
  AND item ? 'payload'
ON CONFLICT DO NOTHING;
