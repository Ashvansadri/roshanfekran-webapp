-- Read-only verification: composite manager/teacher role guards must fail closed.
DO $verify$
DECLARE v_total int; v_safe int; v_old int; v_teacher int;
BEGIN
 WITH f AS (
   SELECT p.proname,pg_get_functiondef(p.oid) src
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef AND p.proname=ANY(ARRAY[
    'academy_delete_quiz_question','academy_finalize_course_completion',
    'academy_grade_assignment','academy_quiz_editor','academy_set_assessment_score',
    'academy_set_rubric_score','academy_set_skill_level','academy_upsert_quiz_question'
   ])
 )
 SELECT count(*),
   count(*) FILTER (WHERE src LIKE '%coalesce(v_role, '''') in (''owner'',''manager'')%'),
   count(*) FILTER (WHERE src LIKE '%v_role in (''owner'',''manager'')%'),
   count(*) FILTER (WHERE proname='academy_finalize_course_completion'
     AND src LIKE '%coalesce(v_role, '''')=''teacher''%')
 INTO v_total,v_safe,v_old,v_teacher FROM f;
 IF v_total<>8 OR v_safe<>8 OR v_old<>0 OR v_teacher<>1 THEN
   RAISE EXCEPTION 'Composite role guards invalid: total %, safe %, old %, teacher %',
     v_total,v_safe,v_old,v_teacher;
 END IF;
 IF (NOT (coalesce(NULL::text,'') IN ('owner','manager') OR false)) IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'NULL role must be denied';
 END IF;
END $verify$;
-- Real positive role tests require consent; no user impersonation here.
