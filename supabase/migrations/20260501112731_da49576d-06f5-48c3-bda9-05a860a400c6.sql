DROP TABLE IF EXISTS public.races;

CREATE TYPE public.event_type AS ENUM ('zavod', 'soustredeni', 'volno');

CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  event_type public.event_type NOT NULL,
  title TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete views own events"
ON public.calendar_events FOR SELECT
USING ((auth.uid() = athlete_id) OR is_linked_coach(auth.uid(), athlete_id));

CREATE POLICY "Athlete inserts own events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athlete updates own events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = athlete_id);

CREATE POLICY "Athlete deletes own events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = athlete_id);

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_calendar_events_athlete_date ON public.calendar_events(athlete_id, date_from);