CREATE TABLE public.shooting_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 athlete_id uuid NOT NULL REFERENCES public.profiles(id),
 author_id uuid NOT NULL REFERENCES public.profiles(id),
 session_date date NOT NULL DEFAULT CURRENT_DATE,
 item_type text NOT NULL DEFAULT 'zeroing' CHECK (item_type IN ('zeroing','training','race')),
 stance text NOT NULL CHECK (stance IN ('prone','standing')),
 shots jsonb NOT NULL CHECK (jsonb_typeof(shots) = 'array' AND jsonb_array_length(shots) BETWEEN 1 AND 10),
 center_x_mm numeric NOT NULL DEFAULT 0,
 center_y_mm numeric NOT NULL DEFAULT 0,
 offset_mm numeric NOT NULL DEFAULT 0,
 clock_hour numeric,
 click_mm numeric NOT NULL DEFAULT 1.5 CHECK (click_mm = 1.5),
 clicks_vertical integer NOT NULL DEFAULT 0,
 clicks_horizontal integer NOT NULL DEFAULT 0,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.shooting_sessions TO authenticated;
GRANT ALL ON public.shooting_sessions TO service_role;
ALTER TABLE public.shooting_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own or linked sessions" ON public.shooting_sessions FOR SELECT TO authenticated USING (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id));
CREATE POLICY "Write own or linked sessions" ON public.shooting_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id)));
CREATE POLICY "Delete authored or own sessions" ON public.shooting_sessions FOR DELETE TO authenticated USING (auth.uid() = author_id OR auth.uid() = athlete_id);
CREATE INDEX shooting_sessions_athlete_date_idx ON public.shooting_sessions(athlete_id,session_date DESC,created_at DESC);
INSERT INTO public.shooting_sessions (id,athlete_id,author_id,session_date,stance,shots,center_x_mm,center_y_mm,offset_mm,clock_hour,click_mm,clicks_vertical,clicks_horizontal,notes,created_at)
SELECT id,athlete_id,author_id,zeroing_date,stance,shots,center_x_mm,center_y_mm,offset_mm,clock_hour,1.5,clicks_vertical,clicks_horizontal,notes,created_at FROM public.shooting_zeroings WHERE jsonb_typeof(shots)='array' AND jsonb_array_length(shots) BETWEEN 1 AND 10 AND stance IN ('prone','standing');
COMMENT ON TABLE public.shooting_zeroings IS 'DEPRECATED: replaced by public.shooting_sessions';