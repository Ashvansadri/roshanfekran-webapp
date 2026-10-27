-- Roshanfekran daily aggregate: counts only, never names, phones or documents.
-- Cron runs at 21:00 UTC = 00:30 Asia/Tehran, summarising yesterday.
create table if not exists public.academy_daily_activity_reports (
 report_date date primary key,
 generated_at timestamptz not null default now(),
 applications_created integer not null default 0 check (applications_created>=0),
 enrollments_created integer not null default 0 check (enrollments_created>=0),
 assignments_created integer not null default 0 check (assignments_created>=0),
 submissions_created integer not null default 0 check (submissions_created>=0),
 student_requests_created integer not null default 0 check (student_requests_created>=0),
 payments_recorded integer not null default 0 check (payments_recorded>=0),
 guardian_links_created integer not null default 0 check (guardian_links_created>=0)
);
alter table public.academy_daily_activity_reports enable row level security;
revoke all on public.academy_daily_activity_reports from public,anon,authenticated;
grant select on public.academy_daily_activity_reports to authenticated;
create policy academy_daily_activity_management_only
 on public.academy_daily_activity_reports for select to authenticated
 using (public.academy_role_allowed(array['owner'::text,'manager'::text]));
create or replace function public.academy_capture_daily_metrics(p_date date default ((now() at time zone 'Asia/Tehran')::date - 1))
returns void language sql security invoker set search_path=pg_catalog,public as $$
 insert into public.academy_daily_activity_reports(
  report_date,generated_at,applications_created,enrollments_created,
  assignments_created,submissions_created,student_requests_created,
  payments_recorded,guardian_links_created
 )
 select b.d,now(),
  (select count(*)::int from public.academy_registration_requests t where t.submitted_at>=b.a and t.submitted_at<b.z),
  (select count(*)::int from public.academy_enrollments t where t.created_at>=b.a and t.created_at<b.z),
  (select count(*)::int from public.academy_assignments t where t.created_at>=b.a and t.created_at<b.z),
  (select count(*)::int from public.academy_assignment_submissions t where t.submitted_at>=b.a and t.submitted_at<b.z),
  (select count(*)::int from public.academy_student_requests t where t.created_at>=b.a and t.created_at<b.z),
  (select count(*)::int from public.academy_payments t where t.created_at>=b.a and t.created_at<b.z),
  (select count(*)::int from public.academy_guardian_students t where t.created_at>=b.a and t.created_at<b.z)
 from (select p_date d, p_date::timestamp at time zone 'Asia/Tehran' a, (p_date+1)::timestamp at time zone 'Asia/Tehran' z) b
 on conflict (report_date) do update set
 generated_at=excluded.generated_at,
 applications_created=excluded.applications_created,
 enrollments_created=excluded.enrollments_created,
 assignments_created=excluded.assignments_created,
 submissions_created=excluded.submissions_created,
 student_requests_created=excluded.student_requests_created,
 payments_recorded=excluded.payments_recorded,
 guardian_links_created=excluded.guardian_links_created;
$$;
revoke all on function public.academy_capture_daily_metrics(date) from public,anon,authenticated;
select cron.schedule('rf-academy-daily-activity-report','0 21 * * *',
 $$select public.academy_capture_daily_metrics()$$);
