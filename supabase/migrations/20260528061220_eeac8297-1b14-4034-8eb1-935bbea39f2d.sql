CREATE TABLE public.polar_tokens (
  user_id uuid NOT NULL PRIMARY KEY,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  polar_user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polar_tokens TO authenticated;
GRANT ALL ON public.polar_tokens TO service_role;

ALTER TABLE public.polar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own polar tokens" ON public.polar_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own polar tokens" ON public.polar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own polar tokens" ON public.polar_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own polar tokens" ON public.polar_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER polar_tokens_updated_at
  BEFORE UPDATE ON public.polar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.training_blocks ADD COLUMN IF NOT EXISTS polar_exercise_id text;
CREATE INDEX IF NOT EXISTS idx_training_blocks_polar_exercise_id ON public.training_blocks(polar_exercise_id) WHERE polar_exercise_id IS NOT NULL;