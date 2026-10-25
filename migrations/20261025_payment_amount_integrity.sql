-- 2026-10-25 | Prevent payment amount edits from bypassing enrollment balance and installment allocations.
-- Existing INSERT is guarded by academy_guard_payment; UPDATE previously had no balance check.
-- Shared Floot/Render database: no payment row or receipt is modified by this migration.
-- Existing overpaid records are NOT silently rewritten. Corrections require authorized review.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_update_payment(
 p_payment_id uuid, p_amount bigint, p_method text,
 p_reference_no text, p_note text, p_paid_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
 r public.academy_payments%rowtype;
 v_enrollment_id uuid;
 v_final_fee bigint;
 v_other_paid bigint;
 v_allocated bigint;
BEGIN
 IF NOT public.academy_role_allowed(array['owner','manager','finance']) THEN
   RAISE EXCEPTION 'not authorized';
 END IF;
 IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

 -- Lock the parent first, matching academy_guard_payment's lock order.
 -- All new posted payments lock this enrollment in their BEFORE INSERT trigger.
 SELECT enrollment_id INTO v_enrollment_id
 FROM public.academy_payments WHERE id=p_payment_id AND status='posted';
 IF v_enrollment_id IS NULL THEN RAISE EXCEPTION 'posted payment not found'; END IF;

 SELECT final_fee INTO v_final_fee FROM public.academy_enrollments
 WHERE id=v_enrollment_id FOR UPDATE;
 IF v_final_fee IS NULL THEN RAISE EXCEPTION 'enrollment not found'; END IF;

 SELECT * INTO r FROM public.academy_payments
 WHERE id=p_payment_id AND enrollment_id=v_enrollment_id AND status='posted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'posted payment not found'; END IF;

 IF p_amount IS DISTINCT FROM r.amount THEN
   SELECT coalesce(sum(amount),0) INTO v_allocated
   FROM public.academy_payment_allocations
   WHERE payment_id=r.id AND status='posted';

   -- Amount edits do not re-run the AFTER INSERT installment allocator.
   -- Void and re-record allocated payments to preserve the ledger and audit trail.
   IF v_allocated > 0 OR r.installment_id IS NOT NULL THEN
     RAISE EXCEPTION 'Allocated payment amount cannot be edited; void and re-record';
   END IF;

   SELECT coalesce(sum(amount),0) INTO v_other_paid
   FROM public.academy_payments
   WHERE enrollment_id=v_enrollment_id AND id<>r.id AND status='posted';

   -- Never permit an increase that worsens an existing overpayment.
   -- Decreases remain possible to correct legacy overpayments without deleting history.
   IF p_amount > r.amount AND p_amount > greatest(v_final_fee-v_other_paid,0) THEN
     RAISE EXCEPTION 'Payment amount exceeds enrollment balance';
   END IF;
 END IF;

 UPDATE public.academy_payments SET
   amount=p_amount,
   method=p_method,
   reference_no=nullif(trim(p_reference_no),''),
   note=nullif(trim(p_note),''),
   paid_at=coalesce(p_paid_at,paid_at)
 WHERE id=p_payment_id AND status='posted'
 RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'posted payment not found'; END IF;
 RETURN to_jsonb(r);
END
$function$;
COMMIT;
