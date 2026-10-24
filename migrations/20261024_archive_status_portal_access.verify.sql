-- Read-only verification after archive-access hardening.
DO $verify$
DECLARE
  item record;
  v_oid oid;
  v_def text;
  v_qual text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private','academy_current_student_id'),
    ('public','academy_student_journey_snapshot'),
    ('public','academy_parent_journey_snapshot'),
    ('public','academy_parent_portal_snapshot'),
    ('public','academy_shared_showcase')
  ) AS t(schema_name,function_name)
  LOOP
    SELECT p.oid INTO STRICT v_oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=item.schema_name AND p.proname=item.function_name AND p.prosecdef;
    v_def := lower(pg_get_functiondef(v_oid));
    IF position('archived_at is null' IN v_def)=0
       OR position('status is distinct from ''archived''' IN v_def)=0 THEN
      RAISE EXCEPTION 'Archive fail-closed guard missing in %.%',item.schema_name,item.function_name;
    END IF;
  END LOOP;
  SELECT lower(qual) INTO STRICT v_qual FROM pg_policies
  WHERE schemaname='public' AND tablename='academy_students'
    AND policyname='academy_students_self_portal_read' AND cmd='SELECT';
  IF position('archived_at is null' IN v_qual)=0
     OR position('status is distinct from ''archived''' IN v_qual)=0 THEN
    RAISE EXCEPTION 'Student self-read RLS is not archive-safe';
  END IF;
END $verify$;
SELECT status,portal_enabled,archived_at IS NOT NULL AS has_archived_at,count(*)
FROM public.academy_students GROUP BY 1,2,3 ORDER BY 1,2,3;
