select count(*) as reports from public.academy_daily_activity_reports;
select jobname,schedule,active from cron.job where jobname='rf-academy-daily-activity-report';
select relrowsecurity from pg_class where oid='public.academy_daily_activity_reports'::regclass;
select grantee,privilege_type from information_schema.role_table_grants where table_name='academy_daily_activity_reports' and table_schema='public';
