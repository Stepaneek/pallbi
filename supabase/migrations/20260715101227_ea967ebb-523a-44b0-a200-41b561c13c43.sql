
CREATE TABLE IF NOT EXISTS public.polar_tokens (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  polar_user_id bigint,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polar_tokens TO authenticated;
GRANT ALL ON public.polar_tokens TO service_role;

ALTER TABLE public.polar_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own polar tokens" ON public.polar_tokens;
DROP POLICY IF EXISTS "Users insert own polar tokens" ON public.polar_tokens;
DROP POLICY IF EXISTS "Users update own polar tokens" ON public.polar_tokens;
DROP POLICY IF EXISTS "Users delete own polar tokens" ON public.polar_tokens;

CREATE POLICY "Users view own polar tokens" ON public.polar_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own polar tokens" ON public.polar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own polar tokens" ON public.polar_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own polar tokens" ON public.polar_tokens
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS polar_tokens_updated_at ON public.polar_tokens;
CREATE TRIGGER polar_tokens_updated_at
  BEFORE UPDATE ON public.polar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.training_blocks ADD COLUMN IF NOT EXISTS polar_exercise_id text;
CREATE INDEX IF NOT EXISTS idx_training_blocks_polar_exercise_id
  ON public.training_blocks(polar_exercise_id)
  WHERE polar_exercise_id IS NOT NULL;
