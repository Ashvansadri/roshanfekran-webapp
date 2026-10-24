-- Read-only verification; no student data is modified.
DO $$
DECLARE v_role text; v_priv text; v_name text;
BEGIN
 FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH v_priv IN ARRAY ARRAY['INSERT','UPDATE','TRUNCATE','TRIGGER','REFERENCES'] LOOP
   IF has_table_privilege(v_role,'public.academy_assignment_submissions',v_priv) THEN
    RAISE EXCEPTION 'Unsafe assignment submissions privilege: % %',v_role,v_priv;
   END IF;
  END LOOP;
 END LOOP;
 IF NOT has_table_privilege('authenticated','public.academy_assignment_submissions','SELECT') THEN
  RAISE EXCEPTION 'Student/teacher read access unexpectedly removed';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
   AND tablename='academy_assignment_submissions'
   AND policyname IN ('academy_submissions_insert','academy_submissions_update')) THEN
  RAISE EXCEPTION 'Unsafe direct write policies still present';
 END IF;
 FOREACH v_name IN ARRAY ARRAY[
  'academy_submit_assignment','academy_submit_assignment_with_file','academy_grade_assignment'
 ] LOOP
  IF NOT EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=v_name AND p.prosecdef
     AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) THEN
   RAISE EXCEPTION 'Required authorized RPC unavailable: %',v_name;
  END IF;
 END LOOP;
END $$;
