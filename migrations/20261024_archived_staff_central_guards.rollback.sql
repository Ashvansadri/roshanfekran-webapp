-- Emergency rollback only: restores previous authorization logic (weaker archive checks).
-- Use only after reviewing the security implications.
BEGIN;
CREATE OR REPLACE FUNCTION public.academy_is_management()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists(select 1 from public.academy_staff s where s.user_id=auth.uid() and s.active=true and s.role in ('owner','manager'));
$function$;

CREATE OR REPLACE FUNCTION public.academy_is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists(select 1 from public.academy_staff s where s.user_id=auth.uid() and s.active=true);
$function$;

CREATE OR REPLACE FUNCTION public.academy_role_allowed(p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.academy_staff s
    where s.user_id=(select auth.uid()) and s.active=true and s.role=any(p_roles)
  )
$function$;

CREATE OR REPLACE FUNCTION public.academy_teacher_workspace_core()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid; v_role text;
begin
  v_uid := (select auth.uid());
  select role into v_role from public.academy_staff where user_id=v_uid and active=true;
  if v_role is distinct from 'teacher' then raise exception 'Teacher access required'; end if;

  return jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'department_id',c.department_id,'title',c.title,'code',c.code,
        'teacher_name',c.teacher_name,'capacity',c.capacity,'status',c.status,
        'start_date',c.start_date,'end_date',c.end_date,'teacher_user_id',c.teacher_user_id
      ) order by c.created_at desc)
      from public.academy_courses c
      where c.teacher_user_id=v_uid
    ),'[]'::jsonb),
    'enrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'student_id',e.student_id,'course_id',e.course_id,
        'status',e.status,'enrolled_at',e.enrolled_at,'completed_at',e.completed_at
      ) order by e.enrolled_at desc)
      from public.academy_enrollments e
      join public.academy_courses c on c.id=e.course_id
      where c.teacher_user_id=v_uid
    ),'[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id',s.id,'student_no',s.student_no,'full_name',s.full_name,
        'mobile',s.mobile,'status',s.status
      ))
      from public.academy_students s
      where exists(
        select 1 from public.academy_enrollments e
        join public.academy_courses c on c.id=e.course_id
        where e.student_id=s.id and c.teacher_user_id=v_uid
      )
    ),'[]'::jsonb)
  );
end $function$;
COMMIT;
