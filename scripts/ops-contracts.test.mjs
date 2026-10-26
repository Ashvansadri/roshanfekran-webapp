// Offline contract QA: least-privilege RLS projections, role tabs, and explicit, short-lived attachment links.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";

const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const listeners={};
const root={addEventListener(type,fn){listeners[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>false,()=>null
);
const ops=window.RFOPS;
const data={
 academy_students:[{id:"s1",full_name:"STUDENT_PRIVATE",status:"active"}],
 academy_courses:[{id:"c1",title:"COURSE_PUBLIC",status:"active"}],
 academy_student_contracts:[{id:"ct1",student_id:"s1",course_id:"c1",contract_no:"SC-001",status:"signed",delivered_copy:true}],
 academy_staff_contracts:[{id:"ct2",staff_user_id:"u1",contract_no:"STAFF-PRIVATE-001",contract_type:"employment",status:"active"}]
};
async function check(role,expectedTables,canViewContracts,canViewStaff){
 ops.reset();
 const requests=[];
 await ops.load({kind:"staff",role},async(_,{path})=>{
  requests.push(path);
  const table=Object.keys(data).find(k=>path.startsWith("/rest/v1/"+k+"?"));
  return table?data[table]:[];
 });
 const queried=requests.filter(x=>x.includes("_contracts?")).map(x=>x.match(/\/rest\/v1\/([^?]+)/)[1]).sort();
 assert.deepEqual(queried,expectedTables.sort(),role+" contract projection mismatch");
 assert(!requests.filter(x=>x.includes("_contracts?")).some(x=>/file_path|file_name|mime_type|notes|reference_no/.test(x)),role+" requested private contract attachment fields");
 assert(!requests.some(x=>x.includes("academy_student_documents?")&&/file_path|uploaded_by|reviewed_by/.test(x)),role+" requested private document storage fields");
 let html=ops.render({kind:"staff",role});
 assert.equal(html.includes('data-rfops-tab="contracts"'),canViewContracts,role+" contract tab visibility");
 if(canViewContracts){
  listeners.click({target:{closest(selector){return selector==="[data-rfops-tab]"?{dataset:{rfopsTab:"contracts"}}:null}},preventDefault(){}});
  html=ops.render({kind:"staff",role});
  assert(html.includes("SC-001"),role+" missing authorized student contract");
  assert.equal(html.includes("STAFF-PRIVATE-001"),canViewStaff,role+" staff contract privacy");
 }else{
  assert(!html.includes("SC-001")&&!html.includes("STAFF-PRIVATE-001"),role+" leaked contract data");
 }
}
await check("owner",["academy_staff_contracts","academy_student_contracts"],true,true);
await check("registrar",["academy_student_contracts"],true,false);
await check("finance",[],false,false);
await check("viewer",[],false,false);

// Archived student contracts must never appear in the independent staff desk,
// even when an old database policy returns them in the authorized projection.
data.academy_students.push({id:"archived-student",full_name:"ARCHIVED_PRIVATE",status:"archived",archived_at:"2026-10-01"});
data.academy_student_contracts.push({id:"archived-contract",student_id:"archived-student",course_id:"c1",contract_no:"ARCHIVED_CONTRACT_SECRET"});
await check("owner",["academy_staff_contracts","academy_student_contracts"],true,true);
await check("registrar",["academy_student_contracts"],true,false);

async function renderWithFailure(tableName){
 ops.reset();
 await ops.load({kind:"staff",role:"owner"},async(_,{path})=>{
  if(path.startsWith("/rest/v1/"+tableName+"?"))throw Error("SYNTHETIC_RLS_FAILURE");
  const table=Object.keys(data).find(k=>path.startsWith("/rest/v1/"+k+"?"));
  return table?data[table]:[];
 });
 listeners.click({target:{closest(selector){return selector==="[data-rfops-tab]"?{dataset:{rfopsTab:"contracts"}}:null}},preventDefault(){}});
 return ops.render({kind:"staff",role:"owner"});
}
let failureHtml=await renderWithFailure("academy_students");
assert(!failureHtml.includes("SC-001")&&!failureHtml.includes("ARCHIVED_CONTRACT_SECRET"),"student lookup failure must conceal student contracts");
assert(failureHtml.includes("برای حفظ محرمانگی")&&failureHtml.includes(">—</strong>"),"student lookup failure must show unknown, not zero");
failureHtml=await renderWithFailure("academy_student_contracts");
assert(!failureHtml.includes("SC-001")&&!failureHtml.includes("ARCHIVED_CONTRACT_SECRET"),"contract projection failure must conceal student contracts");
assert(failureHtml.includes("برای حفظ محرمانگی"),"contract failure warning missing");
failureHtml=await renderWithFailure("academy_staff_contracts");
assert(!failureHtml.includes("STAFF-PRIVATE-001")&&failureHtml.includes("وضعیت آن‌ها نامشخص است"),"staff contract failure must not imply an empty ledger");
assert(failureHtml.includes("SC-001"),"independent student projection should remain available");
console.log("PASS: archived student contracts hidden; partial RLS failures fail closed and counts remain unknown");

const contractId="11111111-1111-4111-8111-111111111111",staffContractId="22222222-2222-4222-8222-222222222222";
data.academy_student_contracts[0].id=contractId;
data.academy_staff_contracts[0].id=staffContractId;
const signed="https://sdsdzktsqpahpdrgmzuo.supabase.co/storage/v1/object/sign/academy-student-contracts/contract.pdf?token=synthetic-signed-token";
let nextSigned=signed;
const requests=[];
async function loadWithContract(role){
 ops.reset();requests.length=0;
 await ops.load({kind:"staff",role},async(action,payload)=>{
  if(action==="contract_file_url"){requests.push({action,...payload});return {ok:true,url:nextSigned};}
  const table=Object.keys(data).find(k=>String(payload.path||"").startsWith("/rest/v1/"+k+"?"));
  return table?data[table]:[];
 });
 listeners.click({target:{closest(selector){return selector==="[data-rfops-tab]"?{dataset:{rfopsTab:"contracts"}}:null}},preventDefault(){}});
}
const clickContract=(id,kind)=>listeners.click({target:{closest(selector){return selector==="[data-rfops]"?{dataset:{rfops:"contract-link",id,kind}}:null}},preventDefault(){}});
const flush=()=>new Promise(r=>setTimeout(r,25));
await loadWithContract("owner");
let html=ops.render({kind:"staff",role:"owner"});
assert(html.includes('data-rfops="contract-link"'),"authorized contract button missing");
assert(!html.includes("synthetic-signed-token"),"signed URL must not be preloaded");
clickContract(contractId,"student");await flush();
assert.equal(requests.length,1,"exactly one gateway request expected");
assert.deepEqual(requests[0],{action:"contract_file_url",kind:"student",id:contractId});
html=ops.render({kind:"staff",role:"owner"});
assert(html.includes("synthetic-signed-token")&&html.includes('referrerpolicy="no-referrer"'),"valid short-lived signed link missing");
ops.reset();html=ops.render({kind:"staff",role:"owner"});
assert(!html.includes("synthetic-signed-token"),"reset must erase contract link");
nextSigned="https://attacker.example/storage/v1/object/sign/academy-student-contracts/contract.pdf?token=synthetic-signed-token";
await loadWithContract("owner");clickContract(contractId,"student");await flush();
html=ops.render({kind:"staff",role:"owner"});
assert(!html.includes("attacker.example")&&!html.includes("بازکردن نسخه خصوصی"),"external link must fail closed");
nextSigned=signed;
await loadWithContract("registrar");requests.length=0;clickContract(staffContractId,"staff");await flush();
assert(!requests.some(x=>x.action==="contract_file_url"),"registrar must not request staff contract");
await loadWithContract("finance");requests.length=0;clickContract(contractId,"student");await flush();
assert(!requests.some(x=>x.action==="contract_file_url"),"finance must not request contract");
console.log("PASS: signed contract links are role-scoped, on-demand, origin-checked and erased on logout");

console.log("PASS: RLS-scoped contract summaries, owner/registrar separation, finance/viewer privacy");
