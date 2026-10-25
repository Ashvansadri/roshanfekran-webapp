import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";
const base=new URL("../",import.meta.url).pathname;
const sql=readFileSync(join(base,"migrations/20261026_audited_service_request_replies.sql"),"utf8");
const rollback=readFileSync(join(base,"migrations/20261026_audited_service_request_replies.rollback.sql"),"utf8");
const verify=readFileSync(join(base,"migrations/20261026_audited_service_request_replies.verify.sql"),"utf8");
for(const [name,pattern] of Object.entries({
  "legacy RPC signature":/academy_reply_service_request\([\s\S]*?p_request_id uuid,[\s\S]*?p_status text,[\s\S]*?p_staff_note text DEFAULT NULL,[\s\S]*?p_priority text DEFAULT NULL/,
  "staff role check":/academy_role_allowed\(ARRAY\['owner','manager','finance','registrar'\]\)/,
  "archive guard":/s\.archived_at IS NULL[\s\S]*?s\.status IS DISTINCT FROM 'archived'/,
  "audit insert":/INSERT INTO public\.academy_audit_log/,
  "direct patch revoke":/REVOKE UPDATE ON TABLE public\.academy_student_requests FROM authenticated, anon/,
  "broad policy removal":/DROP POLICY IF EXISTS academy_student_requests_staff_update/,
  "anonymous RPC revoke":/REVOKE ALL ON FUNCTION public\.academy_reply_service_request\(uuid,text,text,text\) FROM PUBLIC, anon/,
  "note size":/length\(v_note\) > 4000/
}))assert.match(sql,pattern,name);
assert.match(rollback,/GRANT UPDATE ON TABLE public\.academy_student_requests TO authenticated/);
assert.match(rollback,/CREATE POLICY academy_student_requests_staff_update/);
assert.match(verify,/has_table_privilege/);
console.log("PASS: audited service request migration has restricted updates, audit, rollback and verification");
