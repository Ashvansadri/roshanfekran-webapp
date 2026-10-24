-- Expected: RLS enabled, not forced, zero policies, no anon/authenticated table grants.
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
 (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_direct,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_direct
FROM pg_class c WHERE c.oid='public.academy_public_ai_quota'::regclass;
