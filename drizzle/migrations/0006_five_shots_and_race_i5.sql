ALTER TABLE public.shooting_sessions DROP CONSTRAINT shooting_sessions_check;
ALTER TABLE public.shooting_sessions ADD CONSTRAINT shooting_sessions_check CHECK (intensity IS NULL OR (item_type = 'training' AND intensity IN ('i1','i2','i3','i4','i5')) OR (item_type = 'race' AND intensity = 'i5'));
ALTER TABLE public.shooting_sessions DROP CONSTRAINT shooting_sessions_shots_check;
ALTER TABLE public.shooting_sessions ADD CONSTRAINT shooting_sessions_shots_check CHECK (jsonb_typeof(shots) = 'array' AND jsonb_array_length(shots) >= 1 AND jsonb_array_length(shots) <= 5);