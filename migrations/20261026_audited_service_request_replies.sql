-- Roshanfekran staging: narrow, audited staff replies to student service requests.
-- Preserves all records and the legacy Floot RPC signature.
-- Old Floot office.tsx calls academy_reply_service_request with these exact arguments.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_reply_service_request(
  p_request_id uuid,
  p_status text,
  p_staff_note text DEFAULT NULL,
  p_priority text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.academy_student_requests%ROWTYPE;
  v_new public.academy_student_requests%ROWTYPE;
  v_note text;
BEGIN
  IF v_actor IS NULL OR NOT public.academy_role_allowed(ARRAY['owner','manager','finance','registrar']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID required' USING ERRCODE='22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023';
  END IF;
  v_note := nullif(btrim(coalesce(p_staff_note,'')),'');
  IF length(v_note) > 4000 THEN
    RAISE EXCEPTION 'Reply exceeds 4000 characters' USING ERRCODE='22023';
  END IF;
  SELECT r.* INTO v_old
  FROM public.academy_student_requests r
  WHERE r.id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.academy_students s
    WHERE s.id=v_old.student_id
      AND s.archived_at IS NULL
      AND s.status IS DISTINCT FROM 'archived'
  ) THEN
    RAISE EXCEPTION 'Student record unavailable' USING ERRCODE='42501';
  END IF;
  UPDATE public.academy_student_requests
  SET status=p_status,
      staff_note=v_note,
      priority=coalesce(p_priority,priority),
      assigned_to=v_actor,
      resolved_at=CASE WHEN p_status IN ('resolved','closed') THEN coalesce(resolved_at,now()) ELSE NULL END
  WHERE id=p_request_id
  RETURNING * INTO v_new;
  INSERT INTO public.academy_audit_log(actor_id,entity_type,entity_id,action,before_data,after_data)
  VALUES (
    v_actor,'student_service_request',p_request_id::text,'reply_service_request',
    jsonb_build_object('status',v_old.status,'priority',v_old.priority,'has_reply',v_old.staff_note IS NOT NULL),
    jsonb_build_object('status',v_new.status,'priority',v_new.priority,'has_reply',v_new.staff_note IS NOT NULL)
  );
  RETURN jsonb_build_object('ok',true,'id',v_new.id,'status',v_new.status,'priority',v_new.priority);
END;
$function$;
-- Browser clients must use the audited RPC. A direct PATCH previously allowed
-- editing student_id, body and timestamps under the broad UPDATE RLS policy.
REVOKE UPDATE ON TABLE public.academy_student_requests FROM authenticated, anon;
DROP POLICY IF EXISTS academy_student_requests_staff_update ON public.academy_student_requests;
REVOKE ALL ON FUNCTION public.academy_reply_service_request(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_reply_service_request(uuid,text,text,text) TO authenticated;
COMMIT;
