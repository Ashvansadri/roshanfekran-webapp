// Offline role/validation/confirmation regression for class scheduling. No real credentials or writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={};
const root={addEventListener(type,fn){handlers[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>true,()=>null
);
const ops=window.RFOPS;
const own="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let createResult=null,writes=0,lastBody=null,lastPrefer=null;
const gateway=async(_action,{path,method,body,prefer})=>{
 if(path==="/rest/v1/rpc/academy_teacher_workspace_core")
  return {courses:[{id:own,title:"COURSE_MINE",status:"active"}],students:[]};
 if(path?.startsWith("/rest/v1/academy_classes")&&method==="POST"){
  writes++;lastBody=body;lastPrefer=prefer;return createResult;
 }
 if(path?.includes("/academy_courses?"))return [{id:own,title:"COURSE_MINE",status:"active"}];
 if(path?.includes("/academy_classes?"))return [];
 if(path?.includes("/academy_assignments?"))return [];
 return [];
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
globalThis.FormData=class {
 constructor(form){this.values=form.values}
 get(key){return this.values[key]??null}
 has(key){return Object.hasOwn(this.values,key)}
};
const future=offset=>new Date(Date.now()+offset*60000).toISOString().slice(0,16);
const form={id:"rfops-class",values:{
 course_id:own,title:"Class session",session_no:"1",starts_at:future(120),ends_at:future(180),
 mode:"in_person",room:"Room 1"
}};
function submit(){handlers.submit({target:form,preventDefault(){}})}
await ops.load({kind:"staff",role:"viewer"},gateway);
assert(!ops.render({kind:"staff",role:"viewer"}).includes('id="rfops-class"'),"Viewer must not see session form");
submit();await tick();await tick();
assert.equal(writes,0,"Viewer must not write classes");
ops.reset();
await ops.load({kind:"teacher",role:"teacher"},gateway);
const html=ops.render({kind:"teacher",role:"teacher"});
assert(html.includes('id="rfops-class"'),"Teacher should see session form");
assert(html.includes("COURSE_MINE"),"Assigned course should be visible");
form.values.course_id=foreign;submit();await tick();await tick();
assert.equal(writes,0,"Teacher must not write foreign course");
form.values.course_id=own;form.values.ends_at=future(90);submit();await tick();await tick();
assert.equal(writes,0,"End before start must be rejected");
form.values.ends_at=future(180);form.values.mode="invalid";submit();await tick();await tick();
assert.equal(writes,0,"Invalid class mode must be rejected");
form.values.mode="in_person";createResult=[];submit();await tick();await tick();
assert.equal(writes,1,"Valid teacher write expected");
assert(ops.render({kind:"teacher",role:"teacher"}).includes("ثبت جلسه در سرور تأیید نشد"),"Empty response must not be treated as success");
assert.equal(lastPrefer,"return=representation");
assert.equal(lastBody.published,false,"Default class must remain a draft");
createResult=[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",course_id:own,session_no:1,published:false,status:"scheduled"}];
submit();await tick();await tick();
assert.equal(writes,2,"Second valid write expected");
assert(ops.render({kind:"teacher",role:"teacher"}).includes("جلسه به‌صورت پیش‌نویس و بدون اعلان ثبت شد"),"Confirmed class should succeed");
form.values.published="on";createResult=[{...createResult[0],published:true}];
submit();await tick();await tick();
assert.equal(writes,3,"Published class write expected");
assert.equal(lastBody.published,true);
assert(ops.render({kind:"teacher",role:"teacher"}).includes("جلسه منتشر شد"),"Published confirmation expected");
console.log("PASS: class scheduler viewer denial, teacher scope, date/mode validation, draft default, confirmed write, explicit publish");
