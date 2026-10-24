-- EMERGENCY ROLLBACK ONLY. Reintroduces known archived teacher/staff authorization weaknesses.
-- Re-review access control before running. Never run automatically.

-- RESTORE: private.academy_teacher_has_course
CREATE OR REPLACE FUNCTION private.academy_teacher_has_course(p_course_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists(select 1 from public.academy_courses c join public.academy_staff st on st.user_id=(select auth.uid()) and st.active=true and st.role='teacher' where c.id=p_course_id and c.teacher_user_id=st.user_id)
$function$;

-- RESTORE: public.academy_delete_quiz_question
CREATE OR REPLACE FUNCTION public.academy_delete_quiz_question(p_assessment_id uuid, p_question_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_course uuid; v_total numeric;
begin
  select s.role into v_role from public.academy_staff s
  where s.user_id=(select auth.uid()) and s.active=true;
  select a.course_id into v_course from public.academy_assessments a
  where a.id=p_assessment_id and a.assessment_type='quiz';
  if v_course is null then raise exception 'Quiz assessment not found'; end if;
  if not (
    coalesce(v_role, '') in ('owner','manager') or exists(
      select 1 from public.academy_courses c
      where c.id=v_course and c.teacher_user_id=(select auth.uid())
    )
  ) then raise exception 'Not authorized'; end if;

  delete from public.academy_quiz_questions
  where id=p_question_id and assessment_id=p_assessment_id;

  select coalesce(sum(points),0) into v_total
  from public.academy_quiz_questions where assessment_id=p_assessment_id;
  update public.academy_assessments set max_score=v_total,updated_at=now() where id=p_assessment_id;

  return jsonb_build_object('ok',true,'max_score',v_total);
end $function$;

-- RESTORE: public.academy_finalize_course_completion
CREATE OR REPLACE FUNCTION public.academy_finalize_course_completion(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text; v_student uuid; v_course uuid; v_teacher uuid;
  v_assign numeric; v_assess numeric; v_att numeric;
  v_sum numeric:=0; v_weight numeric:=0; v_score numeric;
  v_points integer; v_discount numeric; v_reward uuid;
begin
  select role into v_role
  from public.academy_staff
  where user_id=(select auth.uid()) and active=true;

  select e.student_id,e.course_id,c.teacher_user_id
  into v_student,v_course,v_teacher
  from public.academy_enrollments e
  join public.academy_courses c on c.id=e.course_id
  where e.id=p_enrollment_id;

  if v_student is null then raise exception 'ثبت‌نام پیدا نشد'; end if;

  if not (coalesce(v_role, '') in ('owner','manager') or (coalesce(v_role, '')='teacher' and v_teacher=(select auth.uid()))) then
    raise exception 'دسترسی پایان دوره ندارید';
  end if;

  select avg((s.score/nullif(a.max_score,0))*100)
  into v_assign
  from public.academy_assignments a
  join public.academy_assignment_submissions s
    on s.assignment_id=a.id and s.student_id=v_student
  where a.course_id=v_course and a.published=true and s.score is not null;

  select avg((s.score/nullif(a.max_score,0))*100)
  into v_assess
  from public.academy_assessments a
  join public.academy_assessment_scores s
    on s.assessment_id=a.id and s.student_id=v_student
  where a.course_id=v_course and a.published=true and s.score is not null;

  select avg(case at.status
      when 'present' then 100
      when 'late' then 80
      when 'excused' then 90
      when 'absent' then 0
      else null end)
  into v_att
  from public.academy_classes cl
  join public.academy_attendance at
    on at.class_id=cl.id and at.student_id=v_student
  where cl.course_id=v_course and cl.status='held';

  if v_assign is not null then v_sum:=v_sum+v_assign*40; v_weight:=v_weight+40; end if;
  if v_assess is not null then v_sum:=v_sum+v_assess*50; v_weight:=v_weight+50; end if;
  if v_att is not null then v_sum:=v_sum+v_att*10; v_weight:=v_weight+10; end if;

  update public.academy_enrollments
  set status='completed', completed_at=coalesce(completed_at,now())
  where id=p_enrollment_id;

  if v_weight=0 then
    return jsonb_build_object(
      'ok',true,
      'scored',false,
      'student_id',v_student,
      'course_id',v_course,
      'completion_score',null,
      'points',0,
      'next_course_discount_percent',0,
      'reward_id',null
    );
  end if;

  v_score:=round((v_sum/v_weight)::numeric,2);
  v_points:=greatest(0,least(100,round(v_score)::integer));
  v_discount:=case
    when v_score>=90 then 15
    when v_score>=80 then 10
    when v_score>=70 then 5
    else 0 end;

  insert into public.academy_student_rewards(
    student_id,course_id,kind,points,discount_percent,reason,status,expires_at,created_by
  )
  values(
    v_student,v_course,'next_course_discount',v_points,v_discount,
    'امتیاز پایان دوره: '||v_score||' از ۱۰۰',
    'earned',now()+interval '180 days',(select auth.uid())
  )
  on conflict(student_id,course_id,kind) where course_id is not null
  do update set
    points=excluded.points,
    discount_percent=excluded.discount_percent,
    reason=excluded.reason,
    status='earned',
    expires_at=excluded.expires_at,
    redeemed_at=null,
    created_by=excluded.created_by
  returning id into v_reward;

  return jsonb_build_object(
    'ok',true,
    'scored',true,
    'student_id',v_student,
    'course_id',v_course,
    'completion_score',v_score,
    'points',v_points,
    'next_course_discount_percent',v_discount,
    'reward_id',v_reward
  );
end
$function$;

-- RESTORE: public.academy_grade_assignment
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

-- RESTORE: public.academy_inspection_snapshot
CREATE OR REPLACE FUNCTION public.academy_inspection_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_teachers int; v_staff_contracts int;
  v_students int; v_student_contracts int; v_delivered_contracts int;
  v_classes int; v_attendance int; v_posted_payments int;
  v_fee_mismatch int; v_fee_missing int; v_fee_variation int;
  v_gender_missing int; v_student_gender_missing int; v_mixed_gender_courses int;
  v_safety_count int; v_safety_overdue int;
  v_equipment_count int; v_equipment_due int; v_computer_count int;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;

  select count(*) into v_teachers from public.academy_staff where role='teacher' and active=true and archived_at is null;
  select count(distinct staff_user_id) into v_staff_contracts from public.academy_staff_contracts where status='active' and (end_date is null or end_date>=current_date);
  select count(*) into v_students from public.academy_students where status<>'archived';
  select count(*) into v_student_gender_missing from public.academy_students where status<>'archived' and gender is null;
  select count(distinct student_id) into v_student_contracts from public.academy_student_contracts where status in ('active','completed');
  select count(distinct student_id) into v_delivered_contracts from public.academy_student_contracts where status in ('active','completed') and delivered_copy=true;
  select count(*) into v_classes from public.academy_classes where status in ('held','scheduled');
  select count(*) into v_attendance from public.academy_attendance;
  select count(*) into v_posted_payments from public.academy_payments where status='posted';

  select count(*) into v_fee_mismatch from public.academy_courses where status<>'archived' and official_fee is not null and base_fee<>official_fee;
  select count(*) into v_fee_missing from public.academy_courses where status='active' and official_fee is null;
  select count(*) into v_gender_missing from public.academy_courses where status='active' and gender_policy='not_set';

  select count(*) into v_mixed_gender_courses
  from (
    select e.course_id
    from public.academy_enrollments e
    join public.academy_students s on s.id=e.student_id
    where e.status in ('active','completed') and s.gender is not null
    group by e.course_id
    having count(distinct s.gender)>1
  ) x;

  select count(*) into v_fee_variation from (
    select e.course_id
    from public.academy_enrollments e
    where e.status in ('active','completed')
    group by e.course_id
    having count(distinct coalesce(e.final_fee,e.list_fee))>1
  ) x;

  select count(*) into v_safety_count from public.academy_equipment
   where status='active' and lower(category) in ('fire_extinguisher','first_aid');
  select count(*) into v_safety_overdue from public.academy_equipment
   where status='active' and lower(category) in ('fire_extinguisher','first_aid')
     and ((expires_at is not null and expires_at<current_date) or (next_check_at is not null and next_check_at<current_date));
  select coalesce(sum(quantity),0) into v_equipment_count from public.academy_equipment where status='active';
  select count(*) into v_equipment_due from public.academy_equipment
   where status='active' and ((expires_at is not null and expires_at<current_date) or (next_check_at is not null and next_check_at<current_date));
  select coalesce(sum(quantity),0) into v_computer_count from public.academy_equipment
   where status='active' and lower(category) in ('computer','laptop','pc');

  return jsonb_build_object(
    'teachers',v_teachers,'staff_with_active_contract',v_staff_contracts,
    'students',v_students,'students_with_contract',v_student_contracts,'students_with_delivered_contract',v_delivered_contracts,
    'classes',v_classes,'attendance_records',v_attendance,'posted_payments',v_posted_payments,
    'fee_mismatch_courses',v_fee_mismatch,'official_fee_missing_courses',v_fee_missing,'fee_variation_courses',v_fee_variation,
    'gender_policy_missing',v_gender_missing,'student_gender_missing',v_student_gender_missing,'mixed_gender_courses',v_mixed_gender_courses,
    'safety_items',v_safety_count,'safety_overdue',v_safety_overdue,
    'equipment_total',v_equipment_count,'equipment_due',v_equipment_due,'computer_count',v_computer_count
  );
end $function$;

-- RESTORE: public.academy_quiz_editor
CREATE OR REPLACE FUNCTION public.academy_quiz_editor(p_assessment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_course uuid; v_result jsonb;
begin
  select s.role into v_role from public.academy_staff s
  where s.user_id=(select auth.uid()) and s.active=true;
  select a.course_id into v_course from public.academy_assessments a
  where a.id=p_assessment_id and a.assessment_type='quiz';
  if v_course is null then raise exception 'Quiz assessment not found'; end if;
  if not (
    coalesce(v_role, '') in ('owner','manager') or exists(
      select 1 from public.academy_courses c
      where c.id=v_course and c.teacher_user_id=(select auth.uid())
    )
  ) then raise exception 'Not authorized'; end if;

  select jsonb_build_object(
    'assessment',jsonb_build_object(
      'id',a.id,'title',a.title,'max_score',a.max_score,
      'checkpoint_session',a.checkpoint_session,'due_at',a.due_at,'published',a.published
    ),
    'questions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',q.id,'prompt',q.prompt,'options',q.options,'points',q.points,
        'sort_order',q.sort_order,'correct_option',k.correct_option,'explanation',k.explanation
      ) order by q.sort_order)
      from public.academy_quiz_questions q
      join public.academy_quiz_answer_keys k on k.question_id=q.id
      where q.assessment_id=a.id
    ),'[]'::jsonb)
  ) into v_result
  from public.academy_assessments a where a.id=p_assessment_id;

  return v_result;
end $function$;

-- RESTORE: public.academy_set_assessment_score
CREATE OR REPLACE FUNCTION public.academy_set_assessment_score(p_assessment_id uuid, p_student_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_course uuid; v_max numeric; v_id uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true;
  select course_id,max_score into v_course,v_max from public.academy_assessments where id=p_assessment_id;
  if v_course is null then raise exception 'Assessment not found'; end if;
  if not exists(select 1 from public.academy_enrollments where student_id=p_student_id and course_id=v_course and status in ('active','completed')) then raise exception 'Student not enrolled'; end if;
  if not (coalesce(v_role, '') in ('owner','manager') or exists(select 1 from public.academy_courses c where c.id=v_course and c.teacher_user_id=(select auth.uid()))) then raise exception 'Not authorized'; end if;
  if p_score<0 or p_score>v_max then raise exception 'Invalid score'; end if;
  insert into public.academy_assessment_scores(assessment_id,student_id,score,feedback,graded_by,graded_at)
  values(p_assessment_id,p_student_id,p_score,nullif(btrim(coalesce(p_feedback,'')),''),(select auth.uid()),now())
  on conflict(assessment_id,student_id) do update
  set score=excluded.score,feedback=excluded.feedback,graded_by=(select auth.uid()),graded_at=now(),updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $function$;

-- RESTORE: public.academy_set_rubric_score
CREATE OR REPLACE FUNCTION public.academy_set_rubric_score(p_submission_id uuid, p_criterion_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_course uuid; v_max numeric; v_id uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true;
  select a.course_id,c.max_score into v_course,v_max
  from public.academy_assignment_submissions s
  join public.academy_assignments a on a.id=s.assignment_id
  join public.academy_assignment_rubric_criteria c on c.assignment_id=a.id and c.id=p_criterion_id
  where s.id=p_submission_id;
  if v_course is null then raise exception 'Rubric criterion not found'; end if;
  if not (coalesce(v_role, '') in ('owner','manager') or private.academy_teacher_has_course(v_course)) then raise exception 'Not authorized'; end if;
  if p_score<0 or p_score>v_max then raise exception 'Invalid rubric score'; end if;
  insert into public.academy_submission_rubric_scores(submission_id,criterion_id,score,feedback,graded_by,graded_at)
  values(p_submission_id,p_criterion_id,p_score,nullif(btrim(coalesce(p_feedback,'')),''),(select auth.uid()),now())
  on conflict(submission_id,criterion_id) do update set score=excluded.score,feedback=excluded.feedback,graded_by=(select auth.uid()),graded_at=now(),updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $function$;

-- RESTORE: public.academy_set_skill_level
CREATE OR REPLACE FUNCTION public.academy_set_skill_level(p_skill_id uuid, p_student_id uuid, p_level integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_course uuid; v_id uuid;
begin
  select role into v_role from public.academy_staff where user_id=(select auth.uid()) and active=true;
  select course_id into v_course from public.academy_course_skills where id=p_skill_id and active=true;
  if v_course is null then raise exception 'Skill not found'; end if;
  if not exists(select 1 from public.academy_enrollments where student_id=p_student_id and course_id=v_course and status in ('active','completed')) then raise exception 'Student not enrolled'; end if;
  if not (coalesce(v_role, '') in ('owner','manager') or exists(select 1 from public.academy_courses c where c.id=v_course and c.teacher_user_id=(select auth.uid()))) then raise exception 'Not authorized'; end if;
  if p_level<1 or p_level>5 then raise exception 'Invalid skill level'; end if;
  insert into public.academy_student_skill_scores(skill_id,student_id,level,note,evaluated_by,evaluated_at)
  values(p_skill_id,p_student_id,p_level,nullif(btrim(coalesce(p_note,'')),''),(select auth.uid()),now())
  on conflict(skill_id,student_id) do update
  set level=excluded.level,note=excluded.note,evaluated_by=(select auth.uid()),evaluated_at=now(),updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $function$;

-- RESTORE: public.academy_submit_payment
CREATE OR REPLACE FUNCTION public.academy_submit_payment(p_enrollment_id uuid, p_amount bigint, p_method text DEFAULT 'card_transfer'::text, p_reference_no text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_installment_id uuid DEFAULT NULL::uuid, p_receipt_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_student uuid; v_enroll_student uuid; v_balance bigint; v_inst_enrollment uuid; v_inst_remaining bigint; v_id uuid;
begin
  v_student:=private.academy_current_student_id();
  if v_student is null then raise exception 'Student portal access required'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Invalid amount'; end if;
  select student_id into v_enroll_student from public.academy_enrollments where id=p_enrollment_id;
  if v_enroll_student is null or v_enroll_student<>v_student then raise exception 'Enrollment not found'; end if;
  select coalesce(e.final_fee,0)-coalesce(sum(p.amount) filter(where p.status='posted'),0) into v_balance from public.academy_enrollments e left join public.academy_payments p on p.enrollment_id=e.id where e.id=p_enrollment_id group by e.final_fee;
  if p_amount>coalesce(v_balance,0) then raise exception 'Payment exceeds enrollment balance'; end if;
  if p_installment_id is not null then
    select enrollment_id,amount-paid_amount into v_inst_enrollment,v_inst_remaining from public.academy_installments where id=p_installment_id;
    if v_inst_enrollment is null or v_inst_enrollment<>p_enrollment_id then raise exception 'Installment does not belong to enrollment'; end if;
    if p_amount>v_inst_remaining then raise exception 'Payment exceeds installment balance'; end if;
  end if;
  insert into public.academy_payment_submissions(student_id,enrollment_id,installment_id,amount,method,reference_no,receipt_path,note,submitted_by)
  values(v_student,p_enrollment_id,p_installment_id,p_amount,coalesce(nullif(btrim(p_method),''),'card_transfer'),nullif(btrim(p_reference_no),''),nullif(btrim(p_receipt_path),''),nullif(btrim(p_note),''),(select auth.uid())) returning id into v_id;
  insert into public.academy_notifications(user_id,kind,title,body,due_at,related_type,related_id)
  select s.user_id,'payment_submission','پرداخت جدید هنرجو','یک پرداخت جدید توسط هنرجو ثبت شده و نیاز به بررسی دارد.',now(),'payment_submission',v_id from public.academy_staff s where s.active=true and s.role in('owner','manager','finance') on conflict do nothing;
  return jsonb_build_object('submission_id',v_id,'status','pending');
end$function$;

-- RESTORE: public.academy_update_registration_link
CREATE OR REPLACE FUNCTION public.academy_update_registration_link(p_link_id uuid, p_label text, p_course_id uuid DEFAULT NULL::uuid, p_max_uses integer DEFAULT NULL::integer, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_purpose_note text DEFAULT NULL::text, p_active boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_role text; v_row public.academy_self_registration_links%rowtype;
begin
  select role into v_role from public.academy_staff
  where user_id=(select auth.uid()) and active=true;
  if coalesce(v_role, '') not in ('owner','manager','registrar') then raise exception 'Not authorized'; end if;
  if nullif(btrim(coalesce(p_label,'')),'') is null then raise exception 'Label required'; end if;
  if p_course_id is not null and not exists(
    select 1 from public.academy_courses where id=p_course_id and status='active'
  ) then raise exception 'Active course not found'; end if;

  select * into v_row from public.academy_self_registration_links
  where id=p_link_id for update;
  if not found then raise exception 'Registration link not found'; end if;
  if p_max_uses is not null and p_max_uses < greatest(1,v_row.used_count) then
    raise exception 'Max uses cannot be less than used count';
  end if;

  update public.academy_self_registration_links
  set label=btrim(p_label),
      course_id=p_course_id,
      max_uses=p_max_uses,
      expires_at=p_expires_at,
      purpose_note=nullif(btrim(coalesce(p_purpose_note,'')),''),
      active=p_active,
      completed_at=case when p_active then null else coalesce(completed_at,now()) end,
      updated_at=now()
  where id=p_link_id
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,'id',v_row.id,'label',v_row.label,'course_id',v_row.course_id,
    'max_uses',v_row.max_uses,'used_count',v_row.used_count,'expires_at',v_row.expires_at,
    'purpose_note',v_row.purpose_note,'active',v_row.active
  );
end $function$;

-- RESTORE: public.academy_upsert_course_public_link
CREATE OR REPLACE FUNCTION public.academy_upsert_course_public_link(p_course_id uuid, p_deposit_amount bigint DEFAULT 0, p_active boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_row public.academy_course_public_links;
  v_fee bigint;
  v_code text;
  v_base_slug text;
  v_slug text;
  v_try integer := 0;
begin
  select role into v_role
  from public.academy_staff
  where user_id=(select auth.uid()) and active=true;

  if coalesce(v_role, '') not in ('owner','manager','registrar') then
    raise exception 'Not authorized';
  end if;

  select base_fee, code
    into v_fee, v_code
  from public.academy_courses
  where id=p_course_id and status<>'archived';

  if v_fee is null then raise exception 'Course not found'; end if;
  if coalesce(p_deposit_amount,0)<0 then raise exception 'Invalid deposit amount'; end if;
  if coalesce(p_deposit_amount,0)>v_fee then raise exception 'Deposit exceeds course fee'; end if;

  update public.academy_course_public_links
  set deposit_amount=coalesce(p_deposit_amount,0),
      active=coalesce(p_active,true),
      updated_at=now()
  where course_id=p_course_id
  returning * into v_row;

  if v_row.id is null then
    v_base_slug := 'course-' || regexp_replace(lower(coalesce(v_code,'')), '[^a-z0-9]+', '-', 'g');
    v_base_slug := trim(both '-' from v_base_slug);

    if v_base_slug is null or v_base_slug='' or v_base_slug='course' then
      v_base_slug := 'course-' || substr(replace(p_course_id::text,'-',''),1,8);
    end if;

    v_slug := v_base_slug;
    while exists(
      select 1
      from public.academy_course_public_links
      where slug=v_slug and course_id<>p_course_id
    ) loop
      v_try := v_try + 1;
      v_slug := v_base_slug || '-' || substr(md5(p_course_id::text || ':' || v_try::text),1,6);
    end loop;

    insert into public.academy_course_public_links(
      course_id, deposit_amount, active, created_by, slug
    )
    values(
      p_course_id,
      coalesce(p_deposit_amount,0),
      coalesce(p_active,true),
      (select auth.uid()),
      v_slug
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'course_id',v_row.course_id,
    'public_token',v_row.public_token,
    'slug',v_row.slug,
    'active',v_row.active,
    'deposit_amount',v_row.deposit_amount,
    'expires_at',v_row.expires_at
  );
end
$function$;

-- RESTORE: public.academy_upsert_quiz_question
CREATE OR REPLACE FUNCTION public.academy_upsert_quiz_question(p_assessment_id uuid, p_question_id uuid, p_prompt text, p_options jsonb, p_correct_option integer, p_points numeric DEFAULT 10, p_explanation text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text; v_course uuid; v_type text; v_id uuid; v_count integer; v_sort integer; v_total numeric;
begin
  select s.role into v_role from public.academy_staff s
  where s.user_id=(select auth.uid()) and s.active=true;

  select a.course_id,a.assessment_type into v_course,v_type
  from public.academy_assessments a where a.id=p_assessment_id;
  if v_course is null or v_type<>'quiz' then raise exception 'Quiz assessment not found'; end if;
  if not (
    coalesce(v_role, '') in ('owner','manager') or exists(
      select 1 from public.academy_courses c
      where c.id=v_course and c.teacher_user_id=(select auth.uid())
    )
  ) then raise exception 'Not authorized'; end if;

  if length(btrim(coalesce(p_prompt,'')))<3 then raise exception 'Question prompt required'; end if;
  if jsonb_typeof(p_options)<>'array' then raise exception 'Options must be an array'; end if;
  v_count:=jsonb_array_length(p_options);
  if v_count<2 or v_count>8 then raise exception 'Quiz question must have 2 to 8 options'; end if;
  if p_correct_option<0 or p_correct_option>=v_count then raise exception 'Correct option is invalid'; end if;
  if p_points<=0 or p_points>100 then raise exception 'Question points are invalid'; end if;

  if p_question_id is null then
    select coalesce(max(q.sort_order),0)+1 into v_sort
    from public.academy_quiz_questions q where q.assessment_id=p_assessment_id;
    insert into public.academy_quiz_questions(
      assessment_id,prompt,options,points,sort_order,created_by
    ) values(
      p_assessment_id,btrim(p_prompt),p_options,p_points,v_sort,(select auth.uid())
    ) returning id into v_id;
  else
    update public.academy_quiz_questions
    set prompt=btrim(p_prompt),options=p_options,points=p_points,updated_at=now()
    where id=p_question_id and assessment_id=p_assessment_id
    returning id into v_id;
    if v_id is null then raise exception 'Question not found'; end if;
  end if;

  insert into public.academy_quiz_answer_keys(question_id,correct_option,explanation,updated_at)
  values(v_id,p_correct_option,nullif(btrim(coalesce(p_explanation,'')),''),now())
  on conflict(question_id) do update
  set correct_option=excluded.correct_option,explanation=excluded.explanation,updated_at=now();

  select coalesce(sum(points),0) into v_total
  from public.academy_quiz_questions where assessment_id=p_assessment_id;
  update public.academy_assessments set max_score=v_total,updated_at=now() where id=p_assessment_id;

  return jsonb_build_object('ok',true,'question_id',v_id,'max_score',v_total);
end $function$;
