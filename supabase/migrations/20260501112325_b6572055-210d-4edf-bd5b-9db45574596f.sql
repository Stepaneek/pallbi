CREATE TABLE public.races (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  race_date DATE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  discipline TEXT,
  category TEXT,
  goal TEXT,
  result_time TEXT,
  placement_overall INTEGER,
  placement_category INTEGER,
  shooting_hits INTEGER,
  shooting_shots INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete views own races"
ON public.races FOR SELECT
USING ((auth.uid() = athlete_id) OR is_linked_coach(auth.uid(), athlete_id));

CREATE POLICY "Athlete inserts own races"
ON public.races FOR INSERT
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athlete updates own races"
ON public.races FOR UPDATE
USING (auth.uid() = athlete_id);

CREATE POLICY "Athlete deletes own races"
ON public.races FOR DELETE
USING (auth.uid() = athlete_id);

CREATE TRIGGER update_races_updated_at
BEFORE UPDATE ON public.races
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_races_athlete_date ON public.races(athlete_id, race_date DESC);