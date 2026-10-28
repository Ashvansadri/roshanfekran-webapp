-- Manual rollback: first archive new coursework if real records exist.
-- Never run automatically in production.
drop table if exists public.academy_personal_task_submissions;
drop table if exists public.academy_personal_tasks;
drop function if exists private.academy_personal_target_enrolled(uuid,uuid);
