-- Emergency rollback for 20261025_enrollment_financial_integrity.sql.
-- Removes only the new guard. Does not modify or remove any enrollment/payment.
BEGIN;
DROP TRIGGER IF EXISTS academy_enrollment_financial_integrity ON public.academy_enrollments;
DROP FUNCTION IF EXISTS public.academy_guard_enrollment_financial_integrity();
COMMIT;
