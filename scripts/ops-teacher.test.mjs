// Synthetic, offline teacher-role isolation regression. No real user data or credentials.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const root={addEventListener(){}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>false,()=>null
);
const ops=window.RFOPS;
const own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ownAssignment="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const foreignAssignment="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const requests=[];
const request=async(_,{path})=>{
 requests.push(path);
 if(path==="/rest/v1/rpc/academy_teacher_workspace_core")
  return {courses:[{id:own,title:"COURSE_MINE",status:"active"}],
   students:[{id:own,full_name:"STUDENT_MINE",mobile:"PRIVATE_PHONE_NEVER_RENDER"}]};
 if(path.includes("/academy_classes?"))return [{id:own,course_id:own,title:"CLASS_MINE"},{id:foreign,course_id:foreign,title:"CLASS_FOREIGN"}];
 if(path.includes("/academy_assignments?"))return [
  {id:ownAssignment,course_id:own,title:"TASK_MINE",due_at:null},
  {id:foreignAssignment,course_id:foreign,title:"TASK_FOREIGN"}];
 if(path.includes("/academy_assignment_submissions?"))return [
  {id:own,assignment_id:ownAssignment,student_id:own,status:"submitted"},
  {id:foreign,assignment_id:foreignAssignment,student_id:foreign,status:"submitted"}];
 throw Error("Unexpected teacher request: "+path);
};
assert.equal(await ops.load({kind:"teacher",role:"teacher"},request),true);
const html=ops.render({kind:"teacher",role:"teacher"});
for(const expected of ["COURSE_MINE","TASK_MINE","STUDENT_MINE"])assert(html.includes(expected),expected+" missing");
for(const forbidden of ["TASK_FOREIGN","CLASS_FOREIGN","PRIVATE_PHONE_NEVER_RENDER","مالی و اقساط"])
 assert(!html.includes(forbidden),forbidden+" leaked");
assert(requests.some(p=>p.includes("/rpc/academy_teacher_workspace_core")),"Teacher RPC not used");
assert(!requests.some(p=>/\/academy_(courses|students|enrollments)\?/.test(p)),"Direct RLS-forbidden roster query");
assert(requests.every(p=>!p.includes("finance")&&!p.includes("payments")),"Teacher fetched finance");
ops.reset();
const denied=await ops.load({kind:"teacher",role:"teacher"},async()=>{throw Error("403 FORBIDDEN")});
assert.equal(denied,false);
const locked=ops.render({kind:"teacher",role:"teacher"});
assert(!locked.includes("COURSE_MINE")&&!locked.includes("STUDENT_MINE"),"Old teacher data leaked after denial");
assert(locked.includes("403 FORBIDDEN"),"Denied teacher core must be visible as error");
console.log("PASS: teacher RPC roster, scoped assignment reads, no direct RLS-forbidden or finance calls, denial fails closed");
