
-- Drop legacy self-reported results table (replaced by attempts flow)
DROP TABLE IF EXISTS public.results CASCADE;

-- Restrict has_role SECURITY DEFINER function execution: only authenticated users need it
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
