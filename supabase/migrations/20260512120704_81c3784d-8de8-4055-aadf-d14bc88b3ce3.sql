CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_initial_role public.app_role := 'athlete';
BEGIN
  IF NEW.raw_user_meta_data->>'initial_role' = 'coach' THEN
    v_initial_role := 'coach';
  END IF;

  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_initial_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;