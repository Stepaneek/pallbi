CREATE TABLE public.athlete_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_groups TO authenticated;
GRANT ALL ON public.athlete_groups TO service_role;
ALTER TABLE public.athlete_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own groups" ON public.athlete_groups
  FOR ALL TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE TABLE public.athlete_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.athlete_groups(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, athlete_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_group_members TO authenticated;
GRANT ALL ON public.athlete_group_members TO service_role;
ALTER TABLE public.athlete_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own group members" ON public.athlete_group_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.athlete_groups g WHERE g.id = group_id AND g.coach_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.athlete_groups g WHERE g.id = group_id AND g.coach_id = auth.uid())
    AND public.is_linked_coach(auth.uid(), athlete_id)
  );

CREATE INDEX athlete_group_members_group_idx ON public.athlete_group_members(group_id);