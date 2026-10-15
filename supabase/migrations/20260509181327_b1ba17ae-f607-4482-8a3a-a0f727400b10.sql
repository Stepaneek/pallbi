DELETE FROM public.training_blocks tb
USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY athlete_id, strava_activity_id ORDER BY created_at ASC) AS rn
  FROM public.training_blocks
  WHERE strava_activity_id IS NOT NULL
) d
WHERE tb.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS training_blocks_athlete_strava_uniq
  ON public.training_blocks (athlete_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;