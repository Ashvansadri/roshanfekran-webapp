import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../supabase/functions/academy-gateway/index.ts",import.meta.url),"utf8");
const begin=source.indexOf("async function studentByUser(");
const end=source.indexOf("function requireStudentPortal(",begin);
assert(begin>=0&&end>begin,"Missing student lookup");
const helper=source.slice(begin,end).trim().replace("userId:string","userId");
assert(helper.includes("status,archived_at"),"Student lookup must load both archive indicators");
let rows=[];
const lookup=new Function("svc","jo",helper+"\nreturn studentByUser;")(
 async path=>{assert(path.includes("status,archived_at"));return path;},
 async()=>rows
);
const student={id:"test-student",portal_enabled:true,status:"active",archived_at:null};
rows=[student];
assert.deepEqual(await lookup("test-user"),student,"Active student must remain usable");
rows=[{...student,status:"archived",archived_at:null}];
await assert.rejects(lookup("test-user"),/آرشیو/,"Status-only archived student must be denied");
rows=[{...student,status:"active",archived_at:"2026-10-01T00:00:00Z"}];
await assert.rejects(lookup("test-user"),/آرشیو/,"Date-only archived student must be denied");
rows=[];
assert.equal(await lookup("test-user"),null,"Unlinked account must remain unlinked");
const section=(name,next)=>{const start=source.indexOf("if(b.action==='"+name+"')");const stop=source.indexOf("if(b.action==='"+next+"')",start+1);assert(start>=0&&stop>start,"Missing action "+name);return source.slice(start,stop)};
for(const [name,next,record] of [
 ["invite_student","signup_student","rows[0]"],
 ["signup_student","invite_guardian","st[0]"],
 ["invite_guardian","signup_guardian","students[0]"],
 ["set_student_portal","avatar_upload","check[0]"],
 ["avatar_upload","assignment_file_upload","st[0]"]
]){
 const block=section(name,next);
 assert(block.includes(record+".status==='archived'")&&block.includes(record+".archived_at"),name+" must check both archive indicators before writes");
}
const roleBlock=section("resolve_portal","ai_public_quota");
assert(roleBlock.includes("students[0].status!=='archived'"),"Archived students must not resolve to student role");
console.log("PASS: active/unlinked student lookup, status/date archive denial and six gateway role/write guards.");


const roleStart=source.indexOf("async function currentRole(");
const roleEnd=source.indexOf("async function studentByUser(",roleStart);
assert(roleStart>=0&&roleEnd>roleStart,"Missing central staff role resolver");
const roleHelper=source.slice(roleStart,roleEnd).trim().replace("token:string,userId:string","token,userId");
let roleRows=[];
const currentRole=new Function("supa","jo",roleHelper+"\nreturn currentRole;")(
 async path=>{assert(path.includes("&active=eq.true&archived_at=is.null"),"Archived staff must be excluded by the role lookup");return path;},
 async()=>roleRows
);
roleRows=[{role:"owner",active:true}];
assert.equal(await currentRole("synthetic-token","synthetic-id"),"owner","Eligible staff must retain their role");
roleRows=[];
assert.equal(await currentRole("synthetic-token","synthetic-id"),null,"Ineligible staff must not receive a role");
const staffResolver=section("resolve_portal","ai_public_quota");
assert(staffResolver.includes("&active=eq.true&archived_at=is.null&limit=1"),"Portal must not resolve archived staff");
console.log("PASS: archived staff excluded from central role and portal resolution; active staff preserved.");
