-- Read-only verification; never invoke staff-purge or mutation RPCs as a test.
WITH expected(name, guard) AS (
  VALUES
  ('academy_purge_staff_data','if v_role is distinct from ''owner'' then'),
  ('academy_staff_purge_preview','if v_role is distinct from ''owner'' then'),
  ('academy_set_staff_active','if v_caller is distinct from ''owner'' then'),
  ('academy_ensure_checkpoint_quiz','and teacher_id is distinct from auth.uid() then')
), checked AS (
  SELECT e.name,
    count(p.oid)=1 AS exists_once,
    coalesce(bool_and(strpos(pg_get_functiondef(p.oid),e.guard)>0),false) AS guard_fixed,
    coalesce(bool_and(p.prosecdef),false) AS security_definer_preserved
  FROM expected e
  LEFT JOIN pg_proc p ON p.proname=e.name
  LEFT JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
  WHERE n.nspname='public'
  GROUP BY e.name
)
SELECT * FROM checked ORDER BY name;

-- NULL role / unassigned teacher must deny. Owner and assigned teacher remain valid.
SELECT
  (NULL::text IS DISTINCT FROM 'owner') AS missing_owner_denied,
  NOT ('owner'::text IS DISTINCT FROM 'owner') AS real_owner_allowed,
  (NULL::uuid IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid) AS unassigned_teacher_denied,
  NOT ('11111111-1111-1111-1111-111111111111'::uuid IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid) AS assigned_teacher_allowed;
