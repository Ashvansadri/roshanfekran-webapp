// Offline attendance authorization and write-confirmation regression. No real accounts or DB writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={},root={addEventListener(type,fn){handlers[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}},document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>true,()=>null
);
const ops=window.RFOPS;
const course="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cls="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const student="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const foreign="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let rosterCalls=0,markCalls=0,lastMark=null,markResponse=null;
let classStart=new Date(Date.now()-3600000).toISOString();
const gateway=async(_action,{path,method,body})=>{
 if(path==="/rest/v1/rpc/academy_teacher_workspace_core")
  return {courses:[{id:course,title:"COURSE_OWN",status:"active"}],students:[]};
 if(path==="/rest/v1/rpc/academy_attendance_roster"){
  rosterCalls++;
  return {class_id:body.p_class_id,course_id:course,roster:[{student_id:student,name:"STUDENT_OWN",status:null,note:null,marked_at:null}]};
 }
 if(path==="/rest/v1/rpc/academy_mark_class_attendance"){
  markCalls++;lastMark=body;return markResponse;
 }
 if(path?.includes("/academy_classes?"))return [{id:cls,course_id:course,title:"SESSION_OWN",session_no:1,starts_at:classStart,ends_at:new Date().toISOString(),status:"scheduled",published:true}];
 if(path?.includes("/academy_assignments?"))return [];
 if(path?.includes("/academy_courses?"))return [{id:course,title:"COURSE_OWN",status:"active"}];
 return [];
};
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setTimeout(resolve,0))};
globalThis.FormData=class{constructor(form){this.values=form.values}get(k){return this.values[k]??null}has(k){return Object.hasOwn(this.values,k)}};
function click(id){const el={dataset:{rfops:"attendance-open",id}};handlers.click({target:{closest(sel){return sel==="[data-rfops]"?el:null}},preventDefault(){}})}
const form={dataset:{rfopsForm:"attendance"},values:{class_id:cls,student_id:student,status:"present",note:"On time"}};
function submit(){handlers.submit({target:form,preventDefault(){}})}
await ops.load({kind:"staff",role:"viewer"},gateway);
click(cls);await tick();
assert.equal(rosterCalls,0,"Viewer must not fetch attendance roster");
ops.reset();
await ops.load({kind:"teacher",role:"teacher"},gateway);
assert(ops.render({kind:"teacher",role:"teacher"}).includes("حضور و غیاب جلسات"));
click(foreign);await tick();
assert.equal(rosterCalls,0,"Teacher must not request foreign class roster");
click(cls);await tick();
assert.equal(rosterCalls,1,"Assigned class roster expected");
assert(ops.render({kind:"teacher",role:"teacher"}).includes("STUDENT_OWN"),"Roster should display only scoped student");
form.values.student_id=foreign;submit();await tick();
assert.equal(markCalls,0,"Foreign student must be blocked");
form.values.student_id=student;form.values.status="other";submit();await tick();
assert.equal(markCalls,0,"Invalid status must be blocked");
form.values.status="present";markResponse={class_id:cls,student_id:student,status:"absent"};
submit();await tick();
assert.equal(markCalls,1,"Valid request should reach RPC");
assert(ops.render({kind:"teacher",role:"teacher"}).includes("ثبت حضور توسط سرور تأیید نشد"),"Mismatched server response must not succeed");
markResponse={class_id:cls,student_id:student,status:"present"};
submit();await tick();
assert.equal(markCalls,2,"Confirmed request expected");
assert.equal(lastMark.p_note,"On time");
assert.equal(rosterCalls,2,"Confirmed write should reload roster");
assert(ops.render({kind:"teacher",role:"teacher"}).includes("وضعیت حضور هنرجو با تأیید سرور ثبت شد"));
ops.reset();
assert(!ops.render({kind:"teacher",role:"teacher"}).includes("STUDENT_OWN"),"Reset must erase attendance roster");
console.log("PASS: attendance viewer denial, assigned-class scope, foreign student denial, status validation, confirmed RPC and session reset");
