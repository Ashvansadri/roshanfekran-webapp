-- Rollback of the academy_update_payment function only; preserves all payment rows.
-- This restores the previous behavior and should be used only if an operational regression is confirmed.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_update_payment(
 p_payment_id uuid, p_amount bigint, p_method text,
 p_reference_no text, p_note text, p_paid_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.academy_payments%rowtype;
BEGIN
 IF NOT public.academy_role_allowed(array['owner','manager','finance']) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
 UPDATE public.academy_payments
 SET amount=p_amount,method=p_method,reference_no=nullif(trim(p_reference_no),''),
     note=nullif(trim(p_note),''),paid_at=coalesce(p_paid_at,paid_at)
 WHERE id=p_payment_id AND status='posted' RETURNING * INTO r;
 IF r.id IS NULL THEN RAISE EXCEPTION 'posted payment not found'; END IF;
 RETURN to_jsonb(r);
END $function$;
COMMIT;
