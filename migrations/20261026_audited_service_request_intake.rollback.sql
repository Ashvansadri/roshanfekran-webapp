-- Emergency rollback to the prior Floot-compatible request intake.
-- Use only after investigating any regression; removes the new input caps and creation audit.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_submit_service_request(
 p_category text, p_subject text, p_body text, p_enrollment_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'auth', 'private'
AS $function$
declare v_student uuid; v_id uuid;
begin
 v_student := private.academy_current_student_id();
 if v_student is null then raise exception 'Student portal access required'; end if;
 if p_category not in ('financial','certificate','schedule','absence','documents','other') then raise exception 'Invalid request category'; end if;
 if length(btrim(coalesce(p_subject,''))) < 3 then raise exception 'Subject required'; end if;
 if length(btrim(coalesce(p_body,''))) < 3 then raise exception 'Request body required'; end if;
 if p_enrollment_id is not null and not exists(
  select 1 from public.academy_enrollments e where e.id=p_enrollment_id and e.student_id=v_student
 ) then raise exception 'Enrollment not found'; end if;
 insert into public.academy_student_requests(student_id,enrollment_id,category,subject,body)
 values(v_student,p_enrollment_id,p_category,btrim(p_subject),btrim(p_body))
 returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id);
end
$function$;
REVOKE ALL ON FUNCTION public.academy_submit_service_request(text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_submit_service_request(text,text,text,uuid) TO authenticated;
COMMIT;
