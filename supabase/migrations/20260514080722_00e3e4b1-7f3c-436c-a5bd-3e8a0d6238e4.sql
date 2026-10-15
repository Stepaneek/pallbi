-- Remove block_comments feature
DROP TABLE IF EXISTS public.block_comments CASCADE;

-- Add max heart rate for free intensity
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_hr_free integer;