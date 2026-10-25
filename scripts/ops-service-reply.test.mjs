// Synthetic staff-service reply QA: authorized RPC, archive isolation and no direct PATCH.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const listeners={};
const root={addEventListener(type,fn){listeners[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
const oldFormData=globalThis.FormData;
globalThis.FormData=class {constructor(form){this.values=form.values}get(key){return this.values[key]??null}has(key){return Object.hasOwn(this.values,key)}};
const id="11111111-1111-4111-8111-111111111111";
const archivedId="22222222-2222-4222-8222-222222222222";
const student="33333333-3333-4333-8333-333333333333";
const archivedStudent="44444444-4444-4444-8444-444444444444";
const tables={
 academy_students:[{id:student,full_name:"ACTIVE",status:"active",archived_at:null},{id:archivedStudent,full_name:"ARCHIVED",status:"archived",archived_at:"2026-10-01"}],
 academy_student_requests:[
  {id,student_id:student,subject:"TEST",body:"PRIVATE_BODY",status:"open",priority:"normal"},
  {id:archivedId,student_id:archivedStudent,subject:"ARCHIVED_SECRET",body:"ARCHIVED_SECRET",status:"open",priority:"normal"}
 ]
};
const requests=[];
let confirmValue=true, rpcError=false;
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>confirmValue,()=>null
);
const ops=window.RFOPS;
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
async function load(role){
 ops.reset();requests.length=0;
 await ops.load({kind:"staff",role},async (_,{path,method,body})=>{
  requests.push({path,method,body});
  if(path==="/rest/v1/rpc/academy_reply_service_request"){
   if(rpcError)throw Error("SERVER_DENIED");
   return {ok:true,id:body.p_request_id,status:body.p_status,priority:body.p_priority};
  }
  const key=Object.keys(tables).find(k=>path.startsWith("/rest/v1/"+k+"?"));
  return key?tables[key]:[];
 });
}
function tab(name){
 listeners.click({target:{closest(selector){return selector==="[data-rfops-tab]"?{dataset:{rfopsTab:name}}:null}},preventDefault(){}});
}
function submit(requestId,status="resolved",note="بررسی انجام شد",priority="high"){
 const form={dataset:{rfopsForm:"service-reply",id:requestId},values:{status,priority,staff_note:note}};
 listeners.submit({target:form,preventDefault(){}});
}
try{
 await load("owner");tab("serviceDesk");
 let html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes('data-rfops-form="service-reply"'),"editor not visible for owner");
 assert(!html.includes("ARCHIVED_SECRET"),"archived private request leaked");
 submit(id);await flush();
 const calls=requests.filter(x=>x.path==="/rest/v1/rpc/academy_reply_service_request");
 assert.equal(calls.length,1,"one audited RPC required");
 assert.equal(calls[0].method,"POST");
 assert.deepEqual(calls[0].body,{p_request_id:id,p_status:"resolved",p_priority:"high",p_staff_note:"بررسی انجام شد"});
 assert(!requests.some(x=>x.method==="PATCH"),"direct PATCH must never be used");
 html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("با تأیید سرور"),"success must depend on server response");
 requests.length=0;submit(archivedId);await flush();
 assert(!requests.some(x=>x.path.includes("academy_reply_service_request")),"archived request must not be sent");
 requests.length=0;submit(id,"resolved","", "normal");await flush();
 assert(!requests.some(x=>x.path.includes("academy_reply_service_request")),"empty resolved reply rejected");
 rpcError=true;requests.length=0;submit(id);await flush();
 html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("SERVER_DENIED")&&!html.includes("با تأیید سرور"),"failed RPC must fail closed");
 rpcError=false;
 await load("finance");requests.length=0;submit(id);await flush();
 assert(!requests.some(x=>x.path.includes("academy_reply_service_request")),"finance must not write via new UI");
 confirmValue=false;await load("registrar");requests.length=0;submit(id);await flush();
 assert(!requests.some(x=>x.path.includes("academy_reply_service_request")),"cancelled confirmation must not write");
 console.log("PASS: staff service reply uses audited RPC only, rejects archived/unauthorized/invalid writes and fails closed");
}finally{globalThis.FormData=oldFormData}
