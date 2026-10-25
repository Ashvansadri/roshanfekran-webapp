-- Harden the existing Floot-compatible document review RPC; no data changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_review_student_document(
 p_document_id uuid,p_status text,p_review_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_old public.academy_student_documents%ROWTYPE;
 v_new public.academy_student_documents%ROWTYPE;
 v_note text;
BEGIN
 IF v_actor IS NULL OR NOT public.academy_role_allowed(ARRAY['owner','manager','registrar']) THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF p_document_id IS NULL THEN RAISE EXCEPTION 'Document ID required' USING ERRCODE='22023'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('pending','approved','rejected') THEN
  RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
 END IF;
 v_note := nullif(btrim(coalesce(p_review_note,'')),'');
 IF char_length(v_note)>1000 OR (p_status='rejected' AND (v_note IS NULL OR char_length(v_note)<3)) THEN
  RAISE EXCEPTION 'Invalid review note' USING ERRCODE='22023';
 END IF;
 SELECT d.* INTO v_old FROM public.academy_student_documents d WHERE d.id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academy_students s WHERE s.id=v_old.student_id
  AND s.archived_at IS NULL AND s.status IS DISTINCT FROM 'archived') THEN
  RAISE EXCEPTION 'Student record unavailable' USING ERRCODE='42501';
 END IF;
 UPDATE public.academy_student_documents
 SET status=p_status,review_note=v_note,
     reviewed_by=CASE WHEN p_status='pending' THEN NULL ELSE v_actor END,
     reviewed_at=CASE WHEN p_status='pending' THEN NULL ELSE now() END
 WHERE id=p_document_id RETURNING * INTO v_new;
 INSERT INTO public.academy_audit_log(actor_id,entity_type,entity_id,action,before_data,after_data)
 VALUES(v_actor,'student_document',p_document_id::text,'review_student_document',
  jsonb_build_object('status',v_old.status,'has_note',v_old.review_note IS NOT NULL),
  jsonb_build_object('status',v_new.status,'has_note',v_new.review_note IS NOT NULL));
 RETURN jsonb_build_object('ok',true,'id',v_new.id,'status',v_new.status);
END;
$function$;
REVOKE UPDATE ON TABLE public.academy_student_documents FROM authenticated, anon;
DROP POLICY IF EXISTS academy_student_documents_staff_update ON public.academy_student_documents;
REVOKE ALL ON FUNCTION public.academy_review_student_document(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_review_student_document(uuid,text,text) TO authenticated;
COMMIT;
