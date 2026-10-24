-- Additive attendance APIs. No changes to existing student, class or financial rows.
-- SECURITY DEFINER functions return only authorized class roster fields.
CREATE OR REPLACE FUNCTION public.academy_attendance_roster(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid; v_role text; v_course uuid; v_teacher uuid; v_published boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT st.role INTO v_role FROM public.academy_staff st
    WHERE st.user_id = v_uid AND st.active IS TRUE AND st.archived_at IS NULL LIMIT 1;
  SELECT cl.course_id,c.teacher_user_id,cl.published
    INTO v_course,v_teacher,v_published
    FROM public.academy_classes cl JOIN public.academy_courses c ON c.id=cl.course_id
    WHERE cl.id=p_class_id AND c.archived_at IS NULL;
  IF v_course IS NULL THEN RAISE EXCEPTION 'CLASS_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF NOT (v_role IN ('owner','manager') OR (v_role='teacher' AND v_teacher=v_uid))
    THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_published IS NOT TRUE THEN RAISE EXCEPTION 'CLASS_NOT_PUBLISHED' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('class_id',p_class_id,'course_id',v_course,'roster',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'student_id',s.id,'name',s.full_name,'status',a.status,
        'note',a.note,'marked_at',a.marked_at) ORDER BY s.full_name)
      FROM public.academy_enrollments e
      JOIN public.academy_students s ON s.id=e.student_id
      LEFT JOIN public.academy_attendance a ON a.class_id=p_class_id AND a.student_id=s.id
      WHERE e.course_id=v_course AND e.status IN ('active','completed')
        AND s.archived_at IS NULL AND s.status <> 'archived'
    ),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.academy_mark_class_attendance(
  p_class_id uuid,p_student_id uuid,p_status text,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid; v_role text; v_course uuid; v_teacher uuid; v_published boolean;
        v_start timestamptz; v_class_status text; v_out jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT st.role INTO v_role FROM public.academy_staff st
    WHERE st.user_id=v_uid AND st.active IS TRUE AND st.archived_at IS NULL LIMIT 1;
  SELECT cl.course_id,c.teacher_user_id,cl.published,cl.starts_at,cl.status
    INTO v_course,v_teacher,v_published,v_start,v_class_status
    FROM public.academy_classes cl JOIN public.academy_courses c ON c.id=cl.course_id
    WHERE cl.id=p_class_id AND c.archived_at IS NULL;
  IF v_course IS NULL THEN RAISE EXCEPTION 'CLASS_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  IF NOT (v_role IN ('owner','manager') OR (v_role='teacher' AND v_teacher=v_uid))
    THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_published IS NOT TRUE OR v_class_status NOT IN ('scheduled','completed')
     OR v_start > now() THEN
    RAISE EXCEPTION 'CLASS_NOT_READY' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('present','absent','late','excused')
     OR length(btrim(COALESCE(p_note,'')))>250 THEN
    RAISE EXCEPTION 'INVALID_ATTENDANCE' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.academy_enrollments e
    JOIN public.academy_students s ON s.id=e.student_id
    WHERE e.student_id=p_student_id AND e.course_id=v_course
      AND e.status IN ('active','completed') AND s.archived_at IS NULL AND s.status<>'archived'
  ) THEN RAISE EXCEPTION 'STUDENT_NOT_ENROLLED' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.academy_attendance AS a
    (class_id,student_id,status,note,marked_by,marked_at)
  VALUES (p_class_id,p_student_id,p_status,NULLIF(btrim(COALESCE(p_note,'')),''),v_uid,now())
  ON CONFLICT (class_id,student_id) DO UPDATE
    SET status=EXCLUDED.status,note=EXCLUDED.note,marked_by=v_uid,marked_at=now()
  RETURNING jsonb_build_object('id',a.id,'class_id',a.class_id,
    'student_id',a.student_id,'status',a.status,'note',a.note,'marked_at',a.marked_at)
    INTO v_out;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.academy_attendance_roster(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.academy_mark_class_attendance(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_attendance_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_mark_class_attendance(uuid,uuid,text,text) TO authenticated;
