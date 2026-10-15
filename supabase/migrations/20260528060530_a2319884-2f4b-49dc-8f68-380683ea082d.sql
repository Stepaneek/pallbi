DROP POLICY IF EXISTS "Coach inserts link via valid invite" ON public.coach_athlete_links;
REVOKE INSERT ON public.coach_athlete_links FROM authenticated, anon;