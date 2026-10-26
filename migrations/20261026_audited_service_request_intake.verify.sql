-- Read-only checks. Every result must be true; no user records are inserted.
SELECT
 NOT has_table_privilege('authenticated','public.academy_student_requests','INSERT') AS direct_insert_blocked,
 NOT has_table_privilege('authenticated','public.academy_student_requests','UPDATE') AS direct_update_blocked,
 NOT has_function_privilege('anon','public.academy_submit_service_request(text,text,text,uuid)','EXECUTE') AS anonymous_rpc_blocked,
 has_function_privilege('authenticated','public.academy_submit_service_request(text,text,text,uuid)','EXECUTE') AS student_rpc_available,
 position('private.academy_current_student_id()' in pg_get_functiondef('public.academy_submit_service_request(text,text,text,uuid)'::regprocedure))>0 AS active_student_guard,
 position('char_length(v_subject) NOT BETWEEN 3 AND 120' in pg_get_functiondef('public.academy_submit_service_request(text,text,text,uuid)'::regprocedure))>0 AS subject_bound,
 position('char_length(v_body) NOT BETWEEN 3 AND 1200' in pg_get_functiondef('public.academy_submit_service_request(text,text,text,uuid)'::regprocedure))>0 AS body_bound,
 position('e.student_id=v_student' in pg_get_functiondef('public.academy_submit_service_request(text,text,text,uuid)'::regprocedure))>0 AS enrollment_ownership_guard,
 position('academy_audit_log' in pg_get_functiondef('public.academy_submit_service_request(text,text,text,uuid)'::regprocedure))>0 AS creation_audit_present;
