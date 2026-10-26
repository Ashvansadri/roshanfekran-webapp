// Offline regression: only a complete RLS-scoped finance snapshot may be exported.
// No live account, production financial record, or credential is used.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={},root={addEventListener(type,fn){handlers[type]=fn},contains(){return true}};
let downloads=0,revoked=0,created=0,csv="",filename="",confirmations=0;
const document={
 getElementById(){return root},
 body:{appendChild(){}},
 createElement(tag){assert.equal(tag,"a");return {style:{},set download(v){filename=v},click(){downloads++},remove(){}}}
};
const URLMock={createObjectURL(blob){created++;csv=blob.parts.join("");return "blob:finance-test"},revokeObjectURL(url){assert.equal(url,"blob:finance-test");revoked++}};
class BlobMock{constructor(parts,options){this.parts=parts;this.options=options}}
const window={RFCORE:{render(){}}};
new Function("window","document","location","navigator","confirm","prompt","Blob","URL","setTimeout",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},
 ()=>{confirmations++;return true},()=>null,BlobMock,URLMock,(fn)=>{fn();return 1}
);
const ops=window.RFOPS;
const eid="00000000-0000-4000-8000-000000000001";
const sid="00000000-0000-4000-8000-000000000002";
const cid="00000000-0000-4000-8000-000000000003";
const iid="00000000-0000-4000-8000-000000000004";
const snapshot={
 posted_count:1,posted_total:300,voided_count:0,open_installment_count:1,
 remaining_installments:700,missing_schedule_count:0,enrollment_count:1,
 overpaid_enrollment_count:1,overpaid_excess_total:100,
 overpaid_cases:[{enrollment_id:eid,student_id:sid,course_id:cid,final_fee:200,posted_total:300,excess:100}],
 installment_mismatch_count:1,installment_mismatch_amount:200,
 installment_mismatch_cases:[{installment_id:iid,enrollment_id:eid,scheduled_amount:1000,recorded_paid:300,ledger_paid:100,difference:200}]
};
let response=snapshot;
const gateway=async(_,{path})=>{
 if(path==="/rest/v1/rpc/academy_finance_reconciliation_snapshot")return response;
 if(path?.startsWith("/rest/v1/academy_courses?"))return [{id:cid,title:"COURSE",status:"active"}];
 if(path?.startsWith("/rest/v1/academy_students?"))return [{id:sid,full_name:"PRIVATE_STUDENT",status:"active"}];
 if(path?.startsWith("/rest/v1/academy_enrollments?"))return [{id:eid,student_id:sid,course_id:cid,final_fee:200,status:"active"}];
 return [];
};
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,0))};
function click(action){
 const el={dataset:{rfops:action}};
 handlers.click({target:{closest(sel){return sel==="[data-rfops]"?el:null}},preventDefault(){}});
}
await ops.load({kind:"staff",role:"finance"},gateway);
const html=ops.render({kind:"staff",role:"finance"});
assert(html.includes('data-rfops="finance-reconciliation-export"'),"Complete finance cases should offer scoped CSV");
click("finance-reconciliation-export");await tick();
assert.equal(downloads,1);assert.equal(created,1);assert.equal(revoked,1);
assert.equal(confirmations,1,"Confidential export must require confirmation");
assert(filename.startsWith("roshanfekran-finance-reconciliation-"));
assert(csv.startsWith("\uFEFF"),"UTF-8 BOM missing");
assert(csv.includes(eid)&&csv.includes(iid),"Only server-authoritative case IDs must be exported");
assert(csv.includes("اضافه‌پرداخت")&&csv.includes("مغایرت قسط"));
assert(!csv.includes("PRIVATE_STUDENT"),"Names from capped table projections must not leak to CSV");
ops.reset();
click("finance-reconciliation-export");await tick();
assert.equal(downloads,1,"Logout must invalidate financial export");
response={...snapshot,overpaid_excess_total:101};
await ops.load({kind:"staff",role:"finance"},gateway);
const invalid=ops.render({kind:"staff",role:"finance"});
assert(!invalid.includes('data-rfops="finance-reconciliation-export"'),"Inconsistent totals must fail closed");
click("finance-reconciliation-export");await tick();
assert.equal(downloads,1,"Inconsistent snapshot must not export");
ops.reset();
response={...snapshot,overpaid_enrollment_count:21,overpaid_excess_total:2200};
await ops.load({kind:"staff",role:"finance"},gateway);
const truncated=ops.render({kind:"staff",role:"finance"});
assert(!truncated.includes('data-rfops="finance-reconciliation-export"'),"Truncated server cases must not be exported");
ops.reset();
response=snapshot;
await ops.load({kind:"staff",role:"viewer"},gateway);
ops.render({kind:"staff",role:"viewer"});
click("finance-reconciliation-export");await tick();
assert.equal(downloads,1,"Viewer must never export financial data");
console.log("PASS: finance CSV completeness, privacy, confirmation, logout and viewer denial");
