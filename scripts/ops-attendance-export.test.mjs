// Scoped attendance CSV report: no production accounts, credentials, or database writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={},root={addEventListener(type,fn){handlers[type]=fn},contains(){return true}};
let downloaded=0,created=0,revoked=0,csv="",rosterCalls=0;
const document={
 getElementById(){return root},
 body:{appendChild(){}},
 createElement(tag){
  assert.equal(tag,"a");
  return {style:{},click(){downloaded++},remove(){}};
 }
};
const URLMock={createObjectURL(blob){created++;csv=blob.parts.join("");return "blob:attendance-test"},revokeObjectURL(url){assert.equal(url,"blob:attendance-test");revoked++}};
class BlobMock{constructor(parts,options){this.parts=parts;this.options=options}}
const window={RFCORE:{render(){}}};
new Function("window","document","location","navigator","confirm","prompt","Blob","URL","setTimeout",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>true,()=>null,
 BlobMock,URLMock,(fn)=>{fn();return 1}
);
const ops=window.RFOPS;
const course="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cls="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const student="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const gateway=async(_action,{path,body})=>{
 if(path==="/rest/v1/rpc/academy_teacher_workspace_core")
  return {courses:[{id:course,title:"COURSE_OWN",status:"active"}],students:[]};
 if(path==="/rest/v1/rpc/academy_attendance_roster"){
  rosterCalls++;return {class_id:body.p_class_id,course_id:course,roster:[
   {student_id:student,name:'=HYPERLINK("unsafe")',status:"present",note:"+2+3",marked_at:null},
   {student_id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",name:"هنرجوی دوم",status:"absent",note:"موجه نیست",marked_at:null}
  ]};
 }
 if(path?.includes("/academy_classes?"))return [{
  id:cls,course_id:course,title:"SESSION_OWN",session_no:1,
  starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date().toISOString(),
  status:"scheduled",published:true
 }];
 if(path?.includes("/academy_courses?"))return [{id:course,title:"COURSE_OWN",status:"active"}];
 return [];
};
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setTimeout(resolve,0))};
function click(action,id){
 const el={dataset:{rfops:action,id}};
 handlers.click({target:{closest(sel){return sel==="[data-rfops]"?el:null}},preventDefault(){}});
}
await ops.load({kind:"teacher",role:"teacher"},gateway);
click("attendance-export",cls);await tick();
assert.equal(downloaded,0,"Cannot export before server-scoped roster");
click("attendance-open",cls);await tick();
assert.equal(rosterCalls,1);
const html=ops.render({kind:"teacher",role:"teacher"});
assert(html.includes("rfops-attendance-summary"),"Attendance summary missing");
assert(html.includes("دریافت گزارش CSV"),"CSV action missing");
click("attendance-export",cls);await tick();
assert.equal(downloaded,1,"Authorized teacher should export");
assert.equal(created,1);assert.equal(revoked,1,"Object URL must be revoked");
assert(csv.startsWith("\uFEFF"),"Excel UTF-8 BOM missing");
assert(csv.includes("'=HYPERLINK"),"Spreadsheet formula must be neutralized");
assert(csv.includes("'+2+3"),"Formula-like notes must be neutralized");
assert(csv.includes('""unsafe""'),"Embedded double quotes must be escaped");
assert(!csv.includes(',"=HYPERLINK'),"Raw spreadsheet formula must not be exported");
ops.reset();
click("attendance-export",cls);await tick();
assert.equal(downloaded,1,"Logout must invalidate roster export");
await ops.load({kind:"staff",role:"viewer"},gateway);
click("attendance-export",cls);await tick();
assert.equal(downloaded,1,"Viewer must not export");
console.log("PASS: attendance summary, scoped export, UTF-8 CSV, formula neutralization, logout and viewer denial");
