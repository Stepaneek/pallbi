ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
-- Existing users with a name set should be considered already onboarded
UPDATE public.profiles SET onboarding_completed = true WHERE name IS NOT NULL AND trim(name) <> '';