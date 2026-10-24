-- Read-only structural verification. Expected: 15 rows, each matches = 1.
WITH expected(name) AS (VALUES
  ('academy_grade_showcase_quiz'),
  ('academy_showcase_quiz_questions'),
  ('academy_save_showcase'),
  ('academy_save_showcase_work'),
  ('academy_student_portfolio_snapshot'),
  ('academy_quiz_for_me'),
  ('academy_submit_mission'),
  ('academy_mark_learning_progress'),
  ('academy_my_rewards'),
  ('academy_submit_assignment'),
  ('academy_submit_assignment_with_file'),
  ('academy_submit_quiz'),
  ('academy_update_self_profile'),
  ('academy_set_showcase_share'),
  ('academy_student_resume_snapshot')
)
SELECT e.name, count(p.oid) AS signatures,
       bool_and(pg_get_functiondef(p.oid) ~* 'archived_at\\s+is\\s+null') AS checks_archive_timestamp,
       bool_and(pg_get_functiondef(p.oid) ~* 'status\\s+is\\s+distinct\\s+from\\s+''archived''') AS checks_archive_status
FROM expected e LEFT JOIN pg_proc p ON p.proname=e.name AND p.pronamespace='public'::regnamespace
GROUP BY e.name ORDER BY e.name;
