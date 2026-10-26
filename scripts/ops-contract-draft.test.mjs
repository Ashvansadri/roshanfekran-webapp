// Synthetic contract draft QA: authorized RPC, no direct writes, role/archive isolation.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";
const rootDir=new URL("../",import.meta.url).pathname;
const source=readFileSync(join(rootDir,"site/academy-ops.js"),"utf8");
const migration=readFileSync(join(rootDir,"migrations/20261026_audited_student_contract_drafts.sql"),"utf8");
assert(migration.includes("SECURITY DEFINER")&&migration.includes("academy_role_allowed(ARRAY['owner','manager','registrar'])"));
assert(migration.includes("academy_audit_log")&&migration.includes("status,delivered_copy,created_by"));
assert(migration.includes("REVOKE ALL ON FUNCTION")&&migration.includes("GRANT EXECUTE ON FUNCTION"));
const listeners={};
const root={addEventListener(type,fn){listeners[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
const oldFormData=globalThis.FormData;
globalThis.FormData=class {constructor(form){this.values=form.values}get(key){return this.values[key]??null}has(key){return Object.hasOwn(this.values,key)}};
const student="11111111-1111-4111-8111-111111111111";
const archived="22222222-2222-4222-8222-222222222222";
const course="33333333-3333-4333-8333-333333333333";
const createdId="44444444-4444-4444-8444-444444444444";
const tables={
 academy_students:[{id:student,full_name:"ACTIVE",status:"active",archived_at:null},{id:archived,full_name:"ARCHIVED_PRIVATE",status:"archived",archived_at:"2026-10-01"}],
 academy_courses:[{id:course,title:"COURSE",status:"active"}],
 academy_student_contracts:[]
};
let allowConfirm=true,serverReject=false;
const calls=[];
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>allowConfirm,()=>null
);
const ops=window.RFOPS;
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));
async function load(role){
 ops.reset();calls.length=0;
 await ops.load({kind:"staff",role},async (_,{path,method,body})=>{
  calls.push({path,method,body});
  if(path==="/rest/v1/rpc/academy_create_student_contract_draft"){
   if(serverReject)throw Error("SERVER_DENIED");
   return {ok:true,id:createdId,status:"draft",student_id:body.p_student_id,course_id:body.p_course_id};
  }
  const key=Object.keys(tables).find(k=>path.startsWith("/rest/v1/"+k+"?"));
  return key?tables[key]:[];
 });
}
function tab(){listeners.click({target:{closest(s){return s==="[data-rfops-tab]"?{dataset:{rfopsTab:"contracts"}}:null}},preventDefault(){}})}
function submit(values={}){
 const form={id:"rfops-contract-draft",dataset:{},values:{student_id:student,course_id:course,contract_no:"RF-2026-001",start_date:"2026-11-01",end_date:"2027-01-01",...values}};
 listeners.submit({target:form,preventDefault(){}});
}
try{
 await load("owner");tab();
 let html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes('id="rfops-contract-draft"'),"owner draft editor missing");
 assert(!html.includes("ARCHIVED_PRIVATE"),"archived student leaked into draft editor");
 submit();await flush();
 const writes=calls.filter(x=>x.method==="POST"&&x.path.includes("academy_create_student_contract_draft"));
 assert.equal(writes.length,1,"draft must call one audited RPC");
 assert.deepEqual(writes[0].body,{p_student_id:student,p_course_id:course,p_contract_no:"RF-2026-001",p_start_date:"2026-11-01",p_end_date:"2027-01-01"});
 assert(!calls.some(x=>x.method==="PATCH"||x.path==="/rest/v1/academy_student_contracts"),"direct table writes forbidden");
 html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("ثبت حسابرسی سرور"),"success must be verified by RPC");
 calls.length=0;submit({student_id:archived});await flush();
 assert(!calls.some(x=>x.path.includes("academy_create_student_contract_draft")),"archived student draft blocked");
 calls.length=0;submit({start_date:"2026-02-30"});await flush();
 assert(!calls.some(x=>x.path.includes("academy_create_student_contract_draft")),"invalid date blocked");
 calls.length=0;submit({end_date:"2026-10-01"});await flush();
 assert(!calls.some(x=>x.path.includes("academy_create_student_contract_draft")),"inverted dates blocked");
 serverReject=true;calls.length=0;submit();await flush();
 html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("SERVER_DENIED")&&!html.includes("ثبت حسابرسی سرور"),"server rejection must fail closed");
 serverReject=false;
 await load("registrar");tab();
 assert(ops.render({kind:"staff",role:"registrar"}).includes('id="rfops-contract-draft"'),"registrar draft editor missing");
 await load("finance");tab();
 assert(!ops.render({kind:"staff",role:"finance"}).includes('id="rfops-contract-draft"'),"finance must not see draft editor");
 calls.length=0;submit();await flush();
 assert(!calls.some(x=>x.path.includes("academy_create_student_contract_draft")),"finance must not create draft");
 await load("viewer");tab();
 assert(!ops.render({kind:"staff",role:"viewer"}).includes('id="rfops-contract-draft"'),"viewer must not see draft editor");
 allowConfirm=false;await load("registrar");tab();calls.length=0;submit();await flush();
 assert(!calls.some(x=>x.path.includes("academy_create_student_contract_draft")),"cancelled confirmation must not write");
 console.log("PASS: contract drafts use audited RPC; role, archive, date, denial and confirmation guards");
}finally{globalThis.FormData=oldFormData}
