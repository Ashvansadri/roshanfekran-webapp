-- Roshanfekran staging / 2026-10-24
-- Caller-side archive guard only. No data writes, drops, resets or privilege changes.
-- Source definitions captured from connected Supabase immediately before migration.
-- Run in a transaction; preserve SECURITY DEFINER, signatures, owner and EXECUTE grants.

-- academy_archive_staff
CREATE OR REPLACE FUNCTION public.academy_archive_staff(p_user_id uuid, p_archive boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_caller text; v_target text; v_name text;
begin
  select role into v_caller from public.academy_staff
  where user_id=(select auth.uid()) and active=true and archived_at is null;
  if v_caller is distinct from 'owner' then raise exception 'Owner role required'; end if;

  select role,full_name into v_target,v_name
  from public.academy_staff where user_id=p_user_id for update;
  if v_target is null then raise exception 'Staff not found'; end if;
  if v_target='owner' then raise exception 'Owner account cannot be archived'; end if;

  update public.academy_staff
  set active=not p_archive,
      archived_at=case when p_archive then now() else null end,
      updated_at=now()
  where user_id=p_user_id;

  return jsonb_build_object(
    'ok',true,'user_id',p_user_id,'full_name',v_name,
    'archived',p_archive,'active',not p_archive
  );
end $function$;

-- academy_convert_lead
CREATE OR REPLACE FUNCTION public.academy_convert_lead(p_lead_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_discount bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; l public.academy_leads; v_student uuid; v_enroll uuid; v_result jsonb; v_course uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  select * into l from public.academy_leads where id=p_lead_id for update;
  if l.id is null then raise exception 'Lead not found'; end if;
  if l.converted_student_id is not null then
    return jsonb_build_object('ok',true,'student_id',l.converted_student_id,'enrollment_id',l.converted_enrollment_id,'already_converted',true);
  end if;
  if l.mobile is not null then select id into v_student from public.academy_students where mobile=l.mobile order by created_at asc limit 1; end if;
  if v_student is null then
    insert into public.academy_students(full_name,mobile,email,status,created_by)
    values(l.full_name,l.mobile,l.email,'pre_registered',(select auth.uid()))
    returning id into v_student;
  end if;
  v_course:=coalesce(p_course_id,l.interested_course_id);
  if v_course is not null then
    v_result:=public.academy_create_enrollment(v_student,v_course,null,greatest(0,p_discount),0,'pos',null,0,null);
    v_enroll:=(v_result->>'enrollment_id')::uuid;
  end if;
  update public.academy_leads
  set stage='won',converted_student_id=v_student,converted_enrollment_id=v_enroll,updated_at=now()
  where id=l.id;
  return jsonb_build_object('ok',true,'student_id',v_student,'enrollment_id',v_enroll);
end $function$;

-- academy_create_self_registration_link
CREATE OR REPLACE FUNCTION public.academy_create_self_registration_link(p_label text, p_course_id uuid DEFAULT NULL::uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_require_approval boolean DEFAULT true, p_max_uses integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_row public.academy_self_registration_links%rowtype;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  if nullif(btrim(coalesce(p_label,'')),'') is null then raise exception 'Label required'; end if;
  if p_course_id is not null and not exists(select 1 from public.academy_courses where id=p_course_id and status='active') then
    raise exception 'Active course not found';
  end if;
  if p_max_uses is not null and p_max_uses<1 then raise exception 'Invalid max uses'; end if;

  insert into public.academy_self_registration_links(label,course_id,active,require_approval,max_uses,expires_at,created_by)
  values(btrim(p_label),p_course_id,true,p_require_approval,p_max_uses,p_expires_at,(select auth.uid()))
  returning * into v_row;

  return jsonb_build_object(
    'id',v_row.id,'token',v_row.public_token,'label',v_row.label,'course_id',v_row.course_id,
    'require_approval',v_row.require_approval,'max_uses',v_row.max_uses,'expires_at',v_row.expires_at
  );
end $function$;

-- academy_grade_assignment
CREATE OR REPLACE FUNCTION public.academy_grade_assignment(p_submission_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text; v_max numeric; v_course uuid; v_student uuid; v_title text; v_uid uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  select a.max_score,a.course_id,s.student_id,a.title into v_max,v_course,v_student,v_title
  from public.academy_assignment_submissions s
  join public.academy_assignments a on a.id=s.assignment_id
  where s.id=p_submission_id;
  if v_course is null then raise exception 'Submission not found'; end if;
  if not (coalesce(v_role, '') in ('owner','manager') or exists(select 1 from public.academy_courses c where c.id=v_course and c.teacher_user_id=(select auth.uid()))) then
    raise exception 'Not authorized';
  end if;
  if p_score<0 or p_score>v_max then raise exception 'Invalid score'; end if;

  update public.academy_assignment_submissions
  set score=p_score,feedback=nullif(btrim(coalesce(p_feedback,'')),''),status='reviewed',
      reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now(),portfolio_approved=true
  where id=p_submission_id;

  insert into public.academy_learning_progress(student_id,course_id,item_type,item_id,status,completed_at,last_viewed_at,updated_at)
  select s.student_id,a.course_id,'assignment',a.id,'completed',now(),now(),now()
  from public.academy_assignment_submissions s
  join public.academy_assignments a on a.id=s.assignment_id
  where s.id=p_submission_id
  on conflict(student_id,item_type,item_id) do update
  set status='completed',completed_at=excluded.completed_at,updated_at=now();

  select user_id into v_uid from public.academy_students where id=v_student;
  if v_uid is not null then
    insert into public.academy_notifications(user_id,student_id,kind,title,body,due_at,action_url,related_type,related_id)
    values(v_uid,v_student,'grade','تکلیف تایید شد: '||coalesce(v_title,'تکلیف'),
           'این فعالیت به رزومه آموزشی شما اضافه شد. نمره '||p_score||' از '||v_max||
           case when nullif(btrim(coalesce(p_feedback,'')),'') is not null then ' • بازخورد مدرس ثبت شده است.' else '' end,
           now(),'/portal','assignment_submission',p_submission_id);
  end if;

  insert into public.academy_notifications(user_id,student_id,kind,title,body,due_at,action_url,related_type,related_id)
  select g.user_id,v_student,'guardian_assignment_reviewed','تکلیف فرزند شما تایید شد: '||coalesce(v_title,'تکلیف'),
         'فعالیت تاییدشده به مسیر پیشرفت و رزومه آموزشی اضافه شد.',
         now(),'/parent','assignment_submission',p_submission_id
  from public.academy_guardian_students gs
  join public.academy_guardians g on g.id=gs.guardian_id
  where gs.student_id=v_student and gs.can_receive_notifications=true and gs.can_view_academic=true
    and g.active=true and g.user_id is not null;

  return jsonb_build_object('ok',true,'portfolio_approved',true);
end $function$;

-- academy_invite_staff
CREATE OR REPLACE FUNCTION public.academy_invite_staff(p_email text, p_full_name text, p_role text, p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_caller text;
  v_caller_uid uuid;
  v_uid uuid;
  v_email text;
  v_existing_role text;
begin
  v_caller_uid := (select auth.uid());
  select s.role into v_caller
  from public.academy_staff s
  where s.user_id=v_caller_uid and s.active=true and s.archived_at is null;

  if v_caller is null or v_caller not in('owner','manager') then
    raise exception 'Not authorized';
  end if;

  v_email := lower(btrim(p_email));
  if v_email='' or position('@' in v_email)<2 then raise exception 'Invalid email'; end if;
  if p_role not in('manager','finance','registrar','teacher','viewer') then raise exception 'Invalid role'; end if;
  if p_days<1 or p_days>30 then raise exception 'Invalid expiry'; end if;

  select id into v_uid from auth.users where lower(email)=v_email limit 1;

  if v_uid = v_caller_uid then
    raise exception 'Cannot invite current owner account';
  end if;

  if v_uid is not null then
    select role into v_existing_role from public.academy_staff where user_id=v_uid;
    if v_existing_role='owner' then
      raise exception 'Cannot change owner role through invite';
    end if;

    insert into public.academy_staff(user_id,full_name,role,active)
    values(v_uid,coalesce(nullif(btrim(p_full_name),''),v_email),p_role,true)
    on conflict(user_id) do update
      set full_name=excluded.full_name,
          role=excluded.role,
          active=true,
          updated_at=now();
    return jsonb_build_object('mode','activated','user_id',v_uid,'email',v_email,'role',p_role);
  end if;

  insert into public.academy_staff_invites(email,full_name,role,invited_by,expires_at,used_at,revoked_at)
  values(v_email,p_full_name,p_role,v_caller_uid,now()+(p_days||' days')::interval,null,null)
  on conflict(email) do update
    set full_name=excluded.full_name,
        role=excluded.role,
        invited_by=excluded.invited_by,
        expires_at=excluded.expires_at,
        used_at=null,
        revoked_at=null;

  return jsonb_build_object('mode','invited','email',v_email,'role',p_role);
end
$function$;

-- academy_list_staff
CREATE OR REPLACE FUNCTION public.academy_list_staff()
 RETURNS TABLE(user_id uuid, full_name text, role text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_caller text;
begin
 select s.role into v_caller from public.academy_staff s where s.user_id=(select auth.uid()) and s.active=true and s.archived_at is null;
 if v_caller is null or v_caller not in('owner','manager') then raise exception 'Not authorized'; end if;
 return query select s.user_id,s.full_name,s.role,s.active,s.created_at,s.updated_at from public.academy_staff s order by s.active desc,s.created_at;
end $function$;

-- academy_list_staff_directory
CREATE OR REPLACE FUNCTION public.academy_list_staff_directory()
 RETURNS TABLE(user_id uuid, full_name text, role text, active boolean, avatar_url text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text;
begin
  select s.role into v_role from public.academy_staff s where s.user_id=(select auth.uid()) and s.active=true and s.archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager') then raise exception 'Not authorized'; end if;
  return query select s.user_id,s.full_name,s.role,s.active,s.avatar_url,u.email::text from public.academy_staff s left join auth.users u on u.id=s.user_id order by s.created_at;
end$function$;

-- academy_list_student_risk
CREATE OR REPLACE FUNCTION public.academy_list_student_risk()
 RETURNS SETOF academy_student_risk
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar','finance') then raise exception 'Not authorized'; end if;
  return query select * from public.academy_student_risk order by risk_score desc, overdue_amount desc;
end $function$;

-- academy_purge_staff_data
CREATE OR REPLACE FUNCTION public.academy_purge_staff_data(p_user_id uuid, p_confirm_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_target public.academy_staff%rowtype;
  v_name text;
  v_email text;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if v_role is distinct from 'owner' then raise exception 'Not authorized'; end if;
  if p_user_id=(select auth.uid()) then raise exception 'Cannot purge current owner'; end if;

  select * into v_target from public.academy_staff where user_id=p_user_id;
  if v_target.user_id is null then raise exception 'Staff not found'; end if;
  if v_target.role='owner' then raise exception 'Owner cannot be purged'; end if;
  if btrim(coalesce(p_confirm_name,''))<>btrim(v_target.full_name) then raise exception 'Confirmation name mismatch'; end if;

  if exists(select 1 from public.academy_students where user_id=p_user_id)
     or exists(select 1 from public.academy_guardians where user_id=p_user_id) then
    raise exception 'This account is also linked to a student or guardian';
  end if;

  v_name:=v_target.full_name;
  select email into v_email from auth.users where id=p_user_id;

  update public.academy_courses
     set teacher_user_id=null,teacher_name=null
   where teacher_user_id=p_user_id or teacher_name=v_name;
  update public.academy_classes set teacher_name=null where teacher_name=v_name;
  update public.academy_teacher_payouts set teacher_name='' where teacher_name=v_name;

  delete from public.academy_staff_contracts where staff_user_id=p_user_id;
  delete from public.academy_staff_attendance where staff_user_id=p_user_id;
  delete from public.academy_teacher_task_logs where teacher_user_id=p_user_id;
  delete from public.academy_teacher_course_tasks where teacher_user_id=p_user_id;
  delete from public.academy_class_change_requests where requested_by=p_user_id;
  delete from public.academy_notifications where user_id=p_user_id;
  delete from public.academy_push_subscriptions where user_id=p_user_id;

  if v_email is not null then
    delete from public.academy_staff_invites
     where lower(email)=lower(v_email)
        or (full_name is not null and btrim(full_name)=btrim(v_name));
  else
    delete from public.academy_staff_invites
     where full_name is not null and btrim(full_name)=btrim(v_name);
  end if;

  update public.academy_assessment_scores set graded_by=null where graded_by=p_user_id;
  update public.academy_assessments set created_by=null where created_by=p_user_id;
  update public.academy_assignment_rubric_criteria set created_by=null where created_by=p_user_id;
  update public.academy_assignment_submissions set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_assignments set created_by=null where created_by=p_user_id;
  update public.academy_attendance set marked_by=null where marked_by=p_user_id;
  update public.academy_automation_rules set created_by=null where created_by=p_user_id;
  update public.academy_class_change_requests set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_communication_log set created_by=null where created_by=p_user_id;
  update public.academy_communication_templates set created_by=null where created_by=p_user_id;
  update public.academy_course_announcements set created_by=null where created_by=p_user_id;
  update public.academy_course_modules set created_by=null where created_by=p_user_id;
  update public.academy_course_public_links set created_by=null where created_by=p_user_id;
  update public.academy_course_skills set created_by=null where created_by=p_user_id;
  update public.academy_enrollments set created_by=null where created_by=p_user_id;
  update public.academy_expenses set created_by=null where created_by=p_user_id;
  update public.academy_followups set created_by=null where created_by=p_user_id;
  update public.academy_guardian_invites set invited_by=null where invited_by=p_user_id;
  update public.academy_leads set created_by=null where created_by=p_user_id;
  update public.academy_learning_materials set created_by=null where created_by=p_user_id;
  update public.academy_payment_submissions set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_payments set created_by=null where created_by=p_user_id;
  update public.academy_quiz_questions set created_by=null where created_by=p_user_id;
  update public.academy_registration_requests set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_self_registration_links set created_by=null where created_by=p_user_id;
  update public.academy_self_registration_requests set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_settings set updated_by=null where updated_by=p_user_id;
  update public.academy_staff_invites set invited_by=null where invited_by=p_user_id;
  update public.academy_student_documents set reviewed_by=null where reviewed_by=p_user_id;
  update public.academy_student_invites set invited_by=null where invited_by=p_user_id;
  update public.academy_student_rewards set created_by=null where created_by=p_user_id;
  update public.academy_student_skill_scores set evaluated_by=null where evaluated_by=p_user_id;
  update public.academy_students set created_by=null where created_by=p_user_id;
  update public.academy_submission_rubric_scores set graded_by=null where graded_by=p_user_id;
  update public.academy_teacher_course_tasks set completed_by=null where completed_by=p_user_id;
  update public.academy_teacher_payouts set created_by=null where created_by=p_user_id;
  update public.academy_teacher_task_logs set created_by=null where created_by=p_user_id;

  update public.academy_audit_log
     set actor_id=null,
         before_data=case when before_data::text ilike '%'||v_name||'%' then null else before_data end,
         after_data=case when after_data::text ilike '%'||v_name||'%' then null else after_data end
   where actor_id=p_user_id
      or before_data::text ilike '%'||v_name||'%'
      or after_data::text ilike '%'||v_name||'%';

  delete from public.academy_staff where user_id=p_user_id;

  return jsonb_build_object('ok',true,'purged',true,'user_id',p_user_id);
end $function$;

-- academy_reply_service_request
CREATE OR REPLACE FUNCTION public.academy_reply_service_request(p_request_id uuid, p_status text, p_staff_note text DEFAULT NULL::text, p_priority text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','finance','registrar') then raise exception 'Not authorized'; end if;
  if p_status not in ('open','in_progress','resolved','closed') then raise exception 'Invalid status'; end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
  update public.academy_student_requests
  set status=p_status,
      staff_note=nullif(btrim(coalesce(p_staff_note,'')),''),
      priority=coalesce(p_priority,priority),
      assigned_to=(select auth.uid()),
      resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end
  where id=p_request_id;
  if not found then raise exception 'Request not found'; end if;
  return jsonb_build_object('ok',true);
end $function$;

-- academy_review_payment
CREATE OR REPLACE FUNCTION public.academy_review_payment(p_submission_id uuid, p_action text, p_review_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_sub public.academy_payment_submissions%rowtype; v_payment jsonb; v_student_user uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','finance') then raise exception 'Not authorized'; end if;
  select * into v_sub from public.academy_payment_submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if v_sub.status<>'pending' then raise exception 'Submission already reviewed'; end if;
  if p_action='approve' then
    v_payment:=public.academy_record_payment(v_sub.enrollment_id,v_sub.amount,v_sub.method,v_sub.reference_no,coalesce(v_sub.note,'پرداخت ثبت‌شده توسط هنرجو'),v_sub.installment_id);
    update public.academy_payment_submissions set status='approved',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(btrim(p_review_note),''),payment_id=(v_payment->>'payment_id')::uuid where id=v_sub.id;
  elsif p_action='reject' then
    update public.academy_payment_submissions set status='rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(btrim(p_review_note),'') where id=v_sub.id;
  else raise exception 'Invalid action'; end if;
  select user_id into v_student_user from public.academy_students where id=v_sub.student_id;
  if v_student_user is not null then
    insert into public.academy_notifications(user_id,student_id,kind,title,body,due_at,related_type,related_id)
    values(v_student_user,v_sub.student_id,'payment_review',case when p_action='approve' then 'پرداخت تأیید شد' else 'پرداخت نیاز به اصلاح دارد' end,case when p_action='approve' then 'پرداخت شما تأیید و در حساب مالی ثبت شد.' else coalesce(nullif(btrim(p_review_note),''),'پرداخت شما تأیید نشد. لطفاً اطلاعات را بررسی کنید.') end,now(),'payment_submission',v_sub.id) on conflict do nothing;
  end if;
  return jsonb_build_object('submission_id',v_sub.id,'status',case when p_action='approve' then 'approved' else 'rejected' end,'payment',v_payment);
end$function$;

-- academy_review_registration_request
CREATE OR REPLACE FUNCTION public.academy_review_registration_request(p_request_id uuid, p_action text, p_review_note text DEFAULT NULL::text, p_installment_count integer DEFAULT 0, p_first_due date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  r public.academy_registration_requests;
  v_student uuid;
  v_enrollment uuid;
  v_result jsonb;
  v_capacity integer;
  v_active_count integer;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  if p_action not in ('approve','reject','contacted') then raise exception 'Invalid action'; end if;

  select * into r from public.academy_registration_requests where id=p_request_id for update;
  if r.id is null then raise exception 'Registration request not found'; end if;
  if r.status in ('approved','rejected','cancelled') then raise exception 'Registration request already finalized'; end if;

  if p_action='reject' then
    update public.academy_registration_requests
    set status='rejected',review_note=nullif(btrim(coalesce(p_review_note,'')),''),
        reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=r.id;
    return jsonb_build_object('ok',true,'status','rejected');
  elsif p_action='contacted' then
    update public.academy_registration_requests
    set status='contacted',review_note=nullif(btrim(coalesce(p_review_note,'')),''),
        reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=r.id;
    return jsonb_build_object('ok',true,'status','contacted');
  end if;

  select capacity into v_capacity from public.academy_courses
  where id=r.course_id and status='active' for update;
  if not found then raise exception 'Active course not found'; end if;

  if v_capacity is not null then
    select count(*) into v_active_count
    from public.academy_enrollments
    where course_id=r.course_id and status in ('active','completed');
    if v_active_count>=v_capacity then raise exception 'Course capacity is full'; end if;
  end if;

  if r.national_id is not null and btrim(r.national_id)<>'' then
    select id into v_student from public.academy_students where national_id=btrim(r.national_id) limit 1;
  end if;
  if v_student is null then
    select id into v_student from public.academy_students where mobile=r.mobile order by created_at asc limit 1;
  end if;
  if v_student is null then
    insert into public.academy_students(full_name,mobile,national_id,city,email,status,created_by)
    values(r.full_name,r.mobile,nullif(btrim(r.national_id),''),nullif(btrim(r.city),''),nullif(lower(btrim(r.email)),''),
           'pre_registered',(select auth.uid()))
    returning id into v_student;
  else
    update public.academy_students
    set full_name=coalesce(nullif(btrim(r.full_name),''),full_name),
        city=coalesce(nullif(btrim(r.city),''),city),
        email=coalesce(nullif(lower(btrim(r.email)),''),email)
    where id=v_student;
  end if;

  select id into v_enrollment
  from public.academy_enrollments
  where student_id=v_student and course_id=r.course_id and status in ('active','completed')
  order by enrolled_at desc limit 1;

  if v_enrollment is null then
    if p_installment_count < 0 or p_installment_count > 12 then raise exception 'Invalid installment count'; end if;
    v_result := public.academy_create_enrollment(
      v_student,r.course_id,null,0,r.deposit_amount,
      coalesce(nullif(r.payment_method,''),'card_transfer'),r.reference_no,
      p_installment_count,p_first_due
    );
    v_enrollment := (v_result->>'enrollment_id')::uuid;
  end if;

  update public.academy_registration_requests
  set status='approved',review_note=nullif(btrim(coalesce(p_review_note,'')),''),
      reviewed_by=(select auth.uid()),reviewed_at=now(),
      student_id=v_student,enrollment_id=v_enrollment
  where id=r.id;

  return jsonb_build_object('ok',true,'status','approved','student_id',v_student,'enrollment_id',v_enrollment);
end
$function$;

-- academy_review_self_registration
CREATE OR REPLACE FUNCTION public.academy_review_self_registration(p_request_id uuid, p_action text, p_review_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_req public.academy_self_registration_requests%rowtype;
  v_course public.academy_courses%rowtype;
  v_enrollment uuid;
  v_active_count integer;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  if p_action not in ('approve','reject') then raise exception 'Invalid action'; end if;

  select * into v_req from public.academy_self_registration_requests where id=p_request_id for update;
  if v_req.id is null then raise exception 'Request not found'; end if;
  if v_req.status not in ('profile_pending','pending_review') then raise exception 'Request already reviewed'; end if;

  if p_action='reject' then
    update public.academy_self_registration_requests
    set status='rejected',review_note=nullif(btrim(coalesce(p_review_note,'')),''),reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=v_req.id;
    update public.academy_students set portal_enabled=false,status='pre_registered' where id=v_req.student_id;
    return jsonb_build_object('ok',true,'status','rejected');
  end if;

  if not v_req.profile_completed then raise exception 'Profile not completed'; end if;

  if v_req.course_id is not null then
    select * into v_course from public.academy_courses where id=v_req.course_id for update;
    if v_course.id is null or v_course.status<>'active' then raise exception 'Active course not found'; end if;
    if v_course.capacity is not null then
      select count(*) into v_active_count from public.academy_enrollments
      where course_id=v_req.course_id and status in ('pending','active','completed');
      if v_active_count>=v_course.capacity
         and not exists(select 1 from public.academy_enrollments where student_id=v_req.student_id and course_id=v_req.course_id) then
        raise exception 'Course capacity is full';
      end if;
    end if;
  end if;

  update public.academy_students
  set status='active',portal_enabled=true,updated_at=now()
  where id=v_req.student_id;

  if v_req.course_id is not null then
    insert into public.academy_enrollments(student_id,course_id,list_fee,discount,final_fee,status,created_by)
    values(v_req.student_id,v_req.course_id,v_course.base_fee,0,v_course.base_fee,'active',(select auth.uid()))
    on conflict(student_id,course_id) do update set status='active'
    returning id into v_enrollment;
  end if;

  update public.academy_self_registration_requests
  set status='approved',review_note=nullif(btrim(coalesce(p_review_note,'')),''),reviewed_by=(select auth.uid()),reviewed_at=now()
  where id=v_req.id;

  return jsonb_build_object('ok',true,'status','approved','student_id',v_req.student_id,'enrollment_id',v_enrollment);
end $function$;

-- academy_review_student_document
CREATE OR REPLACE FUNCTION public.academy_review_student_document(p_document_id uuid, p_status text, p_review_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  if p_status not in ('approved','rejected','pending') then raise exception 'Invalid status'; end if;
  update public.academy_student_documents
  set status=p_status,
      review_note=nullif(btrim(coalesce(p_review_note,'')),''),
      reviewed_by=(select auth.uid()),
      reviewed_at=case when p_status='pending' then null else now() end
  where id=p_document_id;
  if not found then raise exception 'Document not found'; end if;
  return jsonb_build_object('ok',true);
end $function$;

-- academy_set_course_payment_options
CREATE OR REPLACE FUNCTION public.academy_set_course_payment_options(p_course_id uuid, p_installment_enabled boolean DEFAULT true, p_installment_markup_percent numeric DEFAULT 5, p_installment_max_count integer DEFAULT 3, p_active boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_row public.academy_course_public_links%rowtype;
begin
  select role into v_role
  from public.academy_staff
  where user_id=(select auth.uid()) and active=true and archived_at is null;

  if coalesce(v_role, '') not in ('owner','manager','registrar') then
    raise exception 'Not authorized';
  end if;

  if not exists(select 1 from public.academy_courses where id=p_course_id and status<>'archived') then
    raise exception 'Course not found';
  end if;

  if coalesce(p_installment_markup_percent,0)<0 or coalesce(p_installment_markup_percent,0)>30 then
    raise exception 'Invalid installment markup';
  end if;

  if coalesce(p_installment_max_count,3)<2 or coalesce(p_installment_max_count,3)>3 then
    raise exception 'Installment count must be 2 or 3';
  end if;

  update public.academy_course_public_links
  set deposit_amount=0,
      installment_enabled=coalesce(p_installment_enabled,true),
      installment_markup_percent=coalesce(p_installment_markup_percent,5),
      installment_max_count=coalesce(p_installment_max_count,3),
      active=coalesce(p_active,true),
      updated_at=now()
  where course_id=p_course_id
  returning * into v_row;

  if v_row.id is null then
    perform public.academy_upsert_course_public_link(p_course_id,0,coalesce(p_active,true));
    update public.academy_course_public_links
    set deposit_amount=0,
        installment_enabled=coalesce(p_installment_enabled,true),
        installment_markup_percent=coalesce(p_installment_markup_percent,5),
        installment_max_count=coalesce(p_installment_max_count,3),
        active=coalesce(p_active,true),
        updated_at=now()
    where course_id=p_course_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'course_id',v_row.course_id,
    'slug',v_row.slug,
    'active',v_row.active,
    'installment_enabled',v_row.installment_enabled,
    'installment_markup_percent',v_row.installment_markup_percent,
    'installment_max_count',v_row.installment_max_count
  );
end
$function$;

-- academy_set_staff_active
CREATE OR REPLACE FUNCTION public.academy_set_staff_active(p_user_id uuid, p_active boolean, p_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_caller text; v_target text;
begin
 select s.role into v_caller from public.academy_staff s where s.user_id=(select auth.uid()) and s.active=true and s.archived_at is null;
 if v_caller is distinct from 'owner' then raise exception 'Owner role required'; end if;
 select s.role into v_target from public.academy_staff s where s.user_id=p_user_id for update;
 if v_target is null then raise exception 'Staff not found'; end if;
 if p_user_id=(select auth.uid()) and p_active=false then raise exception 'Owner cannot disable own account'; end if;
 if v_target='owner' and p_user_id<>(select auth.uid()) then raise exception 'Cannot change another owner'; end if;
 if p_role is not null and p_role not in('manager','finance','registrar','teacher','viewer','owner') then raise exception 'Invalid role'; end if;
 update public.academy_staff set active=p_active,role=coalesce(p_role,role),updated_at=now() where user_id=p_user_id;
 return jsonb_build_object('user_id',p_user_id,'active',p_active,'role',coalesce(p_role,v_target));
end $function$;

-- academy_staff_purge_preview
CREATE OR REPLACE FUNCTION public.academy_staff_purge_preview(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text; v_target public.academy_staff%rowtype;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if v_role is distinct from 'owner' then raise exception 'Not authorized'; end if;
  if p_user_id=(select auth.uid()) then raise exception 'Cannot purge current owner'; end if;
  select * into v_target from public.academy_staff where user_id=p_user_id;
  if v_target.user_id is null then raise exception 'Staff not found'; end if;
  if v_target.role='owner' then raise exception 'Owner cannot be purged'; end if;

  return jsonb_build_object(
    'ok',true,'user_id',v_target.user_id,'full_name',v_target.full_name,'role',v_target.role,
    'linked_student',exists(select 1 from public.academy_students where user_id=p_user_id),
    'linked_guardian',exists(select 1 from public.academy_guardians where user_id=p_user_id),
    'course_count',(select count(*) from public.academy_courses where teacher_user_id=p_user_id),
    'contract_count',(select count(*) from public.academy_staff_contracts where staff_user_id=p_user_id),
    'task_count',(select count(*) from public.academy_teacher_course_tasks where teacher_user_id=p_user_id),
    'payout_name_count',(select count(*) from public.academy_teacher_payouts where teacher_name=v_target.full_name)
  );
end $function$;

-- academy_void_expense
CREATE OR REPLACE FUNCTION public.academy_void_expense(p_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text;
begin
 select s.role into v_role from public.academy_staff s where s.user_id=(select auth.uid()) and s.active=true and s.archived_at is null;
 if v_role is null or v_role not in('owner','manager','finance') then raise exception 'Not authorized'; end if;
 if coalesce(length(btrim(p_reason)),0)<3 then raise exception 'Void reason required'; end if;
 update public.academy_expenses set status='voided',voided_at=now(),voided_by=(select auth.uid()),void_reason=p_reason where id=p_id and status='posted';
 if not found then raise exception 'Expense not found or already voided'; end if;
 return jsonb_build_object('id',p_id,'status','voided');
end $function$;

-- academy_void_payment
CREATE OR REPLACE FUNCTION public.academy_void_payment(p_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text; v_p public.academy_payments%rowtype; r record; v_after bigint;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true and archived_at is null;
  if v_role is null or v_role not in('owner','manager','finance') then raise exception 'Not authorized'; end if;
  if coalesce(length(btrim(p_reason)),0)<3 then raise exception 'Void reason required'; end if;
  select * into v_p from public.academy_payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_p.status='voided' then raise exception 'Payment already voided'; end if;
  if exists(select 1 from public.academy_certificates c where c.enrollment_id=v_p.enrollment_id and c.status in('issued','delivered')) then
    raise exception 'Cannot void payment after certificate issuance';
  end if;
  for r in select * from public.academy_payment_allocations where payment_id=p_payment_id and status='posted' order by created_at for update
  loop
    update public.academy_installments set
      paid_amount=greatest(paid_amount-r.amount,0),
      status=case when greatest(paid_amount-r.amount,0)=0 then 'open' when greatest(paid_amount-r.amount,0)<amount then 'partial' else 'paid' end
    where id=r.installment_id returning paid_amount into v_after;
    update public.academy_payment_allocations set status='reversed',reversed_at=now() where id=r.id;
  end loop;
  update public.academy_payments set status='voided',voided_at=now(),voided_by=(select auth.uid()),void_reason=p_reason where id=p_payment_id;
  return jsonb_build_object('payment_id',p_payment_id,'status','voided');
end $function$;

-- academy_void_teacher_payout
CREATE OR REPLACE FUNCTION public.academy_void_teacher_payout(p_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text;
begin
 select s.role into v_role from public.academy_staff s where s.user_id=(select auth.uid()) and s.active=true and s.archived_at is null;
 if v_role is null or v_role not in('owner','manager','finance') then raise exception 'Not authorized'; end if;
 if coalesce(length(btrim(p_reason)),0)<3 then raise exception 'Void reason required'; end if;
 update public.academy_teacher_payouts set status='voided',voided_at=now(),voided_by=(select auth.uid()),void_reason=p_reason where id=p_id and status='posted';
 if not found then raise exception 'Payout not found or already voided'; end if;
 return jsonb_build_object('id',p_id,'status','voided');
end $function$;
