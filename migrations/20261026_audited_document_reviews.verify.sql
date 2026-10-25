-- Read-only checks; all values must be true.
SELECT
 NOT has_table_privilege('authenticated','public.academy_student_documents','UPDATE') AS direct_patch_blocked,
 NOT has_table_privilege('anon','public.academy_student_documents','UPDATE') AS anonymous_patch_blocked,
 has_function_privilege('authenticated','public.academy_review_student_document(uuid,text,text)','EXECUTE') AS rpc_available,
 NOT has_function_privilege('anon','public.academy_review_student_document(uuid,text,text)','EXECUTE') AS anonymous_rpc_blocked,
 NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='academy_student_documents' AND cmd='UPDATE') AS no_direct_update_policy,
 position('academy_audit_log' in pg_get_functiondef('public.academy_review_student_document(uuid,text,text)'::regprocedure))>0 AS audit_present,
 position('archived_at IS NULL' in pg_get_functiondef('public.academy_review_student_document(uuid,text,text)'::regprocedure))>0 AS archive_guard_present;
