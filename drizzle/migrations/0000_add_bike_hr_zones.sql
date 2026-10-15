ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_bike_hr_zones boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bike_hr_i1_max integer,
  ADD COLUMN IF NOT EXISTS bike_hr_i2_max integer,
  ADD COLUMN IF NOT EXISTS bike_hr_i3_max integer,
  ADD COLUMN IF NOT EXISTS bike_hr_i4_max integer,
  ADD COLUMN IF NOT EXISTS bike_hr_i5_max integer,
  ADD COLUMN IF NOT EXISTS bike_max_hr_free integer;