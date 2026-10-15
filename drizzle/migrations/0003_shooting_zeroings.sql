CREATE TABLE public.shooting_zeroings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  author_id uuid NOT NULL,
  zeroing_date date NOT NULL DEFAULT current_date,
  stance text NOT NULL CHECK (stance IN ('prone','standing')),
  shots jsonb NOT NULL DEFAULT '[]'::jsonb,
  center_x_mm numeric NOT NULL DEFAULT 0,
  center_y_mm numeric NOT NULL DEFAULT 0,
  offset_mm numeric NOT NULL DEFAULT 0,
  clock_hour numeric,
  click_mm numeric NOT NULL DEFAULT 1.5,
  clicks_vertical integer NOT NULL DEFAULT 0,
  clicks_horizontal integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shooting_zeroings TO authenticated;
GRANT ALL ON public.shooting_zeroings TO service_role;
ALTER TABLE public.shooting_zeroings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or linked zeroings" ON public.shooting_zeroings FOR SELECT TO authenticated
  USING (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id));
CREATE POLICY "Insert own or linked zeroings" ON public.shooting_zeroings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id)));
CREATE POLICY "Author deletes zeroing" ON public.shooting_zeroings FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR auth.uid() = athlete_id);
CREATE INDEX shooting_zeroings_athlete_date ON public.shooting_zeroings (athlete_id, zeroing_date DESC);