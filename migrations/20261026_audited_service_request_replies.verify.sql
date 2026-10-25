-- Read-only post-deployment checks; returns false if any required safeguard is missing.
SELECT
  NOT has_table_privilege('authenticated','public.academy_student_requests','UPDATE') AS direct_patch_blocked,
  NOT has_table_privilege('anon','public.academy_student_requests','UPDATE') AS anonymous_patch_blocked,
  has_function_privilege('authenticated','public.academy_reply_service_request(uuid,text,text,text)','EXECUTE') AS staff_rpc_available_to_authenticated,
  NOT has_function_privilege('anon','public.academy_reply_service_request(uuid,text,text,text)','EXECUTE') AS anonymous_rpc_blocked,
  NOT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academy_student_requests' AND cmd='UPDATE'
  ) AS no_direct_update_rls_policy,
  position('academy_audit_log' in pg_get_functiondef('public.academy_reply_service_request(uuid,text,text,text)'::regprocedure))>0 AS audit_hook_present,
  position('archived_at IS NULL' in pg_get_functiondef('public.academy_reply_service_request(uuid,text,text,text)'::regprocedure))>0 AS archived_student_guard_present;
