-- Backfill profiles for any existing auth users missing one
INSERT INTO public.profiles (id, name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill athlete role for any existing users missing any role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'athlete'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT DO NOTHING;

-- Reload PostgREST schema cache (fixes "Could not query the database for the schema cache")
NOTIFY pgrst, 'reload schema';