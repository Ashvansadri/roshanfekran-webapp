-- EMERGENCY ONLY: restores the pre-hardening privileges and their grade-tampering risk.
-- Prefer fixing the RPC callers instead of running this rollback.
BEGIN;
GRANT INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES
 ON TABLE public.academy_assignment_submissions TO authenticated;
GRANT TRUNCATE, TRIGGER, REFERENCES
 ON TABLE public.academy_assignment_submissions TO anon;
CREATE POLICY academy_submissions_insert ON public.academy_assignment_submissions
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.academy_students st
    WHERE st.id=student_id AND st.user_id=(SELECT auth.uid()))
 );
CREATE POLICY academy_submissions_update ON public.academy_assignment_submissions
 FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.academy_students st
    WHERE st.id=student_id AND st.user_id=(SELECT auth.uid()))
  OR public.academy_role_allowed(ARRAY['owner','manager'])
  OR EXISTS (SELECT 1 FROM public.academy_assignments a
    WHERE a.id=assignment_id AND private.academy_teacher_has_course(a.course_id))
 ) WITH CHECK (true);
COMMIT;
