-- Read-only audit of the four staff role guards.
SELECT p.proname, pg_get_functiondef(p.oid) ILIKE '%archived_at is null%' AS rejects_archived_staff
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('academy_is_management','academy_is_staff','academy_role_allowed','academy_teacher_workspace_core')
ORDER BY p.proname;
SELECT count(*) AS staff_total, count(*) FILTER (WHERE active AND archived_at IS NULL) AS eligible_staff, count(*) FILTER (WHERE active AND archived_at IS NOT NULL) AS active_but_archived
FROM public.academy_staff;
