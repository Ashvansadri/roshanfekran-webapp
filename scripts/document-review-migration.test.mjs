import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../migrations/20261026_audited_document_reviews.sql",import.meta.url),"utf8");
const verify=readFileSync(new URL("../migrations/20261026_audited_document_reviews.verify.sql",import.meta.url),"utf8");
const rollback=readFileSync(new URL("../migrations/20261026_audited_document_reviews.rollback.sql",import.meta.url),"utf8");
for(const part of ["academy_role_allowed","archived_at IS NULL","academy_audit_log","REVOKE UPDATE ON TABLE public.academy_student_documents","DROP POLICY IF EXISTS academy_student_documents_staff_update"])assert(sql.includes(part),part);
for(const part of ["direct_patch_blocked","anonymous_rpc_blocked","audit_present","archive_guard_present"])assert(verify.includes(part),part);
assert(rollback.includes("Unsafe direct table UPDATE stays revoked"));
console.log("PASS: audited document migration and read-only verification present");
