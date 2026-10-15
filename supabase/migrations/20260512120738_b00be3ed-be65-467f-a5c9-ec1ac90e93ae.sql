DROP POLICY IF EXISTS "Users insert own roles" ON public.user_roles;
REVOKE ALL ON FUNCTION public.lookup_coach_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_coach_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.lookup_coach_invite(text) FROM authenticated;