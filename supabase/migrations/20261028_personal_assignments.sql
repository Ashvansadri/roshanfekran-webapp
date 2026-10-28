-- Individual, access-controlled coursework. Does not modify existing enrollment or course records.
create or replace function private.academy_personal_target_enrolled(p_student uuid,p_course uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth
as $$
 select auth.uid() is not null and exists (
  select 1 from public.academy_enrollments e
  join public.academy_students s on s.id=e.student_id
  where e.student_id=p_student and e.course_id=p_course
   and e.status in ('active','completed')
   and s.archived_at is null and s.status is distinct from 'archived'
 );
$$;
revoke all on function private.academy_personal_target_enrolled(uuid,uuid) from public,anon;
grant execute on function private.academy_personal_target_enrolled(uuid,uuid) to authenticated;

create table public.academy_personal_tasks(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.academy_students(id),
 course_id uuid not null references public.academy_courses(id),
 title text not null check (char_length(trim(title)) between 4 and 150),
 instructions text not null check (char_length(trim(instructions)) between 8 and 4000),
 due_at timestamptz not null,
 published boolean not null default false,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 constraint academy_personal_task_future_due check (due_at>created_at)
);
create index academy_personal_tasks_student_idx on public.academy_personal_tasks(student_id,due_at);
create index academy_personal_tasks_course_idx on public.academy_personal_tasks(course_id,due_at);
alter table public.academy_personal_tasks enable row level security;
revoke all on public.academy_personal_tasks from public,anon,authenticated;
grant select on public.academy_personal_tasks to authenticated;
grant insert(course_id,student_id,title,instructions,due_at,published) on public.academy_personal_tasks to authenticated;
create policy academy_personal_tasks_select on public.academy_personal_tasks for select to authenticated
using (
 public.academy_role_allowed(array['owner'::text,'manager'::text])
 or private.academy_teacher_has_course(course_id)
 or (published=true and student_id=private.academy_current_student_id())
);
create policy academy_personal_tasks_insert on public.academy_personal_tasks for insert to authenticated
with check (
 created_by=(select auth.uid()) and
 (public.academy_role_allowed(array['owner'::text,'manager'::text]) or private.academy_teacher_has_course(course_id))
 and private.academy_personal_target_enrolled(student_id,course_id)
);

create table public.academy_personal_task_submissions(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.academy_personal_tasks(id),
 student_id uuid not null default private.academy_current_student_id() references public.academy_students(id),
 submission_text text not null check(char_length(trim(submission_text)) between 10 and 4000),
 submission_url text null check(submission_url is null or (char_length(submission_url)<=1000 and submission_url ~ '^https://[^[:space:]]+$')),
 submitted_at timestamptz not null default now(),
 status text not null default 'submitted' check(status in ('submitted','reviewed')),
 score numeric null check(score is null or (score>=0 and score<=100)),
 feedback text null check(feedback is null or char_length(feedback)<=2000),
 reviewed_at timestamptz null,
 unique(task_id,student_id)
);
create index academy_personal_submissions_task_idx on public.academy_personal_task_submissions(task_id);
alter table public.academy_personal_task_submissions enable row level security;
revoke all on public.academy_personal_task_submissions from public,anon,authenticated;
grant select on public.academy_personal_task_submissions to authenticated;
grant insert(task_id,submission_text,submission_url) on public.academy_personal_task_submissions to authenticated;
grant update(status,score,feedback,reviewed_at) on public.academy_personal_task_submissions to authenticated;
create policy academy_personal_submissions_select on public.academy_personal_task_submissions for select to authenticated
using (
 student_id=private.academy_current_student_id() or
 exists(select 1 from public.academy_personal_tasks t where t.id=task_id
  and (public.academy_role_allowed(array['owner'::text,'manager'::text]) or private.academy_teacher_has_course(t.course_id)))
);
create policy academy_personal_submissions_insert on public.academy_personal_task_submissions for insert to authenticated
with check (
 student_id=private.academy_current_student_id()
 and status='submitted' and score is null and feedback is null and reviewed_at is null
 and exists(select 1 from public.academy_personal_tasks t
  where t.id=task_id and t.student_id=student_id and t.published=true)
);
create policy academy_personal_submissions_review on public.academy_personal_task_submissions for update to authenticated
using(exists(select 1 from public.academy_personal_tasks t where t.id=task_id
 and (public.academy_role_allowed(array['owner'::text,'manager'::text]) or private.academy_teacher_has_course(t.course_id))))
with check(status='reviewed' and score is not null and reviewed_at is not null and
 exists(select 1 from public.academy_personal_tasks t where t.id=task_id
 and (public.academy_role_allowed(array['owner'::text,'manager'::text]) or private.academy_teacher_has_course(t.course_id))));
