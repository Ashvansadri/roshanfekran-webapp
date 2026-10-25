-- Read-only verification. Does not edit payment or student data.
SELECT p.proname,p.prosecdef,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
  position('FOR UPDATE' in pg_get_functiondef(p.oid))>0 AS serializes_enrollment,
  position('academy_payment_allocations' in pg_get_functiondef(p.oid))>0 AS guards_allocated_amounts,
  position('v_other_paid' in pg_get_functiondef(p.oid))>0 AS guards_overpayment_increases
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='academy_update_payment';

-- Legacy overpayment inventory; do not automatically adjust or void any record.
SELECT count(*) AS overpaid_enrollments
FROM (
 SELECT e.id
 FROM public.academy_enrollments e
 LEFT JOIN public.academy_payments p ON p.enrollment_id=e.id
 GROUP BY e.id,e.final_fee
 HAVING coalesce(sum(p.amount) FILTER (WHERE p.status='posted'),0)>coalesce(e.final_fee,0)
) overpaid;
