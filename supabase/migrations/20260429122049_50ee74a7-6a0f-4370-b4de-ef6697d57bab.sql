-- =========================================================
-- DROP OLD
-- =========================================================
DROP TABLE IF EXISTS public.runs CASCADE;
DROP TYPE IF EXISTS public.fitness_level CASCADE;

-- Reset profiles to minimal
ALTER TABLE public.profiles DROP COLUMN IF EXISTS weekly_km_goal;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS fitness_level;

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('athlete', 'coach');
CREATE TYPE public.day_slot AS ENUM ('rano', 'dopoledne', 'odpoledne');
CREATE TYPE public.sport_kind AS ENUM ('beh', 'kolo', 'kolobezka_lyze', 'lyze', 'ostatni', 'strelba');
CREATE TYPE public.intensity_zone AS ENUM ('VOLNA', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6');
CREATE TYPE public.plan_real AS ENUM ('plan', 'real');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- COACH <-> ATHLETE LINKS
-- =========================================================
CREATE TABLE public.coach_athlete_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, coach_id)
);
ALTER TABLE public.coach_athlete_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_linked_coach(_coach_id uuid, _athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_athlete_links
    WHERE coach_id = _coach_id AND athlete_id = _athlete_id
  )
$$;

CREATE POLICY "Athlete or coach view link" ON public.coach_athlete_links
  FOR SELECT USING (auth.uid() = athlete_id OR auth.uid() = coach_id);
CREATE POLICY "Athlete deletes own link" ON public.coach_athlete_links
  FOR DELETE USING (auth.uid() = athlete_id);
-- Inserts happen via SECURITY DEFINER redeem function only; no INSERT policy.

-- =========================================================
-- COACH INVITES
-- =========================================================
CREATE TABLE public.coach_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.invite_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete views own invites" ON public.coach_invites
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Athlete creates own invites" ON public.coach_invites
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athlete revokes own invites" ON public.coach_invites
  FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "Athlete deletes own invites" ON public.coach_invites
  FOR DELETE USING (auth.uid() = athlete_id);

-- Public lookup of a token (so a logged-in coach can fetch invite info).
-- Returns just enough info to redeem.
CREATE OR REPLACE FUNCTION public.lookup_coach_invite(_token text)
RETURNS TABLE (id uuid, athlete_id uuid, coach_email text, status public.invite_status, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, athlete_id, coach_email, status, expires_at
  FROM public.coach_invites
  WHERE token = _token
$$;

-- Redeem invite: must be called by an authenticated user (the coach).
CREATE OR REPLACE FUNCTION public.redeem_coach_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.coach_invites;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.coach_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.coach_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF v_invite.athlete_id = v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_invite');
  END IF;

  -- Ensure coach role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'coach')
  ON CONFLICT DO NOTHING;

  -- Create link
  INSERT INTO public.coach_athlete_links (athlete_id, coach_id)
  VALUES (v_invite.athlete_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Mark invite accepted
  UPDATE public.coach_invites
    SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
    WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'athlete_id', v_invite.athlete_id);
END;
$$;

-- =========================================================
-- PROFILES — extend access for linked coaches
-- =========================================================
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_linked_coach(auth.uid(), id)
  );

-- =========================================================
-- TRAINING BLOCKS
-- =========================================================
CREATE TABLE public.training_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  slot public.day_slot NOT NULL,
  sport public.sport_kind NOT NULL,
  zone public.intensity_zone NOT NULL DEFAULT 'VOLNA',
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  distance_km numeric(6,2),
  avg_heart_rate integer CHECK (avg_heart_rate IS NULL OR (avg_heart_rate BETWEEN 30 AND 250)),
  rpe smallint CHECK (rpe IS NULL OR (rpe BETWEEN 0 AND 10)),
  notes text,
  shooting_hits integer CHECK (shooting_hits IS NULL OR shooting_hits >= 0),
  shooting_shots integer CHECK (shooting_shots IS NULL OR shooting_shots >= 0),
  strava_activity_id text,
  plan_or_real public.plan_real NOT NULL DEFAULT 'real',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_blocks_athlete_date ON public.training_blocks (athlete_id, block_date);
ALTER TABLE public.training_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete views own blocks" ON public.training_blocks
  FOR SELECT USING (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id));
CREATE POLICY "Athlete inserts own blocks" ON public.training_blocks
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athlete updates own blocks" ON public.training_blocks
  FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "Athlete deletes own blocks" ON public.training_blocks
  FOR DELETE USING (auth.uid() = athlete_id);
-- Coach can also INSERT/UPDATE/DELETE plan blocks for linked athlete:
CREATE POLICY "Coach manages plan blocks" ON public.training_blocks
  FOR ALL USING (
    public.is_linked_coach(auth.uid(), athlete_id) AND plan_or_real = 'plan'
  ) WITH CHECK (
    public.is_linked_coach(auth.uid(), athlete_id) AND plan_or_real = 'plan'
  );

CREATE TRIGGER update_training_blocks_updated_at
  BEFORE UPDATE ON public.training_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- WEEKLY META  (one row per athlete/year/iso_week/plan_or_real)
-- =========================================================
CREATE TABLE public.weekly_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iso_year integer NOT NULL,
  iso_week integer NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  plan_or_real public.plan_real NOT NULL DEFAULT 'real',
  -- Each field stores 7 daily values (po..ne) as numeric array, plus optional totals derived in app.
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, iso_year, iso_week, plan_or_real)
);
ALTER TABLE public.weekly_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athlete views own meta" ON public.weekly_meta
  FOR SELECT USING (auth.uid() = athlete_id OR public.is_linked_coach(auth.uid(), athlete_id));
CREATE POLICY "Athlete writes own meta" ON public.weekly_meta
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Athlete updates own meta" ON public.weekly_meta
  FOR UPDATE USING (auth.uid() = athlete_id);
CREATE POLICY "Athlete deletes own meta" ON public.weekly_meta
  FOR DELETE USING (auth.uid() = athlete_id);
CREATE POLICY "Coach manages plan meta" ON public.weekly_meta
  FOR ALL USING (public.is_linked_coach(auth.uid(), athlete_id) AND plan_or_real = 'plan')
  WITH CHECK (public.is_linked_coach(auth.uid(), athlete_id) AND plan_or_real = 'plan');

CREATE TRIGGER update_weekly_meta_updated_at
  BEFORE UPDATE ON public.weekly_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- BLOCK COMMENTS (coach feedback)
-- =========================================================
CREATE TABLE public.block_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.training_blocks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.block_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on accessible blocks" ON public.block_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_blocks tb
      WHERE tb.id = block_comments.block_id
        AND (tb.athlete_id = auth.uid() OR public.is_linked_coach(auth.uid(), tb.athlete_id))
    )
  );
CREATE POLICY "Coach inserts comment for linked athlete" ON public.block_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.training_blocks tb
      WHERE tb.id = block_comments.block_id
        AND public.is_linked_coach(auth.uid(), tb.athlete_id)
    )
  );
CREATE POLICY "Author updates own comment" ON public.block_comments
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Author deletes own comment" ON public.block_comments
  FOR DELETE USING (auth.uid() = author_id);

CREATE TRIGGER update_block_comments_updated_at
  BEFORE UPDATE ON public.block_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- handle_new_user: also assign default 'athlete' role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'athlete')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;
