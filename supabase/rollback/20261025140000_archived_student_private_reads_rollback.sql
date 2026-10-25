-- EMERGENCY ROLLBACK ONLY: restores previous (weaker) student/guardian read policies.
-- Do not run routinely; keep archived-account protection unless an incident requires it.
BEGIN;
ALTER POLICY academy_scores_read ON public.academy_assessment_scores USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_assessment_scores.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_assessments a
  WHERE ((a.id = academy_assessment_scores.assessment_id) AND private.academy_teacher_has_course(a.course_id))))));

ALTER POLICY academy_submissions_read ON public.academy_assignment_submissions USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_assignment_submissions.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_assignments a
  WHERE ((a.id = academy_assignment_submissions.assignment_id) AND private.academy_teacher_has_course(a.course_id))))));

ALTER POLICY mission_submissions_read ON public.academy_mission_submissions USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_students s
  WHERE ((s.id = academy_mission_submissions.student_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (academy_guardian_students gs
     JOIN academy_guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = academy_mission_submissions.student_id) AND (g.user_id = ( SELECT auth.uid() AS uid)) AND g.active AND gs.can_view_academic)))));

ALTER POLICY academy_showcase_profiles_read ON public.academy_showcase_profiles USING (((EXISTS ( SELECT 1
   FROM academy_students s
  WHERE ((s.id = academy_showcase_profiles.student_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text]) OR (EXISTS ( SELECT 1
   FROM (academy_guardians g
     JOIN academy_guardian_students gs ON ((gs.guardian_id = g.id)))
  WHERE ((gs.student_id = academy_showcase_profiles.student_id) AND (gs.can_view_academic = true) AND (g.active = true) AND (g.user_id = ( SELECT auth.uid() AS uid)))))));

ALTER POLICY academy_showcase_quiz_read ON public.academy_showcase_quiz_attempts USING (((EXISTS ( SELECT 1
   FROM academy_students s
  WHERE ((s.id = academy_showcase_quiz_attempts.student_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text]) OR (EXISTS ( SELECT 1
   FROM (academy_guardians g
     JOIN academy_guardian_students gs ON ((gs.guardian_id = g.id)))
  WHERE ((gs.student_id = academy_showcase_quiz_attempts.student_id) AND (gs.can_view_academic = true) AND (g.active = true) AND (g.user_id = ( SELECT auth.uid() AS uid)))))));

ALTER POLICY academy_showcase_works_read ON public.academy_showcase_works USING (((EXISTS ( SELECT 1
   FROM academy_students s
  WHERE ((s.id = academy_showcase_works.student_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text]) OR (EXISTS ( SELECT 1
   FROM (academy_guardians g
     JOIN academy_guardian_students gs ON ((gs.guardian_id = g.id)))
  WHERE ((gs.student_id = academy_showcase_works.student_id) AND (gs.can_view_academic = true) AND (g.active = true) AND (g.user_id = ( SELECT auth.uid() AS uid)))))));

ALTER POLICY academy_rewards_read ON public.academy_student_rewards USING ((academy_is_management() OR (EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_student_rewards.student_id) AND (st.user_id = auth.uid()))))));

ALTER POLICY academy_skill_scores_read ON public.academy_student_skill_scores USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_student_skill_scores.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_course_skills sk
  WHERE ((sk.id = academy_student_skill_scores.skill_id) AND private.academy_teacher_has_course(sk.course_id))))));
DROP FUNCTION IF EXISTS private.academy_guardian_can_view_active_student(uuid);
COMMIT;
