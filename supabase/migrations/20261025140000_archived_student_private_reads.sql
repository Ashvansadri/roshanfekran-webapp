-- 2026-10-25 | Shared backend: archived-student private read boundary.
-- Only RLS predicates and a private, scoped guardian helper change. No row changes.
-- Staff/teacher historical access stays unchanged; active student and guardian access stays scoped.
-- Companion rollback and structural verification live in supabase/rollback and supabase/validation.
BEGIN;
DO $rf_preflight$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND (
 (tablename='academy_assessment_scores' AND policyname='academy_scores_read') OR
 (tablename='academy_assignment_submissions' AND policyname='academy_submissions_read') OR
 (tablename='academy_student_skill_scores' AND policyname='academy_skill_scores_read') OR
 (tablename='academy_showcase_profiles' AND policyname='academy_showcase_profiles_read') OR
 (tablename='academy_showcase_works' AND policyname='academy_showcase_works_read') OR
 (tablename='academy_showcase_quiz_attempts' AND policyname='academy_showcase_quiz_read') OR
 (tablename='academy_mission_submissions' AND policyname='mission_submissions_read') OR
 (tablename='academy_student_rewards' AND policyname='academy_rewards_read')
 );
 IF n<>8 THEN RAISE EXCEPTION 'Expected 8 RLS policies, found %',n; END IF;
 IF to_regprocedure('private.academy_current_student_id()') IS NULL THEN
   RAISE EXCEPTION 'Missing active-student scope helper';
 END IF;
 IF to_regprocedure('private.academy_guardian_can_view_active_student(uuid)') IS NOT NULL THEN
   RAISE EXCEPTION 'Guardian scope helper already exists; review migration drift';
 END IF;
END $rf_preflight$;
CREATE OR REPLACE FUNCTION private.academy_guardian_can_view_active_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $rf_guard$
 SELECT EXISTS(
  SELECT 1 FROM public.academy_guardian_students gs
  JOIN public.academy_guardians g ON g.id=gs.guardian_id
  JOIN public.academy_students s ON s.id=gs.student_id
  WHERE gs.student_id=p_student_id
    AND g.user_id=(SELECT auth.uid())
    AND g.active=true AND gs.can_view_academic=true
    AND s.archived_at IS NULL AND s.status IS DISTINCT FROM 'archived'
 );
$rf_guard$;
REVOKE ALL ON FUNCTION private.academy_guardian_can_view_active_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.academy_guardian_can_view_active_student(uuid) TO authenticated;
ALTER POLICY academy_scores_read ON public.academy_assessment_scores USING (
 academy_assessment_scores.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager','registrar']) OR EXISTS (SELECT 1 FROM public.academy_assessments a WHERE a.id=academy_assessment_scores.assessment_id AND private.academy_teacher_has_course(a.course_id))
);

ALTER POLICY academy_submissions_read ON public.academy_assignment_submissions USING (
 academy_assignment_submissions.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager','registrar']) OR EXISTS (SELECT 1 FROM public.academy_assignments a WHERE a.id=academy_assignment_submissions.assignment_id AND private.academy_teacher_has_course(a.course_id))
);

ALTER POLICY academy_skill_scores_read ON public.academy_student_skill_scores USING (
 academy_student_skill_scores.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager','registrar']) OR EXISTS (SELECT 1 FROM public.academy_course_skills sk WHERE sk.id=academy_student_skill_scores.skill_id AND private.academy_teacher_has_course(sk.course_id))
);

ALTER POLICY academy_showcase_profiles_read ON public.academy_showcase_profiles USING (
 academy_showcase_profiles.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager']) OR private.academy_guardian_can_view_active_student(academy_showcase_profiles.student_id)
);

ALTER POLICY academy_showcase_works_read ON public.academy_showcase_works USING (
 academy_showcase_works.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager']) OR private.academy_guardian_can_view_active_student(academy_showcase_works.student_id)
);

ALTER POLICY academy_showcase_quiz_read ON public.academy_showcase_quiz_attempts USING (
 academy_showcase_quiz_attempts.student_id = private.academy_current_student_id() OR public.academy_role_allowed(ARRAY['owner','manager']) OR private.academy_guardian_can_view_active_student(academy_showcase_quiz_attempts.student_id)
);

ALTER POLICY mission_submissions_read ON public.academy_mission_submissions USING (
 public.academy_role_allowed(ARRAY['owner','manager','registrar']) OR academy_mission_submissions.student_id = private.academy_current_student_id() OR private.academy_guardian_can_view_active_student(academy_mission_submissions.student_id)
);

ALTER POLICY academy_rewards_read ON public.academy_student_rewards USING (
 public.academy_is_management() OR academy_student_rewards.student_id = private.academy_current_student_id()
);
COMMIT;
