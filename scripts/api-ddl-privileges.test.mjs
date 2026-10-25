import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261025033000_revoke_api_ddl_privileges.sql', 'utf8');
const validation = readFileSync('supabase/validation/20261025033000_api_ddl_privileges_check.sql', 'utf8');
const rollback = readFileSync('supabase/rollback/20261025033000_api_ddl_privileges_manual.sql', 'utf8');

assert.match(migration, /REVOKE\s+TRUNCATE,\s*REFERENCES,\s*TRIGGER,\s*MAINTAIN\s+ON ALL TABLES IN SCHEMA public FROM anon, authenticated/i);
assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/i);
assert.match(migration, /supabase_admin/i);
assert.match(validation, /has_table_privilege\(/);
assert.match(validation, /aclexplode\(/);
assert.match(rollback, /MANUAL EMERGENCY ROLLBACK ONLY/);
assert.doesNotMatch(migration, /^\s*GRANT\s+TRUNCATE/gim);
console.log('DDL privilege hardening migration and read-only validation: PASS');
