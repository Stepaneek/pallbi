-- Add segments JSONB column to training_blocks for multi-interval blocks.
-- Each segment: { zone: 'VOLNA'|'I1'..'I6', duration_minutes: integer >= 0 }
-- Existing zone + duration_minutes columns are kept for backward compatibility:
--   zone = first segment's zone (or dominant); duration_minutes = sum of segments.
ALTER TABLE public.training_blocks
  ADD COLUMN IF NOT EXISTS segments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: convert existing single-zone blocks into a one-segment array
UPDATE public.training_blocks
SET segments = jsonb_build_array(
  jsonb_build_object('zone', zone::text, 'duration_minutes', duration_minutes)
)
WHERE (segments IS NULL OR segments = '[]'::jsonb)
  AND duration_minutes > 0;