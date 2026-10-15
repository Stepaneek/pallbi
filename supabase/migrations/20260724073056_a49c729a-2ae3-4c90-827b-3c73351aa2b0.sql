
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'inactive',
  plan text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status IN ('active','trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_coach_invite(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.coach_invites;
  v_user_id uuid := auth.uid();
  v_existing_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_token');
  END IF;

  SELECT * INTO v_invite FROM public.coach_invites
   WHERE token = trim(_token) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used', 'athlete_id', v_invite.athlete_id);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.coach_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_invite.athlete_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  -- Enforce free-tier limit: 1 athlete without active subscription.
  SELECT count(*) INTO v_existing_count
    FROM public.coach_athlete_links
   WHERE coach_id = v_user_id AND athlete_id <> v_invite.athlete_id;

  IF v_existing_count >= 1 AND NOT public.has_active_subscription(v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'subscription_required');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'coach') ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.coach_athlete_links (athlete_id, coach_id)
  VALUES (v_invite.athlete_id, v_user_id) ON CONFLICT DO NOTHING;

  UPDATE public.coach_invites
     SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'athlete_id', v_invite.athlete_id, 'coach_id', v_user_id);
END;
$function$;
