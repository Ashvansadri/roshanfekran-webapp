-- Read-only verification. No student, enrollment or payment data is changed.
SELECT
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='academy_enrollments'
      AND t.tgname='academy_enrollment_financial_integrity'
      AND NOT t.tgisinternal AND t.tgenabled='O'
      AND pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE OF%'
  ) AS trigger_active,
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='academy_guard_enrollment_financial_integrity'
      AND p.prosecdef
      AND pg_get_functiondef(p.oid) LIKE '%p.status=''posted''%'
      AND pg_get_functiondef(p.oid) LIKE '%NEW.final_fee < v_posted%'
  ) AS guard_checks_posted_payments,
  NOT has_function_privilege('authenticated',
    'public.academy_guard_enrollment_financial_integrity()','EXECUTE') AS direct_execution_blocked,
  (SELECT count(*) FROM public.academy_enrollments) AS enrollments_preserved,
  (SELECT count(*) FROM public.academy_payments) AS payments_preserved;
