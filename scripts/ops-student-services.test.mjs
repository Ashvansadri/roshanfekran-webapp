// Read-only student services inbox QA: role visibility, active-student isolation and fail-closed loading.
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
const records=[
 {id:"r1",student_id:"s1",category:"financial",subject:"درخواست بررسی قسط",body:"STUDENT_PRIVATE_REQUEST",status:"open",created_at:"2026-10-25T10:00:00Z"},
 {id:"r2",student_id:"s2",category:"documents",subject:"ARCHIVED_REQUEST",body:"ARCHIVED_PRIVATE_BODY",status:"open"},
 {id:"r3",student_id:"s1",category:"other",subject:"<script>alert(1)</script>",body:"<img src=x onerror=alert(1)>",status:"resolved",staff_note:"REPLY_PRIVATE"}
];
const tables={
 academy_students:[{id:"s1",full_name:"ACTIVE_STUDENT",status:"active",archived_at:null},{id:"s2",full_name:"ARCHIVED_STUDENT",status:"archived",archived_at:"2026-10-01"}],
 academy_student_requests:records
};
function tab(name){
 listeners.click({target:{closest(selector){return selector==="[data-rfops-tab]"?{dataset:{rfopsTab:name}}:null}},preventDefault(){}});
}
async function check(role,allowed,failStudents=false,failRequests=false){
 ops.reset();
 const queried=[];
 await ops.load({kind:"staff",role},async(_,{path})=>{
  queried.push(path);
  if(path.startsWith("/rest/v1/academy_students?")&&failStudents)throw Error("STUDENTS_UNAVAILABLE");
  if(path.startsWith("/rest/v1/academy_student_requests?")&&failRequests)throw Error("REQUESTS_UNAVAILABLE");
  const key=Object.keys(tables).find(k=>path.startsWith("/rest/v1/"+k+"?"));
  return key?tables[key]:[];
 });
 let html=ops.render({kind:"staff",role});
 assert.equal(html.includes('data-rfops-tab="serviceDesk"'),allowed,role+" service desk tab permission");
 assert.equal(queried.some(p=>p.startsWith("/rest/v1/academy_student_requests?")),allowed,role+" queried private inbox");
 if(!allowed){
  assert(!html.includes("STUDENT_PRIVATE_REQUEST")&&!html.includes("REPLY_PRIVATE"),role+" leaked inbox");
  return;
 }
 const requestPath=queried.find(p=>p.startsWith("/rest/v1/academy_student_requests?"));
 assert(requestPath.includes("select=id,student_id,category,subject,body,status,priority,staff_note,created_at,updated_at"),"excessive staff projection");
 assert(!requestPath.includes("select=*"),"wildcard projection forbidden");
 tab("serviceDesk");html=ops.render({kind:"staff",role});
 if(failStudents||failRequests){
  assert(!html.includes("STUDENT_PRIVATE_REQUEST")&&!html.includes("REPLY_PRIVATE"),"failed dependency leaked inbox");
  assert(html.includes("rfops-warn"),"failure must be visible");
 }else{
  assert(html.includes("STUDENT_PRIVATE_REQUEST")&&html.includes("REPLY_PRIVATE"),"active request missing");
  assert(!html.includes("ARCHIVED_PRIVATE_BODY")&&!html.includes("ARCHIVED_REQUEST"),"archived student leaked");
  assert(html.includes("&lt;script&gt;")&&html.includes("&lt;img"),"user content not escaped");
  assert(!html.includes("<script>")&&!html.includes("<img src=x"),"unsafe HTML rendered");
  assert(!html.includes('data-rfops="service-update"'),"unsafe direct update control");
 }
}
for(const role of ["owner","manager","registrar"])await check(role,true);
for(const role of ["finance","viewer"])await check(role,false);
await check("owner",true,true,false);
await check("owner",true,false,true);
console.log("PASS: independent staff services inbox is read-only, role-scoped, escaped, and fails closed");
