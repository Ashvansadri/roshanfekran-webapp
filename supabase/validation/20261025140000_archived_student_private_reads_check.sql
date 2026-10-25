-- Read-only verification of all eight active-student read boundaries.
DO $rf_verify$
DECLARE x record; c integer;
BEGIN
 FOR x IN SELECT * FROM (VALUES
 ('academy_assessment_scores','academy_scores_read'),
 ('academy_assignment_submissions','academy_submissions_read'),
 ('academy_student_skill_scores','academy_skill_scores_read'),
 ('academy_showcase_profiles','academy_showcase_profiles_read'),
 ('academy_showcase_works','academy_showcase_works_read'),
 ('academy_showcase_quiz_attempts','academy_showcase_quiz_read'),
 ('academy_mission_submissions','mission_submissions_read'),
 ('academy_student_rewards','academy_rewards_read')
 ) AS expected(tab,policy) LOOP
  SELECT count(*) INTO c FROM pg_policies
  WHERE schemaname='public' AND tablename=x.tab AND policyname=x.policy
    AND position('private.academy_current_student_id' in qual)>0;
  IF c<>1 THEN RAISE EXCEPTION 'Student read guard missing: %.%',x.tab,x.policy; END IF;
 END LOOP;
 FOR x IN SELECT * FROM (VALUES
 ('academy_showcase_profiles','academy_showcase_profiles_read'),
 ('academy_showcase_works','academy_showcase_works_read'),
 ('academy_showcase_quiz_attempts','academy_showcase_quiz_read'),
 ('academy_mission_submissions','mission_submissions_read')
 ) AS expected(tab,policy) LOOP
  SELECT count(*) INTO c FROM pg_policies
  WHERE schemaname='public' AND tablename=x.tab AND policyname=x.policy
    AND position('private.academy_guardian_can_view_active_student' in qual)>0;
  IF c<>1 THEN RAISE EXCEPTION 'Guardian archive guard missing: %.%',x.tab,x.policy; END IF;
 END LOOP;
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private' AND p.proname='academy_guardian_can_view_active_student'
    AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND position('archived_at IS NULL' in pg_get_functiondef(p.oid))>0
 ) THEN RAISE EXCEPTION 'Guardian helper not safely deployed'; END IF;
END $rf_verify$;
