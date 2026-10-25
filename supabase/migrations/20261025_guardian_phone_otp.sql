-- Roshanfekran: opt-in guardian phone access, email remains supported.
-- Safe to apply without resetting existing accounts, students, guardian links or enrolments.
-- A guardian cannot see any student data until SMS proves ownership of the verified mobile.
BEGIN;
ALTER TABLE public.academy_guardians ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS academy_guardian_verified_mobile_uniq
 ON public.academy_guardians(mobile) WHERE mobile IS NOT NULL AND mobile LIKE '+989%';
CREATE OR REPLACE FUNCTION public.academy_guardian_phone_invite(
  p_student_id uuid, p_phone text, p_full_name text, p_relationship text DEFAULT 'guardian'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE v_admin boolean; v_student record; v_guardian uuid; v_phone text; v_d text; v_role text;
BEGIN
 v_admin:=EXISTS (
  SELECT 1 FROM public.academy_staff st
  WHERE st.user_id=(SELECT auth.uid()) AND st.active
    AND st.archived_at IS NULL AND st.role IN ('owner','manager')
 );
 IF NOT v_admin THEN RAISE EXCEPTION 'ROLE_NOT_ALLOWED' USING ERRCODE='42501'; END IF;
 SELECT id,full_name,archived_at,status INTO v_student
 FROM public.academy_students WHERE id=p_student_id FOR SHARE;
 IF NOT FOUND OR v_student.archived_at IS NOT NULL OR v_student.status='archived'
 THEN RAISE EXCEPTION 'STUDENT_NOT_ACTIVE'; END IF;
 IF length(btrim(coalesce(p_full_name,'')))<3 OR length(btrim(p_full_name))>90
 THEN RAISE EXCEPTION 'GUARDIAN_NAME_REQUIRED'; END IF;
 v_role:=lower(btrim(coalesce(p_relationship,'guardian')));
 IF v_role NOT IN ('father','mother','guardian') THEN RAISE EXCEPTION 'RELATIONSHIP_NOT_ALLOWED'; END IF;
 v_d:=translate(coalesce(p_phone,''),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789');
 v_d:=regexp_replace(v_d,'[^0-9]','','g');
 IF v_d ~ '^09[0-9]{9}$' THEN v_phone:='+98'||substr(v_d,2);
 ELSIF v_d ~ '^989[0-9]{9}$' THEN v_phone:='+'||v_d;
 ELSE RAISE EXCEPTION 'PHONE_MUST_BE_IRAN_MOBILE'; END IF;
 SELECT id INTO v_guardian FROM public.academy_guardians
 WHERE mobile=v_phone FOR UPDATE;
 IF v_guardian IS NULL THEN
  INSERT INTO public.academy_guardians(full_name,email,mobile,active)
  VALUES(btrim(p_full_name),NULL,v_phone,true) RETURNING id INTO v_guardian;
 ELSE
  UPDATE public.academy_guardians SET full_name=btrim(p_full_name),active=true
  WHERE id=v_guardian;
 END IF;
 INSERT INTO public.academy_guardian_students
  (guardian_id,student_id,relationship,can_view_academic,can_view_attendance,can_view_finance,can_receive_notifications)
 VALUES(v_guardian,p_student_id,v_role,true,true,false,true)
 ON CONFLICT(guardian_id,student_id) DO UPDATE SET
  relationship=EXCLUDED.relationship,
  can_view_academic=true,can_view_attendance=true,
  can_view_finance=false,can_receive_notifications=true;
 RETURN jsonb_build_object('ok',true,'student_id',p_student_id,
  'phone_masked',left(v_phone,5)||'••••'||right(v_phone,2),'invitation_status','awaiting_phone_verification');
END $body$;
REVOKE ALL ON FUNCTION public.academy_guardian_phone_invite(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_guardian_phone_invite(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.academy_guardian_phone_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_phone text; v_user uuid; v_guardian uuid; v_existing uuid;
BEGIN
 v_user:=auth.uid();
 IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 SELECT phone INTO v_phone FROM auth.users
 WHERE id=v_user AND phone_confirmed_at IS NOT NULL AND phone ~ '^\+989[0-9]{9}$';
 IF v_phone IS NULL THEN RAISE EXCEPTION 'PHONE_NOT_VERIFIED' USING ERRCODE='42501'; END IF;
 SELECT id,user_id INTO v_guardian,v_existing FROM public.academy_guardians
 WHERE mobile=v_phone AND active FOR UPDATE;
 IF v_guardian IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.academy_guardian_students gl JOIN public.academy_students st ON st.id=gl.student_id
   WHERE gl.guardian_id=v_guardian AND st.archived_at IS NULL AND gl.can_view_academic=true
 ) THEN RAISE EXCEPTION 'NO_APPROVED_GUARDIAN_INVITE' USING ERRCODE='42501'; END IF;
 IF v_existing IS NOT NULL AND v_existing<>v_user
 THEN RAISE EXCEPTION 'GUARDIAN_ALREADY_LINKED' USING ERRCODE='42501'; END IF;
 UPDATE public.academy_guardians SET user_id=v_user WHERE id=v_guardian;
 RETURN jsonb_build_object('ok',true,'guardian_id',v_guardian);
END $body$;
REVOKE ALL ON FUNCTION public.academy_guardian_phone_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_guardian_phone_claim() TO authenticated;

CREATE TABLE IF NOT EXISTS private.academy_guardian_phone_otp_limits(
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_guardian_phone_otp_fingerprint CHECK(fingerprint~'^[0-9a-f]{64}$')
);
REVOKE ALL ON TABLE private.academy_guardian_phone_otp_limits FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS academy_guardian_phone_otp_limits_idx
 ON private.academy_guardian_phone_otp_limits(fingerprint,created_at DESC);
CREATE OR REPLACE FUNCTION private.academy_guardian_otp_consume(p_fingerprint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_count integer;v_last timestamptz;
BEGIN
 IF coalesce(p_fingerprint,'') !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_fingerprint,0));
 SELECT count(*),max(created_at) INTO v_count,v_last
 FROM private.academy_guardian_phone_otp_limits
 WHERE fingerprint=p_fingerprint AND created_at>now()-interval '1 hour';
 IF v_count>=5 OR (v_last IS NOT NULL AND v_last>now()-interval '60 seconds')
 THEN RETURN false; END IF;
 INSERT INTO private.academy_guardian_phone_otp_limits(fingerprint) VALUES(p_fingerprint);
 RETURN true;
END $body$;
REVOKE ALL ON FUNCTION private.academy_guardian_otp_consume(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.academy_guardian_otp_consume(text) TO service_role;

CREATE OR REPLACE FUNCTION public.academy_guardian_otp_consume(p_fingerprint text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=''
AS $fn$ SELECT private.academy_guardian_otp_consume(p_fingerprint); $fn$;
REVOKE ALL ON FUNCTION public.academy_guardian_otp_consume(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.academy_guardian_otp_consume(text) TO service_role;
COMMIT;