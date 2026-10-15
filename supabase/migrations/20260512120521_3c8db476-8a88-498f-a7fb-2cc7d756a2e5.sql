REVOKE ALL ON FUNCTION public.redeem_coach_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_coach_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_coach_invite(text) TO authenticated;