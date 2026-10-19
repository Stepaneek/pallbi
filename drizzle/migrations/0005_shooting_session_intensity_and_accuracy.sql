CREATE OR REPLACE FUNCTION public.shooting_session_hits(_shots jsonb, _stance text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT count(*)::integer FROM jsonb_array_elements(_shots) AS shot
 WHERE sqrt(power((shot->>'x')::numeric, 2) + power((shot->>'y')::numeric, 2)) <= CASE WHEN _stance = 'standing' THEN 57.5 ELSE 22.5 END;
$$;
ALTER TABLE public.shooting_sessions
 ADD COLUMN intensity text CHECK (intensity IS NULL OR (item_type = 'training' AND intensity IN ('i1','i2','i3','i4','i5'))),
 ADD COLUMN shots_count integer GENERATED ALWAYS AS (jsonb_array_length(shots)) STORED,
 ADD COLUMN hits_count integer GENERATED ALWAYS AS (public.shooting_session_hits(shots, stance)) STORED,
 ADD COLUMN misses_count integer GENERATED ALWAYS AS (jsonb_array_length(shots) - public.shooting_session_hits(shots, stance)) STORED;
COMMENT ON COLUMN public.shooting_sessions.click_mm IS 'DEPRECATED: click corrections no longer used in the shooting log';
COMMENT ON COLUMN public.shooting_sessions.clicks_vertical IS 'DEPRECATED: click corrections no longer used in the shooting log';
COMMENT ON COLUMN public.shooting_sessions.clicks_horizontal IS 'DEPRECATED: click corrections no longer used in the shooting log';