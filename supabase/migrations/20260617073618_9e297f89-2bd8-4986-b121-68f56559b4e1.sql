CREATE POLICY "Athlete views linked coach profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coach_athlete_links
    WHERE coach_id = profiles.id AND athlete_id = auth.uid()
  )
);