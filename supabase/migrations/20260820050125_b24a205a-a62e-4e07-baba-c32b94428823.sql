CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  body text,
  link_date date,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_day_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.author_id <> NEW.athlete_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, body, link_date)
    VALUES (NEW.athlete_id, NEW.author_id, 'comment', left(coalesce(NEW.body, ''), 200), NEW.comment_date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER day_comments_notify AFTER INSERT ON public.day_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_day_comment();

CREATE OR REPLACE FUNCTION public.notify_plan_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.athlete_id AND NEW.plan_or_real = 'plan' THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, body, link_date)
    VALUES (NEW.athlete_id, auth.uid(), 'plan', NULL, NEW.block_date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER training_blocks_notify_plan AFTER INSERT OR UPDATE ON public.training_blocks
FOR EACH ROW EXECUTE FUNCTION public.notify_plan_block();