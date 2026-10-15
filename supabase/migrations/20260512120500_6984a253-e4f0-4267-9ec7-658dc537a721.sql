CREATE OR REPLACE FUNCTION public.redeem_coach_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.coach_invites;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_token');
  END IF;

  SELECT *
    INTO v_invite
    FROM public.coach_invites
   WHERE token = trim(_token)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used', 'athlete_id', v_invite.athlete_id);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.coach_invites
       SET status = 'expired'
     WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_invite.athlete_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'coach')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.coach_athlete_links (athlete_id, coach_id)
  VALUES (v_invite.athlete_id, v_user_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.coach_invites
     SET status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'athlete_id', v_invite.athlete_id,
    'coach_id', v_user_id
  );
END;
$function$;