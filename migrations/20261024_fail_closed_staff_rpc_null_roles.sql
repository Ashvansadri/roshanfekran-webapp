-- 2026-10-24: prevent SQL NULL three-valued-logic authorization bypass.
-- A missing/inactive staff role is NULL. "IF v_role NOT IN (...)" and
-- "IF v_role <> 'teacher'" both evaluate to NULL and fail OPEN in PL/pgSQL.
-- Fail closed for these 18 existing SECURITY DEFINER functions without
-- changing function signatures, grants, allowed roles, data, or Floot routes.
-- Each expected guard must appear exactly once; otherwise abort atomically.
BEGIN;
DO $migration$
DECLARE
  v_name text;
  v_oid oid;
  v_original text;
  v_updated text;
  v_pattern text;
  v_matches integer;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['academy_archive_staff','academy_build_automation_queue','academy_complete_automation_job','academy_convert_lead','academy_create_self_registration_link','academy_inspection_snapshot','academy_list_staff_directory','academy_list_student_risk','academy_remove_learning_item','academy_reply_service_request','academy_review_payment','academy_review_registration_request','academy_review_self_registration','academy_review_student_document','academy_set_course_payment_options','academy_teacher_workspace_core','academy_update_registration_link','academy_upsert_course_public_link'] LOOP
    SELECT p.oid INTO STRICT v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_name
      AND p.prosecdef AND pg_function_is_visible(p.oid);
    v_original := pg_get_functiondef(v_oid);
    IF v_name = 'academy_archive_staff' THEN
      v_pattern := 'if v_caller <> ''owner'' then';
      IF (length(v_original)-length(replace(v_original,v_pattern,''))) / length(v_pattern) <> 1 THEN
        RAISE EXCEPTION 'Unexpected authorization guard in %',v_name;
      END IF;
      v_updated := replace(v_original,v_pattern,'if v_caller is distinct from ''owner'' then');
    ELSIF v_name = 'academy_teacher_workspace_core' THEN
      v_pattern := 'if v_role <> ''teacher'' then';
      IF (length(v_original)-length(replace(v_original,v_pattern,''))) / length(v_pattern) <> 1 THEN
        RAISE EXCEPTION 'Unexpected authorization guard in %',v_name;
      END IF;
      v_updated := replace(v_original,v_pattern,'if v_role is distinct from ''teacher'' then');
    ELSE
      v_pattern := 'if[[:space:]]+v_role[[:space:]]+not[[:space:]]+in[[:space:]]*[(]';
      SELECT count(*) INTO v_matches FROM regexp_matches(v_original,v_pattern,'gi');
      IF v_matches <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one role NOT IN guard in %, found %',v_name,v_matches;
      END IF;
      v_updated := regexp_replace(v_original,v_pattern,
        'if coalesce(v_role, '''') not in (','i');
    END IF;
    IF v_updated = v_original THEN RAISE EXCEPTION 'No change in %',v_name; END IF;
    EXECUTE v_updated;
  END LOOP;
END
$migration$;
COMMIT;
