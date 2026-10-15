CREATE TABLE public.day_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_date date NOT NULL,
  body text NOT NULL DEFAULT '',
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX day_comments_athlete_date_idx ON public.day_comments (athlete_id, comment_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_comments TO authenticated;
GRANT ALL ON public.day_comments TO service_role;

ALTER TABLE public.day_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete or linked coach views day comments"
ON public.day_comments FOR SELECT TO authenticated
USING (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id));

CREATE POLICY "Athlete or linked coach writes day comments"
ON public.day_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id AND (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id)));

CREATE POLICY "Author updates own day comment"
ON public.day_comments FOR UPDATE TO authenticated
USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author deletes own day comment"
ON public.day_comments FOR DELETE TO authenticated
USING (auth.uid() = author_id);

CREATE TRIGGER update_day_comments_updated_at
BEFORE UPDATE ON public.day_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();