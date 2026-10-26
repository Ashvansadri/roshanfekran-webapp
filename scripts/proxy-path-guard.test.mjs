import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Execute only the pure proxy-route guard from the checked-in gateway.
// This tests its actual implementation, not a separately copied allowlist.
const source=readFileSync(new URL('../supabase/functions/academy-gateway/index.ts',import.meta.url),'utf8');
const match=source.match(/function allowedProxy\(path:string,method:string,token:string\)\{[\s\S]*?\n\}/);
assert(match,'gateway route guard must exist');
const js=match[0].replace('path:string,method:string,token:string','path,method,token');
const guard=Function('SUPA',js+';return allowedProxy')('https://sdsdzktsqpahpdrgmzuo.supabase.co');
const credential='synthetic-nonsecret-bearer';
const cases=[
 ['/auth/v1/token?grant_type=password','POST','',true],
 ['/auth/v1/token?grant_type=refresh_token','POST','',true],
 ['/auth/v1/user','GET',credential,true],
 ['/rest/v1/academy_students?select=id','GET',credential,true],
 ['/rest/v1/academy_payments?select=id&limit=1','GET',credential,true],
 ['/rest/v1/academy_student_contracts?select=id','GET',credential,true],
 ['/rest/v1/academy_staff_contracts?select=id','GET',credential,true],
 ['/rest/v1/academy_student_contracts','POST',credential,false],
 ['/rest/v1/academy_student_contracts?id=eq.11111111-1111-4111-8111-111111111111','PATCH',credential,false],
 ['/rest/v1/academy_staff_contracts','POST',credential,false],
 ['/rest/v1/academy_staff_contracts?id=eq.11111111-1111-4111-8111-111111111111','PATCH',credential,false],
 ['/rest/v1/academy_payments','POST',credential,false],
 ['/rest/v1/academy_payments?on_conflict=id','POST',credential,false],
 ['/rest/v1/academy_payments?id=eq.11111111-1111-4111-8111-111111111111','PATCH',credential,false],
 ['/rest/v1/academy_installments','POST',credential,false],
 ['/rest/v1/academy_installments?id=eq.11111111-1111-4111-8111-111111111111','PATCH',credential,false],
 ['/rest/v1/academy_enrollments','POST',credential,false],
 ['/rest/v1/academy_enrollments?id=eq.11111111-1111-4111-8111-111111111111','PATCH',credential,false],
 ['/rest/v1/academy_installments?select=id','GET',credential,true],
 ['/rest/v1/academy_enrollments?select=id','GET',credential,true],
 ['/rest/v1/rpc/academy_create_student_contract_draft','POST',credential,true],
 ['/rest/v1/academy_students?id=eq.test','PATCH',credential,false],
 ['/rest/v1/academy_students','POST',credential,false],
 ['/rest/v1/academy_staff','PATCH',credential,false],
 ['/rest/v1/academy_courses','PATCH',credential,false],
 ['/rest/v1/academy_student_documents','POST',credential,false],
 ['/rest/v1/academy_student_documents?id=eq.test','PATCH',credential,false],
 ['/rest/v1/academy_student_requests','POST',credential,false],
 ['/rest/v1/academy_student_requests?id=eq.test','PATCH',credential,false],
 ['/rest/v1/academy_assignment_submissions','POST',credential,false],
 ['/rest/v1/academy_showcase_works','POST',credential,false],
 ['/rest/v1/academy_guardian_students','POST',credential,false],
 ['/rest/v1/academy_guardian_students?id=eq.test','PATCH',credential,true],
 ['/rest/v1/academy_guardian_students?id=eq.test','DELETE',credential,false],
 ['/rest/v1/academy_classes','POST',credential,true],
 ['/rest/v1/academy_classes?id=eq.test','PATCH',credential,false],
 ['/rest/v1/academy_assignments','POST',credential,true],
 ['/rest/v1/academy_assignments?id=eq.test','PATCH',credential,false],
 ['/rest/v1/rpc/academy_student_journey_snapshot','POST',credential,true],
 ['/rest/v1/academy_students','GET','',false],
 ['/rest/v1/academy_students','DELETE',credential,false],
 ['/auth/v1/user','GET','',false],
 ['/auth/v1/token?grant_type=password','GET','',false],
 ['/rest/v1/../../auth/v1/admin/users','GET',credential,false],
 ['/rest/v1/%2e%2e/%2e%2e/auth/v1/admin/users','GET',credential,false],
 ['/rest/v1/academy_students/../academy_payments','GET',credential,false],
 ['/rest/v1/academy_staff%5Finvites','GET',credential,false],
 ['/rest/v1/academy_staff_invites','GET',credential,false],
 ['/rest/v1/academy_student_invites','GET',credential,false],
 ['/rest/v1/academy_guardian_invites','GET',credential,false],
 ['/rest/v1/rpc/academy_bootstrap_owner','POST',credential,false],
 ['/rest/v1/rpc/academy_claim_staff_invite_service','POST',credential,false],
 ['/rest/v1/academy_students#ignore','GET',credential,false],
 ['/rest/v1/academy_students\\../auth/v1/user','GET',credential,false],
 ['https://sdsdzktsqpahpdrgmzuo.supabase.co/rest/v1/academy_students','GET',credential,false],
 ['https://attacker.invalid/rest/v1/academy_students','GET',credential,false],
 ['/rest/v1/other_table','GET',credential,false],
 ['/rest/v1/rpc/unscoped_function','POST',credential,false]
];
assert.match(source,/staffRole=await currentRole\(token,user\.id\)/,'Guardian mutation must recheck management role on the server');
for(const [path,method,token,expected] of cases)
 assert.equal(guard(path,method,token),expected,method+' '+path);
// The gateway must not proxy every SECURITY DEFINER RPC merely because its
// name begins with academy_. Keep the explicit staging allowlist synchronized
// with the RPCs that the two portal clients actually invoke.
const usedRpcs=new Set();
for(const file of ['portal.js','academy-ops.js']){
 const frontend=readFileSync(new URL('../site/'+file,import.meta.url),'utf8');
 for(const match of frontend.matchAll(/(?:rpc\\(\\s*["']|\\/rpc\\/)(academy_[a-z0-9_]+)/g))usedRpcs.add(match[1]);
}
assert(usedRpcs.size>=25,'Unexpectedly few portal RPC references; review the extraction');
for(const name of usedRpcs){
 const method=name==='academy_list_student_risk'?'GET':'POST';
 assert.equal(guard('/rest/v1/rpc/'+name,method,credential),true,'Portal RPC must remain reachable: '+name);
}
for(const name of ['academy_build_automation_queue','academy_complete_automation_job','academy_archive_staff','academy_bootstrap_owner']){
 assert.equal(guard('/rest/v1/rpc/'+name,'POST',credential),false,'Privileged or unlisted RPC must be denied: '+name);
}
assert.equal(guard('/rest/v1/rpc/academy_review_payment','GET',credential),false,'Mutating RPC must not accept GET');
assert.equal(guard('/rest/v1/rpc/academy_review_payment','PATCH',credential),false,'RPC must not accept PATCH');
console.log('PASS: '+cases.length+' proxy routing checks; '+usedRpcs.size+' required staging RPCs; unlisted privileged RPCs denied.');
