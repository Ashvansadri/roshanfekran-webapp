-- 2026-10-25 | Fail closed on enrollment fee reductions and reassignment after posted payments.
-- Shared Floot/Render database. No financial records are updated by this migration.
-- Historical overpayments are left untouched for manual reconciliation.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_guard_enrollment_financial_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $guard$
DECLARE
  v_posted bigint;
BEGIN
  IF NEW.student_id IS NOT DISTINCT FROM OLD.student_id
     AND NEW.course_id IS NOT DISTINCT FROM OLD.course_id
     AND NEW.final_fee IS NOT DISTINCT FROM OLD.final_fee THEN
    RETURN NEW;
  END IF;

  -- The enrollment row is already locked by UPDATE. The payment INSERT guard
  -- locks this same parent row before inserting, serializing fee/payment changes.
  -- SECURITY DEFINER is required: registrars can edit enrollment data but
  -- intentionally cannot SELECT the confidential payment ledger through RLS.
  SELECT coalesce(sum(p.amount),0) INTO v_posted
  FROM public.academy_payments AS p
  WHERE p.enrollment_id=OLD.id AND p.status='posted';

  IF v_posted > 0 THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.course_id IS DISTINCT FROM OLD.course_id THEN
      RAISE EXCEPTION 'Enrollment with posted payments cannot be reassigned'
        USING ERRCODE='23514';
    END IF;
    IF NEW.final_fee IS NULL THEN
      RAISE EXCEPTION 'Enrollment with posted payments requires a final fee'
        USING ERRCODE='23514';
    END IF;
    -- Allow increasing the fee to reconcile legacy overpayments; block only
    -- decreases that would create or worsen an overpayment.
    IF NEW.final_fee < v_posted
       AND (OLD.final_fee IS NULL OR NEW.final_fee < OLD.final_fee) THEN
      RAISE EXCEPTION 'Final fee cannot fall below posted payments'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$guard$;

REVOKE ALL ON FUNCTION public.academy_guard_enrollment_financial_integrity()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS academy_enrollment_financial_integrity ON public.academy_enrollments;
CREATE TRIGGER academy_enrollment_financial_integrity
BEFORE UPDATE OF final_fee, student_id, course_id ON public.academy_enrollments
FOR EACH ROW EXECUTE FUNCTION public.academy_guard_enrollment_financial_integrity();
COMMIT;
