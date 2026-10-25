-- Compatibility rollback of RPC body only. Unsafe direct table UPDATE stays revoked.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_review_student_document(p_document_id uuid,p_status text,p_review_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
DECLARE v_role text;
BEGIN
 SELECT role INTO v_role FROM public.academy_staff WHERE user_id=(SELECT auth.uid()) AND active=true AND archived_at IS NULL;
 IF coalesce(v_role,'') NOT IN ('owner','manager','registrar') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_status NOT IN ('approved','rejected','pending') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.academy_student_documents
 SET status=p_status,review_note=nullif(btrim(coalesce(p_review_note,'')),''),
 reviewed_by=(SELECT auth.uid()),reviewed_at=CASE WHEN p_status='pending' THEN NULL ELSE now() END
 WHERE id=p_document_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
 RETURN jsonb_build_object('ok',true);
END;
$function$;
COMMIT;
