-- Read-only live validation: all 13 function bodies must contain the scoped archive guard.
DO $verify$
DECLARE missing text;
BEGIN
 SELECT string_agg(v.schema_name||'.'||v.function_name, ', ' ORDER BY v.function_name) INTO missing
 FROM (VALUES
 ('private','academy_teacher_has_course','st.archived_at is null'),
 ('public','academy_delete_quiz_question','archived_at is null'),
 ('public','academy_finalize_course_completion','archived_at is null'),
 ('public','academy_grade_assignment','active_teacher.archived_at is null'),
 ('public','academy_inspection_snapshot','archived_at is null'),
 ('public','academy_quiz_editor','archived_at is null'),
 ('public','academy_set_assessment_score','archived_at is null'),
 ('public','academy_set_rubric_score','archived_at is null'),
 ('public','academy_set_skill_level','archived_at is null'),
 ('public','academy_submit_payment','s.archived_at is null'),
 ('public','academy_update_registration_link','archived_at is null'),
 ('public','academy_upsert_course_public_link','archived_at is null'),
 ('public','academy_upsert_quiz_question','archived_at is null')
 ) v(schema_name,function_name,guard)
 LEFT JOIN pg_namespace n ON n.nspname=v.schema_name
 LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=v.function_name
 WHERE p.oid IS NULL OR position(v.guard in lower(pg_get_functiondef(p.oid)))=0;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Archive guard missing in: %',missing; END IF;
END $verify$;
SELECT 'PASS' AS status, 13 AS checked_functions;
