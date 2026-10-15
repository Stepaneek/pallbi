
-- Strava tokens table
CREATE TABLE public.strava_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  strava_athlete_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own strava tokens"
  ON public.strava_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own strava tokens"
  ON public.strava_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own strava tokens"
  ON public.strava_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own strava tokens"
  ON public.strava_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_strava_tokens_updated_at
  BEFORE UPDATE ON public.strava_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track last sync on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_strava_sync_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
