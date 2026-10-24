-- 2026-10-25 | Assignment submission integrity (shared Supabase backend).
-- The prior authenticated INSERT/UPDATE policies let a student write grading columns
-- (score, feedback, reviewed_by, reviewed_at, status, portfolio_approved) directly.
-- Keep SELECT access under existing scoped RLS. Route all writes through the
-- already deployed SECURITY DEFINER RPCs that enforce enrollment and teacher roles.
-- Confirmed: legacy Floot learn/teacher pages call these RPCs for writes.
BEGIN;
REVOKE INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.academy_assignment_submissions FROM authenticated;
REVOKE INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.academy_assignment_submissions FROM anon;
DROP POLICY IF EXISTS academy_submissions_insert ON public.academy_assignment_submissions;
DROP POLICY IF EXISTS academy_submissions_update ON public.academy_assignment_submissions;
COMMIT;
