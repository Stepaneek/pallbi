-- Internal helpers: only the postgres role / RLS engine should call them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_linked_coach(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Redeem requires auth.
REVOKE EXECUTE ON FUNCTION public.redeem_coach_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_coach_invite(text) TO authenticated;

-- Lookup intentionally public (coach previews invite before login).
GRANT EXECUTE ON FUNCTION public.lookup_coach_invite(text) TO anon, authenticated;
