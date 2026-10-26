-- Harden student service-request intake: authenticated, student-scoped, bounded and audited.
-- No existing student, finance or service-request records are changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_submit_service_request(
 p_category text, p_subject text, p_body text, p_enrollment_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, private
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_student uuid;
 v_id uuid;
 v_subject text := btrim(coalesce(p_subject,''));
 v_body text := btrim(coalesce(p_body,''));
BEGIN
 v_student := private.academy_current_student_id();
 IF v_actor IS NULL OR v_student IS NULL THEN
  RAISE EXCEPTION 'Student portal access required' USING ERRCODE='42501';
 END IF;
 IF p_category IS NULL OR p_category NOT IN ('financial','certificate','schedule','absence','documents','other') THEN
  RAISE EXCEPTION 'Invalid request category' USING ERRCODE='22023';
 END IF;
 IF char_length(v_subject) NOT BETWEEN 3 AND 120 THEN
  RAISE EXCEPTION 'Subject must contain 3 to 120 characters' USING ERRCODE='22023';
 END IF;
 IF char_length(v_body) NOT BETWEEN 3 AND 1200 THEN
  RAISE EXCEPTION 'Request body must contain 3 to 1200 characters' USING ERRCODE='22023';
 END IF;
 IF p_enrollment_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.academy_enrollments e
  WHERE e.id=p_enrollment_id AND e.student_id=v_student
 ) THEN
  RAISE EXCEPTION 'Enrollment not found' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.academy_student_requests(student_id,enrollment_id,category,subject,body)
 VALUES(v_student,p_enrollment_id,p_category,v_subject,v_body)
 RETURNING id INTO v_id;
 -- Audit metadata only; never duplicate private request text in audit logs.
 INSERT INTO public.academy_audit_log(actor_id,entity_type,entity_id,action,before_data,after_data)
 VALUES(v_actor,'student_request',v_id::text,'submit_service_request',NULL,
  jsonb_build_object('category',p_category,'has_enrollment',p_enrollment_id IS NOT NULL));
 RETURN jsonb_build_object('ok',true,'id',v_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.academy_submit_service_request(text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_submit_service_request(text,text,text,uuid) TO authenticated;
COMMIT;
