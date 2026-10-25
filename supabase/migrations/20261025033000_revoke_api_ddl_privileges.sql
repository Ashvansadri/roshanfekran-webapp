-- 2026-10-25: Remove RLS-bypassing DDL privileges from browser/API roles.
-- PostgreSQL TRUNCATE is not governed by row-level security. MAINTAIN,
-- TRIGGER and REFERENCES are also unnecessary for public API consumers.
-- No rows are read, changed, deleted, or reset by this migration.
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Stop tables subsequently created by the app migration owner from
-- inheriting these grants. Keep ordinary SELECT/INSERT/UPDATE/DELETE
-- privileges and all service_role privileges unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES
  FROM anon, authenticated;

-- Supabase-managed objects may be created as supabase_admin.
-- The SQL executor may not be a member of that role. In that case
-- leave its defaults unchanged and flag the manual administrator task.
DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM anon, authenticated';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'supabase_admin default ACL requires an authorized administrator to revoke DDL grants';
END $$;
COMMIT;
