-- 2026-10-24: fail-closed authorization on three owner-only RPCs
-- and teacher course assignment guard. This changes function bodies only.
-- No table rows, function signatures, privileges, or Floot routes are modified.
DO $patch$
DECLARE
  item record;
  v_oid oid;
  v_def text;
  v_new text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('academy_purge_staff_data', 'if v_role<>''owner'' then', 'if v_role is distinct from ''owner'' then'),
      ('academy_staff_purge_preview', 'if v_role<>''owner'' then', 'if v_role is distinct from ''owner'' then'),
      ('academy_set_staff_active', 'if v_caller<>''owner'' then', 'if v_caller is distinct from ''owner'' then'),
      ('academy_ensure_checkpoint_quiz', 'and teacher_id<>auth.uid() then', 'and teacher_id is distinct from auth.uid() then')
    ) AS t(name, old_guard, safe_guard)
  LOOP
    SELECT p.oid INTO STRICT v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=item.name AND p.prosecdef;
    v_def := pg_get_functiondef(v_oid);
    IF (length(v_def)-length(replace(v_def,item.old_guard,'')))/length(item.old_guard) <> 1 THEN
      RAISE EXCEPTION 'Unexpected authorization guard in %; migration aborted',item.name;
    END IF;
    v_new := replace(v_def,item.old_guard,item.safe_guard);
    EXECUTE v_new;
  END LOOP;
END $patch$;
