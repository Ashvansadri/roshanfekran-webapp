import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../migrations/20261025_assignment_submission_integrity.sql',import.meta.url),'utf8');
const verify=readFileSync(new URL('../migrations/20261025_assignment_submission_integrity.verify.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../migrations/20261025_assignment_submission_integrity.rollback.sql',import.meta.url),'utf8');
const gateway=readFileSync(new URL('../supabase/functions/academy-gateway/index.ts',import.meta.url),'utf8');
const portal=readFileSync(new URL('../site/portal.js',import.meta.url),'utf8');
const ops=readFileSync(new URL('../site/academy-ops.js',import.meta.url),'utf8');
assert.match(migration,/REVOKE INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES\s+ON TABLE public\.academy_assignment_submissions FROM authenticated/i);
assert.match(migration,/REVOKE INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES\s+ON TABLE public\.academy_assignment_submissions FROM anon/i);
for(const policy of ['academy_submissions_insert','academy_submissions_update'])
 assert(migration.includes('DROP POLICY IF EXISTS '+policy),'unsafe policy not dropped: '+policy);
for(const privilege of ['INSERT','UPDATE','TRUNCATE','TRIGGER','REFERENCES'])
 assert(verify.includes("'"+privilege+"'"),'missing privilege verification: '+privilege);
for(const rpc of ['academy_submit_assignment','academy_submit_assignment_with_file','academy_grade_assignment'])
 assert(verify.includes("'"+rpc+"'"),'required RPC must be verified: '+rpc);
assert(verify.includes("has_table_privilege('authenticated','public.academy_assignment_submissions','SELECT')"));
assert(rollback.includes('EMERGENCY ONLY'));
assert(portal.includes('academy_submit_assignment'),'student submissions must use RPC');
assert(ops.includes('academy_grade_assignment'),'teacher grading must use RPC');
assert(gateway.includes('academy_submit_assignment_with_file'),'file submission must use RPC');
console.log('PASS: direct assignment grade/portfolio tampering blocked; authorized RPC workflows retained.');
