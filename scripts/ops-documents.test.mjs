// Synthetic QA for staff document review. Never creates or changes real student records.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../site/academy-ops.js",import.meta.url),"utf8");
const listeners={};
const root={contains(){return true},addEventListener(k,fn){listeners[k]=fn}};
const window={RFCORE:{render(){}}},document={getElementById(){return root}};
const original=globalThis.FormData;
globalThis.FormData=class{constructor(f){this.f=f}get(k){return this.f.values[k]??null}has(k){return Object.hasOwn(this.f.values,k)}};
const student="11111111-1111-4111-8111-111111111111",archived="22222222-2222-4222-8222-222222222222";
const doc="33333333-3333-4333-8333-333333333333",secret="44444444-4444-4444-8444-444444444444";
const data={
 academy_students:[{id:student,full_name:"ACTIVE",status:"active",archived_at:null},{id:archived,full_name:"ARCHIVED",status:"archived",archived_at:"2026-10-01"}],
 academy_student_documents:[{id:doc,student_id:student,title:"ACTIVE_DOC",status:"pending"},{id:secret,student_id:archived,title:"ARCHIVED_SECRET",status:"pending"}]
};
const calls=[];let fail=false,malicious=false,confirmed=true;
new Function("window","document","location","navigator","confirm","prompt",src)(window,document,{origin:"https://example.invalid"},{clipboard:{}},()=>confirmed,()=>null);
const ops=window.RFOPS;
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
async function load(role){
 ops.reset();calls.length=0;
 await ops.load({kind:"staff",role},async(action,b)=>{
  calls.push({action,...b});
  if(action==="student_document_url")return {ok:true,url:malicious?"https://evil.example/doc":"https://sdsdzktsqpahpdrgmzuo.supabase.co/storage/v1/object/sign/academy-student-documents/a.pdf?token=TEST"};
  if(b.path==="/rest/v1/rpc/academy_review_student_document"){
   if(fail)throw Error("SERVER_DENIED");
   return {ok:true,id:b.body.p_document_id,status:b.body.p_status};
  }
  const table=Object.keys(data).find(k=>b.path?.startsWith("/rest/v1/"+k+"?"));
  return table?data[table]:[];
 });
}
function tab(k){listeners.click({target:{closest(s){return s==="[data-rfops-tab]"?{dataset:{rfopsTab:k}}:null}},preventDefault(){}})}
function action(k,id){listeners.click({target:{closest(s){return s==="[data-rfops]"?{dataset:{rfops:k,id}}:null}},preventDefault(){}})}
function submit(id,status="approved",note="تأیید شد"){listeners.submit({target:{dataset:{rfopsForm:"document-review",id},values:{status,review_note:note}},preventDefault(){}})}
try{
 await load("owner");tab("documents");
 let html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("ACTIVE_DOC")&&!html.includes("ARCHIVED_SECRET"));
 assert(!html.includes("storage/v1/object/sign"));
 action("document-link",doc);await wait();
 assert(calls.some(x=>x.action==="student_document_url"&&x.document_id===doc));
 html=ops.render({kind:"staff",role:"owner"});
 assert(html.includes("بازکردن فایل خصوصی")&&html.includes('rel="noopener noreferrer"'));
 malicious=true;action("document-link",doc);await wait();
 assert(ops.render({kind:"staff",role:"owner"}).includes("دامنه امن"));
 malicious=false;calls.length=0;submit(doc);await wait();
 const writes=calls.filter(x=>x.path==="/rest/v1/rpc/academy_review_student_document");
 assert.equal(writes.length,1);
 assert.deepEqual(writes[0].body,{p_document_id:doc,p_status:"approved",p_review_note:"تأیید شد"});
 assert(!calls.some(x=>x.method==="PATCH"));
 calls.length=0;submit(secret);await wait();
 assert(!calls.some(x=>x.path?.includes("academy_review_student_document")));
 calls.length=0;submit(doc,"rejected","");await wait();
 assert(!calls.some(x=>x.path?.includes("academy_review_student_document")));
 fail=true;submit(doc);await wait();
 assert(ops.render({kind:"staff",role:"owner"}).includes("SERVER_DENIED"));
 fail=false;await load("finance");tab("documents");
 assert(!ops.render({kind:"staff",role:"finance"}).includes("ACTIVE_DOC"));
 calls.length=0;action("document-link",doc);await wait();
 assert(!calls.some(x=>x.action==="student_document_url"));
 confirmed=false;await load("registrar");calls.length=0;submit(doc);await wait();
 assert(!calls.some(x=>x.path?.includes("academy_review_student_document")));
 console.log("PASS: document desk role isolation, archive filtering, signed links, audited RPC and fail-closed behavior");
}finally{globalThis.FormData=original}
