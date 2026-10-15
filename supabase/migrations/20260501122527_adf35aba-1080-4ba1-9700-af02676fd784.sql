ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notes text;
SELECT public.reload_public_schema_cache();