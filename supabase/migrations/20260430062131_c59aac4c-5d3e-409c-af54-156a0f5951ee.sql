CREATE OR REPLACE FUNCTION public.reload_public_schema_cache()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  RETURN jsonb_build_object('ok', true, 'schema', 'public');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reload_public_schema_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reload_public_schema_cache() TO anon;

NOTIFY pgrst, 'reload schema';