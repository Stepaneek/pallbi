ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hr_i1_max integer,
  ADD COLUMN IF NOT EXISTS hr_i2_max integer,
  ADD COLUMN IF NOT EXISTS hr_i3_max integer,
  ADD COLUMN IF NOT EXISTS hr_i4_max integer,
  ADD COLUMN IF NOT EXISTS hr_i5_max integer;