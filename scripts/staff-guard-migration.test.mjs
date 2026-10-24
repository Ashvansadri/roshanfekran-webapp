import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../migrations/20261024_staff_finance_archive_guards.sql",import.meta.url),"utf8");
const names=["academy_archive_staff","academy_convert_lead","academy_create_self_registration_link","academy_grade_assignment","academy_invite_staff","academy_list_staff","academy_list_staff_directory","academy_list_student_risk","academy_purge_staff_data","academy_reply_service_request","academy_review_payment","academy_review_registration_request","academy_review_self_registration","academy_review_student_document","academy_set_course_payment_options","academy_set_staff_active","academy_staff_purge_preview","academy_void_expense","academy_void_payment","academy_void_teacher_payout"];
const rx=/where\s+(?:s\.)?user_id\s*=\s*(?:\(select\s+auth\.uid\(\)\)|v_caller_uid)\s+and\s+(?:s\.)?active\s*=\s*true\s+and\s+(?:s\.)?archived_at\s+is\s+null/i;
for(const name of names){
 const start=sql.indexOf("CREATE OR REPLACE FUNCTION public."+name+"(");
 assert(start>=0,"Missing migrated function: "+name);
 const end=sql.indexOf("CREATE OR REPLACE FUNCTION public.",start+1);
 const definition=sql.slice(start,end<0?undefined:end);
 assert(rx.test(definition),"Caller archive guard missing for "+name);
 assert(definition.includes("SECURITY DEFINER"),"Security mode changed for "+name);
}
console.log("PASS: "+names.length+" staff, finance, admissions and teacher caller archive guards.");
