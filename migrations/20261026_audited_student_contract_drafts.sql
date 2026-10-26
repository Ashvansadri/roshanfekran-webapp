-- Controlled, audited creation of draft student contracts.
-- Additive migration: does not modify existing contracts, Floot tables or legacy policies.
CREATE OR REPLACE FUNCTION public.academy_create_student_contract_draft(
  p_student_id uuid,
  p_course_id uuid DEFAULT NULL,
  p_contract_no text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_no text := nullif(btrim(coalesce(p_contract_no,'')),'');
  v_new_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.academy_role_allowed(ARRAY['owner','manager','registrar']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF p_student_id IS NULL OR v_no IS NULL OR char_length(v_no)<4 OR char_length(v_no)>60
     OR v_no ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid student or contract number' USING ERRCODE='22023';
  END IF;
  IF (p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date<p_start_date)
     OR (p_start_date IS NULL AND p_end_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Invalid contract dates' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_students s
    WHERE s.id=p_student_id AND s.archived_at IS NULL AND s.status IS DISTINCT FROM 'archived'
  ) THEN
    RAISE EXCEPTION 'Student record unavailable' USING ERRCODE='42501';
  END IF;
  IF p_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academy_courses c
    WHERE c.id=p_course_id AND c.status IS DISTINCT FROM 'archived'
  ) THEN
    RAISE EXCEPTION 'Course unavailable' USING ERRCODE='42501';
  END IF;
  -- Serialize drafts for this student to avoid double-click/retry duplicates.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text,0));
  IF EXISTS (
    SELECT 1 FROM public.academy_student_contracts c
    WHERE c.student_id=p_student_id AND c.contract_no=v_no
  ) THEN
    RAISE EXCEPTION 'Contract number already exists for this student' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.academy_student_contracts
    (student_id,course_id,contract_no,start_date,end_date,status,delivered_copy,created_by)
  VALUES
    (p_student_id,p_course_id,v_no,p_start_date,p_end_date,'draft',false,v_actor)
  RETURNING id INTO v_new_id;
  INSERT INTO public.academy_audit_log
    (actor_id,entity_type,entity_id,action,before_data,after_data)
  VALUES (
    v_actor,'student_contract',v_new_id::text,'create_student_contract_draft',
    '{}'::jsonb,
    jsonb_build_object('status','draft','student_id',p_student_id,'course_id',p_course_id)
  );
  RETURN jsonb_build_object(
    'ok',true,'id',v_new_id,'status','draft',
    'student_id',p_student_id,'course_id',p_course_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.academy_create_student_contract_draft(uuid,uuid,text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_create_student_contract_draft(uuid,uuid,text,date,date) TO authenticated;
