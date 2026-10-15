ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_biathlete boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_biathlete = true WHERE club IS NOT NULL AND length(trim(club)) > 0;