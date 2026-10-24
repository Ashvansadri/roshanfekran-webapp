-- Harden internal quota counters; no direct anon/authenticated access is required.
-- academy_public_ai_consume_quota is SECURITY DEFINER owned by postgres and retains owner-bypass.
-- Do NOT FORCE RLS or grant table privileges; gateway-only service continues to work.
DO $guard$
BEGIN
 IF has_table_privilege('anon','public.academy_public_ai_quota','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated','public.academy_public_ai_quota','SELECT,INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'Quota table unexpectedly exposed; inspect grants before enabling RLS';
 END IF;
 IF (SELECT pg_get_userbyid(p.proowner)
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='academy_public_ai_consume_quota') <> 'postgres' THEN
  RAISE EXCEPTION 'Quota definer owner changed; abort safe migration';
 END IF;
END $guard$;
ALTER TABLE public.academy_public_ai_quota ENABLE ROW LEVEL SECURITY;
