-- Read-only verification for 20261024_fail_closed_staff_rpc_null_roles.sql.
-- Run in a trusted SQL session without a JWT identity. Does not alter table rows.
DO $verify$
DECLARE
  v_total int; v_safe_not_in int; v_safe_distinct int; v_unsafe int;
  v_fn text; v_error text; v_expected text; v_dummy record;
BEGIN
  WITH f AS (
    SELECT p.oid,p.proname,pg_get_functiondef(p.oid) src
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
      'academy_archive_staff','academy_build_automation_queue',
      'academy_complete_automation_job','academy_convert_lead',
      'academy_create_self_registration_link','academy_inspection_snapshot',
      'academy_list_staff_directory','academy_list_student_risk',
      'academy_remove_learning_item','academy_reply_service_request',
      'academy_review_payment','academy_review_registration_request',
      'academy_review_self_registration','academy_review_student_document',
      'academy_set_course_payment_options','academy_teacher_workspace_core',
      'academy_update_registration_link','academy_upsert_course_public_link'
    ])
  )
  SELECT count(*),
    count(*) FILTER (WHERE src ~* 'if[[:space:]]+coalesce[(]v_role,[[:space:]]*''''[)][[:space:]]+not[[:space:]]+in'),
    count(*) FILTER (WHERE src ~* 'if[[:space:]]+v_(role|caller)[[:space:]]+is[[:space:]]+distinct[[:space:]]+from'),
    count(*) FILTER (WHERE src ~* 'if[[:space:]]+v_(role|caller)[[:space:]]+(not[[:space:]]+in|<>)')
  INTO v_total,v_safe_not_in,v_safe_distinct,v_unsafe FROM f;
  IF v_total<>18 OR v_safe_not_in<>16 OR v_safe_distinct<>2 OR v_unsafe<>0 THEN
    RAISE EXCEPTION 'Unexpected RPC role guards: total %, safe NOT IN %, safe DISTINCT %, unsafe %',
      v_total,v_safe_not_in,v_safe_distinct,v_unsafe;
  END IF;
  IF (select auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Negative tests require a session without JWT identity';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY[
    'academy_inspection_snapshot','academy_list_staff_directory',
    'academy_list_student_risk','academy_teacher_workspace_core'
  ] LOOP
    v_expected := CASE WHEN v_fn='academy_teacher_workspace_core'
      THEN 'Teacher access required' ELSE 'Not authorized' END;
    BEGIN
      EXECUTE format('SELECT * FROM public.%I()',v_fn) INTO v_dummy;
      RAISE EXCEPTION 'UNEXPECTED_ALLOW';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      IF v_error IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'Negative test failed for %: %',v_fn,v_error;
      END IF;
    END;
  END LOOP;
END
$verify$;
-- Positive tests require consented authenticated accounts; this script does not impersonate users.
