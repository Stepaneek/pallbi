
-- 1. Restrictive INSERT policy on coach_athlete_links: only via a valid pending invite
CREATE POLICY "Coach inserts link via valid invite"
ON public.coach_athlete_links
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = coach_id
  AND EXISTS (
    SELECT 1 FROM public.coach_invites ci
    WHERE ci.athlete_id = coach_athlete_links.athlete_id
      AND ci.status IN ('pending', 'accepted')
      AND ci.expires_at > now()
  )
);

-- 2. Revoke EXECUTE on internal SECURITY DEFINER functions from API roles.
-- Keep redeem_coach_invite and lookup_coach_invite callable (used by client/edge).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_linked_coach(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reload_public_schema_cache() FROM anon, authenticated, public;

-- Ensure intentionally-exposed helpers remain callable
GRANT EXECUTE ON FUNCTION public.redeem_coach_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_coach_invite(text) TO anon, authenticated;
