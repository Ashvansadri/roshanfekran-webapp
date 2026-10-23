-- Roshanfekran RLS hardening: role "viewer" is course-only in the independent portal.
-- Existing owner, finance, manager, registrar, teacher and student scopes are preserved.
-- No rows, accounts, passwords, enrollment or financial data are changed.
-- This migration intentionally excludes academy_courses so viewer retains course read access.
-- Snapshot of original definitions: see matching .rollback.sql; rollback only after security review.
-- Guard: at audit time only owner/finance accounts were active.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.academy_staff WHERE active AND role IN ('viewer','registrar')) THEN
    RAISE EXCEPTION 'Policy migration requires manual review: an active viewer/registrar account exists';
  END IF;
END $$;
ALTER POLICY "academy_scores_read" ON "public"."academy_assessment_scores" USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_assessment_scores.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_assessments a
  WHERE ((a.id = academy_assessment_scores.assessment_id) AND private.academy_teacher_has_course(a.course_id))))));
ALTER POLICY "academy_assessments_read" ON "public"."academy_assessments" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR (published AND (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_assessments.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text]))))))));
ALTER POLICY "academy_rubric_criteria_read" ON "public"."academy_assignment_rubric_criteria" USING ((EXISTS ( SELECT 1
   FROM academy_assignments a
  WHERE ((a.id = academy_assignment_rubric_criteria.assignment_id) AND (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(a.course_id) OR (a.published AND (EXISTS ( SELECT 1
           FROM (academy_students st
             JOIN academy_enrollments e ON ((e.student_id = st.id)))
          WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = a.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text])))))))))));
ALTER POLICY "academy_submissions_read" ON "public"."academy_assignment_submissions" USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_assignment_submissions.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_assignments a
  WHERE ((a.id = academy_assignment_submissions.assignment_id) AND private.academy_teacher_has_course(a.course_id))))));
ALTER POLICY "academy_assignments_read" ON "public"."academy_assignments" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR ((published = true) AND (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_assignments.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text]))))))));
ALTER POLICY "academy_attendance_read" ON "public"."academy_attendance" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_auto_jobs_staff" ON "public"."academy_automation_jobs" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text, 'finance'::text]));
ALTER POLICY "academy_auto_rules_staff" ON "public"."academy_automation_rules" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text]));
ALTER POLICY "academy_certificates_read" ON "public"."academy_certificates" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_classes_read" ON "public"."academy_classes" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text]));
ALTER POLICY "academy_comm_log_staff" ON "public"."academy_communication_log" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text, 'finance'::text]));
ALTER POLICY "academy_comm_templates_staff" ON "public"."academy_communication_templates" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text, 'finance'::text]));
ALTER POLICY "academy_course_announcements_read" ON "public"."academy_course_announcements" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR (published AND (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_course_announcements.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text]))))))));
ALTER POLICY "academy_modules_read" ON "public"."academy_course_modules" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR (published AND (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_course_modules.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text]))))))));
ALTER POLICY "academy_course_public_links_staff_read" ON "public"."academy_course_public_links" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text, 'finance'::text]));
ALTER POLICY "academy_skills_read" ON "public"."academy_course_skills" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_course_skills.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text])))))));
ALTER POLICY "academy_departments_read" ON "public"."academy_departments" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text, 'teacher'::text]));
ALTER POLICY "academy_document_requirements_read" ON "public"."academy_document_requirements" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text, 'teacher'::text]) OR (private.academy_current_student_id() IS NOT NULL)));
ALTER POLICY "academy_documents_read" ON "public"."academy_documents" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_enrollments_read" ON "public"."academy_enrollments" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text]));
ALTER POLICY "academy_equipment_read" ON "public"."academy_equipment" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_expenses_read" ON "public"."academy_expenses" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text]));
ALTER POLICY "academy_followups_read" ON "public"."academy_followups" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text]));
ALTER POLICY "academy_guardian_students_read" ON "public"."academy_guardian_students" USING (((EXISTS ( SELECT 1
   FROM academy_guardians g
  WHERE ((g.id = academy_guardian_students.guardian_id) AND (g.user_id = ( SELECT auth.uid() AS uid)) AND (g.active = true)))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text])));
ALTER POLICY "academy_guardians_read" ON "public"."academy_guardians" USING (((user_id = ( SELECT auth.uid() AS uid)) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text])));
ALTER POLICY "academy_inspection_checklist_read" ON "public"."academy_inspection_checklist" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_installments_read" ON "public"."academy_installments" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text]));
ALTER POLICY "academy_leads_staff" ON "public"."academy_leads" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_materials_read" ON "public"."academy_learning_materials" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR private.academy_teacher_has_course(course_id) OR (published AND (EXISTS ( SELECT 1
   FROM (academy_students st
     JOIN academy_enrollments e ON ((e.student_id = st.id)))
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND (e.course_id = academy_learning_materials.course_id) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text]))))))));
ALTER POLICY "academy_learning_progress_read" ON "public"."academy_learning_progress" USING (((student_id = private.academy_current_student_id()) OR private.academy_teacher_has_course(course_id) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text])));
ALTER POLICY "mission_campaigns_read" ON "public"."academy_mission_campaigns" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM (academy_enrollments e
     JOIN academy_students s ON ((s.id = e.student_id)))
  WHERE ((e.course_id = academy_mission_campaigns.course_id) AND (s.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = ANY (ARRAY['active'::text, 'completed'::text])) AND academy_mission_campaigns.active))) OR (EXISTS ( SELECT 1
   FROM ((academy_guardian_students gs
     JOIN academy_guardians g ON ((g.id = gs.guardian_id)))
     JOIN academy_enrollments e ON ((e.student_id = gs.student_id)))
  WHERE ((e.course_id = academy_mission_campaigns.course_id) AND (g.user_id = ( SELECT auth.uid() AS uid)) AND g.active AND gs.can_view_academic AND (e.status = ANY (ARRAY['active'::text, 'completed'::text])) AND academy_mission_campaigns.active)))));
ALTER POLICY "mission_submissions_read" ON "public"."academy_mission_submissions" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_students s
  WHERE ((s.id = academy_mission_submissions.student_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (academy_guardian_students gs
     JOIN academy_guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = academy_mission_submissions.student_id) AND (g.user_id = ( SELECT auth.uid() AS uid)) AND g.active AND gs.can_view_academic)))));
ALTER POLICY "academy_alloc_read" ON "public"."academy_payment_allocations" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text]));
ALTER POLICY "academy_payments_read" ON "public"."academy_payments" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text]));
ALTER POLICY "academy_registration_requests_staff_read" ON "public"."academy_registration_requests" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text, 'finance'::text]));
ALTER POLICY "academy_self_reg_links_staff_read" ON "public"."academy_self_registration_links" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_self_reg_requests_staff_read" ON "public"."academy_self_registration_requests" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (user_id = ( SELECT auth.uid() AS uid))));
ALTER POLICY "academy_settings_read" ON "public"."academy_settings" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text, 'teacher'::text]));
ALTER POLICY "academy_staff_contracts_read" ON "public"."academy_staff_contracts" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text]));
ALTER POLICY "academy_staff_credential_items_read" ON "public"."academy_staff_credential_items" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]));
ALTER POLICY "academy_skill_scores_read" ON "public"."academy_student_skill_scores" USING (((EXISTS ( SELECT 1
   FROM academy_students st
  WHERE ((st.id = academy_student_skill_scores.student_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR (EXISTS ( SELECT 1
   FROM academy_course_skills sk
  WHERE ((sk.id = academy_student_skill_scores.skill_id) AND private.academy_teacher_has_course(sk.course_id))))));
ALTER POLICY "academy_students_read" ON "public"."academy_students" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text, 'registrar'::text]));
ALTER POLICY "academy_rubric_scores_read" ON "public"."academy_submission_rubric_scores" USING ((EXISTS ( SELECT 1
   FROM (academy_assignment_submissions s
     JOIN academy_assignments a ON ((a.id = s.assignment_id)))
  WHERE ((s.id = academy_submission_rubric_scores.submission_id) AND ((s.student_id = private.academy_current_student_id()) OR private.academy_teacher_has_course(a.course_id) OR academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]))))));
ALTER POLICY "academy_teacher_tasks_read" ON "public"."academy_teacher_course_tasks" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR ((teacher_user_id = ( SELECT auth.uid() AS uid)) AND private.academy_teacher_has_course(course_id))));
ALTER POLICY "academy_payouts_read" ON "public"."academy_teacher_payouts" USING (academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'finance'::text]));
ALTER POLICY "academy_teacher_task_logs_read" ON "public"."academy_teacher_task_logs" USING ((academy_role_allowed(ARRAY['owner'::text, 'manager'::text, 'registrar'::text]) OR ((teacher_user_id = ( SELECT auth.uid() AS uid)) AND private.academy_teacher_has_course(course_id))));
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename <> 'academy_courses'
      AND (coalesce(qual,'') LIKE '%''viewer''::text%' OR coalesce(with_check,'') LIKE '%''viewer''::text%')
  ) THEN RAISE EXCEPTION 'viewer permission remains outside course catalog'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academy_staff_contracts'
      AND policyname='academy_staff_contracts_read' AND qual LIKE '%''registrar''::text%'
  ) THEN RAISE EXCEPTION 'registrar staff contract permission remains'; END IF;
END $$;
