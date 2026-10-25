-- Emergency rollback ONLY; restores the former broad update policy and RPC.
-- No application rows are changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_reply_service_request(
  p_request_id uuid, p_status text, p_staff_note text DEFAULT NULL, p_priority text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.academy_staff
    WHERE user_id=(SELECT auth.uid()) AND active=true AND archived_at IS NULL;
  IF coalesce(v_role,'') NOT IN ('owner','manager','finance','registrar') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
  UPDATE public.academy_student_requests
  SET status=p_status, staff_note=nullif(btrim(coalesce(p_staff_note,'')),''),
      priority=coalesce(p_priority,priority), assigned_to=(SELECT auth.uid()),
      resolved_at=CASE WHEN p_status IN ('resolved','closed') THEN coalesce(resolved_at,now()) ELSE NULL END
  WHERE id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  RETURN jsonb_build_object('ok',true);
END;
$function$;
GRANT UPDATE ON TABLE public.academy_student_requests TO authenticated;
CREATE POLICY academy_student_requests_staff_update ON public.academy_student_requests
  FOR UPDATE TO authenticated
  USING (public.academy_role_allowed(ARRAY['owner','manager','finance','registrar']))
  WITH CHECK (public.academy_role_allowed(ARRAY['owner','manager','finance','registrar']));
REVOKE ALL ON FUNCTION public.academy_reply_service_request(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.academy_reply_service_request(uuid,text,text,text) TO authenticated;
COMMIT;
