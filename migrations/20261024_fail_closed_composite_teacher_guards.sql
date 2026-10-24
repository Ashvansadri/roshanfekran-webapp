-- 2026-10-24: close the second NULL-role bypass class in eight privileged
-- teacher/manager RPCs. In PL/pgSQL, IF NOT (NULL OR FALSE) is not TRUE,
-- so a missing staff role could pass authorization when no teacher match.
-- Preserve all existing authorized owner/manager and teacher flows.
BEGIN;
DO $migration$
DECLARE
 v_name text; v_oid oid; v_def text; v_new text;
 v_old text := 'v_role in (''owner'',''manager'')';
 v_safe text := 'coalesce(v_role, '''') in (''owner'',''manager'')';
 v_teacher_old text := 'v_role=''teacher''';
 v_teacher_safe text := 'coalesce(v_role, '''')=''teacher''';
BEGIN
 FOREACH v_name IN ARRAY ARRAY['academy_delete_quiz_question','academy_finalize_course_completion','academy_grade_assignment','academy_quiz_editor','academy_set_assessment_score','academy_set_rubric_score','academy_set_skill_level','academy_upsert_quiz_question'] LOOP
   SELECT p.oid INTO STRICT v_oid FROM pg_proc p
   JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=v_name AND p.prosecdef;
   v_def := pg_get_functiondef(v_oid);
   IF (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old) <> 1
      OR position('if not (' IN lower(v_def)) = 0 THEN
     RAISE EXCEPTION 'Unexpected role/teacher guard in %',v_name;
   END IF;
   v_new := replace(v_def,v_old,v_safe);
   IF v_name='academy_finalize_course_completion' THEN
     IF (length(v_new)-length(replace(v_new,v_teacher_old,'')))/length(v_teacher_old) <> 1 THEN
       RAISE EXCEPTION 'Unexpected teacher guard in %',v_name;
     END IF;
     v_new := replace(v_new,v_teacher_old,v_teacher_safe);
   END IF;
   EXECUTE v_new;
 END LOOP;
END $migration$;
COMMIT;
