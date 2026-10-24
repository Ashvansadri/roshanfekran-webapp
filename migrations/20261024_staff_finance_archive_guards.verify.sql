-- Read-only check; all 20 caller guards must reject archived staff.
DO $guard_check$
DECLARE v_missing text;
BEGIN
 SELECT string_agg(proname, ', ' ORDER BY proname) INTO v_missing FROM (
  SELECT p.proname, lower(pg_get_functiondef(p.oid)) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname = ANY(ARRAY['academy_archive_staff','academy_convert_lead','academy_create_self_registration_link','academy_grade_assignment','academy_invite_staff','academy_list_staff','academy_list_staff_directory','academy_list_student_risk','academy_purge_staff_data','academy_reply_service_request','academy_review_payment','academy_review_registration_request','academy_review_self_registration','academy_review_student_document','academy_set_course_payment_options','academy_set_staff_active','academy_staff_purge_preview','academy_void_expense','academy_void_payment','academy_void_teacher_payout'])
 ) AS f WHERE definition NOT LIKE '%active=true and archived_at is null%'
               AND definition NOT LIKE '%s.active=true and s.archived_at is null%';
 IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Archived staff guard missing: %', v_missing; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname = ANY(ARRAY['academy_archive_staff','academy_convert_lead','academy_create_self_registration_link','academy_grade_assignment','academy_invite_staff','academy_list_staff','academy_list_staff_directory','academy_list_student_risk','academy_purge_staff_data','academy_reply_service_request','academy_review_payment','academy_review_registration_request','academy_review_self_registration','academy_review_student_document','academy_set_course_payment_options','academy_set_staff_active','academy_staff_purge_preview','academy_void_expense','academy_void_payment','academy_void_teacher_payout'])) <> 20
 THEN RAISE EXCEPTION 'One or more guarded functions missing'; END IF;
END $guard_check$;
SELECT count(*) AS guarded_functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname = ANY(ARRAY['academy_archive_staff','academy_convert_lead','academy_create_self_registration_link','academy_grade_assignment','academy_invite_staff','academy_list_staff','academy_list_staff_directory','academy_list_student_risk','academy_purge_staff_data','academy_reply_service_request','academy_review_payment','academy_review_registration_request','academy_review_self_registration','academy_review_student_document','academy_set_course_payment_options','academy_set_staff_active','academy_staff_purge_preview','academy_void_expense','academy_void_payment','academy_void_teacher_payout']);
