-- Read-only post-deploy verification. Both rows must show guard_present=true.
SELECT p.proname,
  p.prosecdef AS security_definer,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute_preserved,
  position('where user_id=(select auth.uid()) and active=true and archived_at is null;'
    in lower(pg_get_functiondef(p.oid)))>0 AS guard_present
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('academy_build_automation_queue','academy_complete_automation_job')
ORDER BY p.proname;
