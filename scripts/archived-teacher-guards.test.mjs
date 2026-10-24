import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../migrations/20261024_teacher_assignment_archive_guards.sql",import.meta.url),"utf8");
const entries=[["academy_teacher_has_course","st.archived_at is null"],["academy_delete_quiz_question","archived_at is null"],["academy_finalize_course_completion","archived_at is null"],["academy_grade_assignment","active_teacher.archived_at is null"],["academy_inspection_snapshot","archived_at is null"],["academy_quiz_editor","archived_at is null"],["academy_set_assessment_score","archived_at is null"],["academy_set_rubric_score","archived_at is null"],["academy_set_skill_level","archived_at is null"],["academy_submit_payment","s.archived_at is null"],["academy_update_registration_link","archived_at is null"],["academy_upsert_course_public_link","archived_at is null"],["academy_upsert_quiz_question","archived_at is null"]];
for(const [name,guard] of entries){
 const marker=new RegExp("-- PATCH: (?:public|private)\\."+name+"\\\\b");
 const start=sql.indexOf("-- PATCH: "+(name==="academy_teacher_has_course"?"private":"public")+"."+name+"\n");
 assert(start>=0,"Function missing: "+name);
 const end=sql.indexOf("\n-- PATCH: ",start+1);
 const def=sql.slice(start,end<0?undefined:end).toLowerCase();
 assert(def.includes(guard),"Archive guard missing: "+name);
 assert(def.includes("create or replace function"),"Missing function replacement: "+name);
}
for(const name of ["academy_delete_quiz_question","academy_grade_assignment","academy_quiz_editor","academy_set_assessment_score","academy_set_skill_level","academy_upsert_quiz_question"]){
 const start=sql.indexOf("-- PATCH: public."+name+"\n");const end=sql.indexOf("\n-- PATCH: ",start+1);
 assert(sql.slice(start,end<0?undefined:end).includes("active_teacher.role='teacher'"),"Teacher role guard missing: "+name);
}
console.log("PASS: 13 archive-aware security functions and 6 teacher assignment fallbacks");
