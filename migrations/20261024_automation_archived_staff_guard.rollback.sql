-- Emergency rollback only: restores the prior guard; reopens archived-staff access.
-- Do not execute unless reverting the security change is specifically required.
BEGIN;
DO $rollback$
DECLARE v_name text; v_oid oid; v_definition text;
  v_old constant text := 'where user_id=(select auth.uid()) and active=true and archived_at is null;';
  v_new constant text := 'where user_id=(select auth.uid()) and active=true;';
BEGIN
  FOREACH v_name IN ARRAY ARRAY['academy_build_automation_queue','academy_complete_automation_job'] LOOP
    SELECT p.oid INTO STRICT v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=v_name AND p.prosecdef;
    v_definition := pg_get_functiondef(v_oid);
    IF (length(v_definition)-length(replace(v_definition,v_old,''))) / length(v_old) <> 1
      THEN RAISE EXCEPTION 'Guard drift in %, rollback aborted',v_name; END IF;
    EXECUTE replace(v_definition,v_old,v_new);
  END LOOP;
END
$rollback$;
COMMIT;
