-- Prevent linked guardians from using archived student records in privileged RPCs.
-- Non-destructive: changes only function definitions; keeps grants and data unchanged.
CREATE OR REPLACE FUNCTION public.academy_consent_showcase(p_student_id uuid, p_allow boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.academy_guardians g
    JOIN public.academy_guardian_students gs ON gs.guardian_id = g.id
    JOIN public.academy_students s ON s.id = gs.student_id
    WHERE gs.student_id = p_student_id
      AND g.user_id = uid
      AND g.active = true
      AND gs.can_view_academic = true
      AND gs.relationship IN ('father','mother','parent','guardian')
      AND s.archived_at IS NULL
      AND s.status IS DISTINCT FROM 'archived'
  ) THEN
    RAISE EXCEPTION 'Linked guardian sign-in required for active student';
  END IF;

  INSERT INTO public.academy_showcase_profiles(student_id, guardian_consent_by, guardian_consented_at)
  VALUES(p_student_id, CASE WHEN p_allow THEN uid ELSE NULL END,
         CASE WHEN p_allow THEN now() ELSE NULL END)
  ON CONFLICT(student_id) DO UPDATE
    SET guardian_consent_by = excluded.guardian_consent_by,
        guardian_consented_at = excluded.guardian_consented_at,
        share_enabled = CASE WHEN p_allow THEN academy_showcase_profiles.share_enabled ELSE false END,
        updated_at = now();
  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.academy_family_tip_today()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_tip public.academy_family_micro_lessons%ROWTYPE; v_day integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.academy_guardians g
    JOIN public.academy_guardian_students gs ON gs.guardian_id = g.id
    JOIN public.academy_students s ON s.id = gs.student_id
    WHERE g.user_id = auth.uid()
      AND g.active = true
      AND gs.can_view_academic = true
      AND s.archived_at IS NULL
      AND s.status IS DISTINCT FROM 'archived'
  ) THEN
    RAISE EXCEPTION 'Active parent account with active student required';
  END IF;

  v_day := (('2026-10-20'::date - '2026-10-20'::date)
       + (((now() AT TIME ZONE 'Asia/Tehran')::date-'2026-10-20'::date) % 30 + 30) % 30) + 1;
  SELECT * INTO v_tip FROM public.academy_family_micro_lessons WHERE day_no = v_day;
  IF NOT FOUND THEN RAISE EXCEPTION 'Daily lesson unavailable'; END IF;
  RETURN jsonb_build_object('day_no',v_tip.day_no,'title',v_tip.title,
    'explanation',v_tip.explanation,'exercise',v_tip.exercise,
    'safety_note',v_tip.safety_note,'theme',v_tip.theme,
    'time_needed_minutes',3,'route','/courses',
    'invitation','اگر این تمرین برایتان جالب بود، یادگیری هوش مصنوعی از قدم‌های ساده شروع می‌شود.');
END
$function$;
