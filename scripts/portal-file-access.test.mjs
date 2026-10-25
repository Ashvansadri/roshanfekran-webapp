import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../supabase/functions/academy-gateway/index.ts",import.meta.url),"utf8");
const helper=source.match(/function requireStudentPortal\(st:any\)\{[\s\S]*?\n\}/)?.[0];
assert(helper,"Central student portal gate missing");
const requireStudentPortal=new Function("gatewayHttpError",helper.replace("(st:any)","(st)")+";return requireStudentPortal;")(
 (status,message)=>Object.assign(new Error(message),{status})
);
const student={id:"11111111-1111-4111-8111-111111111111",portal_enabled:true,status:"active",archived_at:null};
assert.equal(requireStudentPortal(student),student,"Active, enabled student should keep access");
for(const candidate of [null,undefined,{...student,portal_enabled:false},{...student,portal_enabled:null},{...student,portal_enabled:undefined},{...student,status:"archived"},{...student,archived_at:"2026-10-01T00:00:00Z"}]){
 assert.throws(()=>requireStudentPortal(candidate),e=>e?.status===403,"Disabled/archived student must be denied");
}
function block(name,next){
 const a=source.indexOf("if(b.action==='"+name+"')");
 const b=source.indexOf("if(b.action==='"+next+"')",a+1);
 assert(a>=0&&b>a,"Gateway action boundaries missing: "+name);
 return source.slice(a,b);
}
assert(block("avatar_upload","assignment_file_upload").includes("if(st&&!role){requireStudentPortal(st);"),"Student avatar write must require active portal");
assert(block("assignment_file_url","payment_receipt_upload").includes("requireStudentPortal(st);"),"Private assignment download must require active portal");
assert(block("payment_receipt_url","self_registration_info").includes("requireStudentPortal(await studentByUser(u.id))"),"Payment receipt signing must require active portal");
assert(block("student_document_url","verify_certificate").includes("requireStudentPortal(await studentByUser(u.id))"),"Private document signing must require active portal");
const resolver=block("resolve_portal","ai_public_quota");
assert(resolver.includes("students[0].portal_enabled===true"),"Portal role must not accept a missing/null permission flag");
assert(!resolver.includes("portal_enabled!==false"),"Fail-open portal role check detected");
console.log("PASS: disabled, archived and null-grant student denied for signed downloads and avatar updates; enabled students preserved.");
