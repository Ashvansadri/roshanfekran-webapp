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
 ['/rest/v1/rpc/academy_create_student_contract_draft','POST',credential,true],
 ['/rest/v1/academy_students?id=eq.test','PATCH',credential,true],
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
for(const [path,method,token,expected] of cases)
 assert.equal(guard(path,method,token),expected,method+' '+path);
console.log('PASS: '+cases.length+' canonical proxy routing and traversal/encoded-path checks.');
