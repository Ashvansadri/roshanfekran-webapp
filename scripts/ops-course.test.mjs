// Offline regression: role-limited course operations, validated writes, and archived-course guard.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";
const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={};
const root={addEventListener(type,fn){handlers[type]=fn},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
let confirmAllowed=true;
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://test.invalid"},{clipboard:{writeText:async()=>{}}},()=>confirmAllowed,()=>null
);
const ops=window.RFOPS;
const id="11111111-1111-4111-8111-111111111111";
const active={id,title:"AI course",status:"active",session_count:10};
const settings={id,status:"active",course_type:"group",session_count:10,schedule_note:"Saturday"};
let rpcResult=null,writeCount=0,lastBody=null;
const gateway=async(action,{path,body})=>{
 if(path?.includes("/rest/v1/rpc/academy_update_course_ops")){
  writeCount++;lastBody=body;return rpcResult;
 }
 if(path?.includes("/academy_courses?select=id,course_type"))return [settings];
 if(path?.includes("/academy_courses?select=id,title"))return [active];
 return [];
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function tab(){handlers.click({target:{closest:s=>s==="[data-rfops-tab]"?{dataset:{rfopsTab:"courses"}}:null},preventDefault(){}})}
globalThis.FormData=class {
 constructor(form){this.values=form.values}
 get(key){return this.values[key]??null}
 has(key){return Object.hasOwn(this.values,key)}
};
const form={id:"rfops-course-ops",values:{course_id:id,course_type:"private",session_count:"12",schedule_note:"Mondays"}};
function submit(){handlers.submit({target:form,preventDefault(){}})}
await ops.load({kind:"staff",role:"viewer"},gateway);tab();
assert(!ops.render({kind:"staff",role:"viewer"}).includes("rfops-course-ops"),"Viewer must not see edit form");
submit();await tick();await tick();
assert.equal(writeCount,0,"Viewer must not submit writes");
ops.reset();
await ops.load({kind:"staff",role:"registrar"},gateway);tab();
assert(ops.render({kind:"staff",role:"registrar"}).includes("rfops-course-ops"),"Registrar should see course editor");
form.values.session_count="0";submit();await tick();await tick();
assert.equal(writeCount,0,"Invalid session count must be rejected");
form.values.session_count="12";
rpcResult={};submit();await tick();await tick();
assert.equal(writeCount,1,"Expected one RPC write");
assert(ops.render({kind:"staff",role:"registrar"}).includes("ذخیره برنامه در سرور تأیید نشد"),"Empty server response must not be success");
rpcResult={id,course_type:"private",session_count:12,schedule_note:"Mondays"};
submit();await tick();await tick();
assert.equal(writeCount,2);
assert.deepEqual(lastBody,{p_course_id:id,p_course_type:"private",p_session_count:12,p_schedule_note:"Mondays"});
assert(ops.render({kind:"staff",role:"registrar"}).includes("برنامه دوره با تأیید سرور به‌روزرسانی شد."),"Confirmed write should succeed");
active.status="archived";settings.status="archived";
submit();await tick();await tick();
assert.equal(writeCount,2,"Archived course must never be edited");
console.log("PASS: course editor viewer denial, registrar access, invalid inputs, confirmed RPC, archived-course denial");
