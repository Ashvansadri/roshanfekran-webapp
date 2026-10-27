-- Manual rollback only. Aggregates are non-identifying, but stop the cron before dropping.
select cron.unschedule('rf-academy-daily-activity-report');
drop function if exists public.academy_capture_daily_metrics(date);
drop policy if exists academy_daily_activity_management_only on public.academy_daily_activity_reports;
drop table if exists public.academy_daily_activity_reports;
