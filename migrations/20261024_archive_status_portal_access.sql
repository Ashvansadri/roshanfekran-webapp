-- 2026-10-24: archived student must never retain portal, parent or public resume access.
-- Legacy records can have status='archived' while archived_at IS NULL.
-- Fail closed on EITHER archived marker, without deleting/updating any rows.
BEGIN;
DO $harden$
DECLARE
  item record;
  v_oid oid;
  v_def text;
  v_matches integer;
  v_policy text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('private','academy_current_student_id',
     'and s.portal_enabled=true limit 1',
     'and s.portal_enabled=true and s.archived_at is null and s.status is distinct from ''archived'' limit 1'),
    ('public','academy_student_journey_snapshot',
     'AND portal_enabled=true LIMIT 1',
     'AND portal_enabled=true AND archived_at IS NULL AND status IS DISTINCT FROM ''archived'' LIMIT 1'),
    ('public','academy_parent_journey_snapshot',
     'AND s.archived_at IS NULL;',
     'AND s.archived_at IS NULL AND s.status IS DISTINCT FROM ''archived'';'),
    ('public','academy_parent_portal_snapshot',
     E'and s.archived_at is null\n',
     E'and s.archived_at is null and s.status is distinct from ''archived''\n'),
    ('public','academy_shared_showcase',
     'and portal_enabled=true and archived_at is null;',
     'and portal_enabled=true and archived_at is null and status is distinct from ''archived'';')
  ) AS t(schema_name, function_name, old_guard, safe_guard)
  LOOP
    SELECT p.oid INTO STRICT v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=item.schema_name AND p.proname=item.function_name AND p.prosecdef;
    v_def := pg_get_functiondef(v_oid);
    v_matches := (length(v_def)-length(replace(v_def,item.old_guard,'')))/length(item.old_guard);
    IF v_matches <> 1 THEN
      RAISE EXCEPTION 'Expected one original archive guard in %.%; got %',
        item.schema_name,item.function_name,v_matches;
    END IF;
    EXECUTE replace(v_def,item.old_guard,item.safe_guard);
  END LOOP;

  SELECT qual INTO STRICT v_policy FROM pg_policies
  WHERE schemaname='public' AND tablename='academy_students'
    AND policyname='academy_students_self_portal_read' AND cmd='SELECT';
  IF position('portal_enabled' IN v_policy)=0
     OR position('archived_at' IN v_policy)>0 THEN
    RAISE EXCEPTION 'Unexpected student self-read policy; aborting';
  END IF;
  ALTER POLICY academy_students_self_portal_read ON public.academy_students
    USING ((user_id=(SELECT auth.uid())) AND portal_enabled=true
           AND archived_at IS NULL AND status IS DISTINCT FROM 'archived');
END $harden$;
COMMIT;
