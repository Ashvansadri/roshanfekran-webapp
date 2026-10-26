// Live negative authorization smoke: no real credentials and no data mutations.
// Even a forged Authorization header must not reach PostgREST contract writes.
import assert from 'node:assert/strict';
const gateway='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
async function check(label,path,method){
 const res=await fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-invalid-contract-guard-token'},body:JSON.stringify({action:'proxy',path,method,body:{}}),signal:AbortSignal.timeout(15000)});
 const data=await res.json();
 assert.equal(res.status,403,label+' must be blocked at the gateway, before database authorization');
 assert.match(String(data.error||''),/مسیر یا روش غیرمجاز است/,label+' must be rejected by route guard');
 console.log('PASS: '+label+' gateway-level 403');
}
await check('student contract INSERT','/rest/v1/academy_student_contracts','POST');
await check('student contract UPDATE','/rest/v1/academy_student_contracts?id=eq.11111111-1111-4111-8111-111111111111','PATCH');
await check('staff contract INSERT','/rest/v1/academy_staff_contracts','POST');
await check('staff contract UPDATE','/rest/v1/academy_staff_contracts?id=eq.11111111-1111-4111-8111-111111111111','PATCH');
await check('ledger payment INSERT','/rest/v1/academy_payments','POST');
await check('ledger payment UPSERT','/rest/v1/academy_payments?on_conflict=id','POST');
await check('ledger payment UPDATE','/rest/v1/academy_payments?id=eq.11111111-1111-4111-8111-111111111111','PATCH');
await check('installment INSERT','/rest/v1/academy_installments','POST');
await check('installment UPDATE','/rest/v1/academy_installments?id=eq.11111111-1111-4111-8111-111111111111','PATCH');
await check('enrollment INSERT','/rest/v1/academy_enrollments','POST');
await check('enrollment UPDATE','/rest/v1/academy_enrollments?id=eq.11111111-1111-4111-8111-111111111111','PATCH');
