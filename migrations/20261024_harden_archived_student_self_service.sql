-- Roshanfekran staging security migration (2026-10-24).
-- Deny archived student self-service access, whether archival is marked by status or timestamp.
-- Updates FUNCTION DEFINITIONS ONLY. No application data, users, or grants are changed.
-- Each function must exist exactly once and contain exactly one expected snippet; otherwise abort the transaction.
DO $archive_guard_migration$
DECLARE
  item record;
  current_def text;
  matching_count integer;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
  ('academy_grade_showcase_quiz', 'user_id=auth.uid() and portal_enabled=true limit 1;', 'user_id=auth.uid() and portal_enabled=true and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_showcase_quiz_questions', 'user_id=auth.uid() and portal_enabled=true)', 'user_id=auth.uid() and portal_enabled=true and archived_at is null and status is distinct from ''archived'')'),
  ('academy_save_showcase', 'user_id=auth.uid() and portal_enabled limit 1;', 'user_id=auth.uid() and portal_enabled and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_save_showcase_work', 'user_id=auth.uid() and portal_enabled limit 1;', 'user_id=auth.uid() and portal_enabled and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_student_portfolio_snapshot', 'user_id=(select auth.uid()) and portal_enabled=true limit 1;', 'user_id=(select auth.uid()) and portal_enabled=true and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_quiz_for_me', 's.user_id=(select auth.uid()) and s.portal_enabled=true limit 1;', 's.user_id=(select auth.uid()) and s.portal_enabled=true and s.archived_at is null and s.status is distinct from ''archived'' limit 1;'),
  ('academy_submit_mission', 'user_id=auth.uid() AND portal_enabled=true LIMIT 1;', 'user_id=auth.uid() AND portal_enabled=true AND archived_at IS NULL AND status IS DISTINCT FROM ''archived'' LIMIT 1;'),
  ('academy_mark_learning_progress', 'user_id=(select auth.uid()) and portal_enabled=true limit 1;', 'user_id=(select auth.uid()) and portal_enabled=true and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_my_rewards', 's.user_id=(select auth.uid()) limit 1;', 's.user_id=(select auth.uid()) and s.archived_at is null and s.status is distinct from ''archived'' limit 1;'),
  ('academy_submit_assignment', 'user_id=(select auth.uid()) limit 1;', 'user_id=(select auth.uid()) and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_submit_assignment_with_file', 'where user_id=(select auth.uid()) and portal_enabled=true
  limit 1;', 'where user_id=(select auth.uid()) and portal_enabled=true and archived_at is null and status is distinct from ''archived''
  limit 1;'),
  ('academy_submit_quiz', 's.user_id=(select auth.uid()) and s.portal_enabled=true limit 1;', 's.user_id=(select auth.uid()) and s.portal_enabled=true and s.archived_at is null and s.status is distinct from ''archived'' limit 1;'),
  ('academy_update_self_profile', 'where user_id=(select auth.uid()) limit 1;', 'where user_id=(select auth.uid()) and archived_at is null and status is distinct from ''archived'' limit 1;'),
  ('academy_set_showcase_share', 'AND archived_at IS NULL LIMIT 1;', 'AND archived_at IS NULL AND status IS DISTINCT FROM ''archived'' LIMIT 1;'),
  ('academy_student_resume_snapshot', 'AND archived_at IS NULL LIMIT 1;', 'AND archived_at IS NULL AND status IS DISTINCT FROM ''archived'' LIMIT 1;')
    ) AS edits(function_name, old_text, new_text)
  LOOP
    SELECT count(*), max(pg_get_functiondef(p.oid))
      INTO matching_count, current_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=item.function_name;
    IF matching_count <> 1 THEN
      RAISE EXCEPTION 'Unexpected function signature count for %: %', item.function_name, matching_count;
    END IF;
    IF length(current_def)-length(replace(current_def, item.old_text, '')) <> length(item.old_text) THEN
      RAISE EXCEPTION 'Expected function guard snippet missing or repeated: %', item.function_name;
    END IF;
    EXECUTE replace(current_def, item.old_text, item.new_text);
  END LOOP;
END;
$archive_guard_migration$;
