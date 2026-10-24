-- Emergency compatibility rollback ONLY after an explicit access review.
-- Restores the two viewer RPC allowances removed in
-- 20261024_harden_viewer_definer_rpcs.sql; it does NOT change RLS policies.
BEGIN;
DO $rollback$
DECLARE
  v_def text;
  v_old text;
  v_new text;
  v_oid oid;
BEGIN
  SELECT p.oid INTO STRICT v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='academy_inspection_snapshot'
    AND p.pronargs=0 AND p.prosecdef;
  v_def := pg_get_functiondef(v_oid);
  v_old := 'if v_role not in (''owner'',''manager'',''registrar'') then raise exception ''Not authorized''; end if;';
  v_new := 'if v_role not in (''owner'',''manager'',''registrar'',''viewer'') then raise exception ''Not authorized''; end if;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'Unexpected inspection_snapshot authorization guard'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT p.oid INTO STRICT v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='academy_list_student_risk'
    AND p.pronargs=0 AND p.prosecdef;
  v_def := pg_get_functiondef(v_oid);
  v_old := 'if v_role not in (''owner'',''manager'',''registrar'',''finance'') then raise exception ''Not authorized''; end if;';
  v_new := 'if v_role not in (''owner'',''manager'',''registrar'',''finance'',''viewer'') then raise exception ''Not authorized''; end if;';
  IF position(v_old IN v_def)=0 THEN RAISE EXCEPTION 'Unexpected list_student_risk authorization guard'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END
$rollback$;
COMMIT;
