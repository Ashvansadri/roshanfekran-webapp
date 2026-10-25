-- Read-only validation: both result sets must show zero active unsafe grants.
-- Test actual effective permissions (including inherited grants and PUBLIC).
SELECT r.rolname AS api_role, p.privilege,
       count(*) FILTER (WHERE has_table_privilege(r.rolname, c.oid, p.privilege)) AS tables_with_privilege
FROM pg_roles r
CROSS JOIN (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND r.rolname IN ('anon','authenticated')
GROUP BY r.rolname,p.privilege
ORDER BY r.rolname,p.privilege;

-- Future table defaults: any rows here are still unsafe and require an
-- authorized owner (typically supabase_admin) to update default ACLs.
SELECT pg_get_userbyid(d.defaclrole) AS creating_role,
       n.nspname AS schema_name,
       grantee::regrole::text AS api_role,
       privilege_type
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE n.nspname='public' AND d.defaclobjtype='r'
  AND grantee::regrole::text IN ('anon','authenticated')
  AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
ORDER BY 1,3,4;
