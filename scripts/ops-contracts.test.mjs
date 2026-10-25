// Offline contract QA: least-privilege RLS projections, role tabs, and no document links.
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
console.log("PASS: RLS-scoped contract summaries, owner/registrar separation, finance/viewer privacy");
