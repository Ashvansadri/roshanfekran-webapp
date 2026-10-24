// Offline regression: PostgREST 200 + [] must never be shown as a successful write.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";

const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const handlers={};
const root={
 addEventListener(type,fn){handlers[type]=fn},
 contains(){return true}
};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://test.invalid"},{clipboard:{writeText:async()=>{}}},()=>true,()=>null
);
const ops=window.RFOPS;
const link="11111111-1111-4111-8111-111111111111";
const course="22222222-2222-4222-8222-222222222222";
const assignment="33333333-3333-4333-8333-333333333333";
let patchResult=[],postResult=[];
const gateway=async(_,{path,method,body})=>{
 if(method==="PATCH")return patchResult;
 if(method==="POST"&&path==="/rest/v1/academy_assignments")return postResult;
 if(path.includes("/academy_guardian_students?"))return [{id:link,guardian_id:"g",student_id:"s",can_view_academic:true}];
 if(path.includes("/academy_guardians?"))return [{id:"g",full_name:"Parent"}];
 if(path.includes("/academy_students?"))return [{id:"s",full_name:"Student"}];
 if(path.includes("/academy_courses?"))return [{id:course,title:"Course",status:"active"}];
 return [];
};
await ops.load({kind:"staff",role:"owner"},gateway);
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function toggle(){
 handlers.click({
  target:{closest:selector=>selector==="[data-rfops]"?{dataset:{rfops:"family-switch",link,enabled:"false"}}:null},
  preventDefault(){}
 });
}
toggle();await settle();await settle();
let markup=ops.render({kind:"staff",role:"owner"});
assert(markup.includes("تغییر دسترسی سرپرست در پایگاه داده تأیید نشد"),"Zero-row RLS write must be rejected");
assert(!markup.includes("نظارت این سرپرست از سمت سرور قطع شد."),"Denied write must not show success");
patchResult=[{id:link,can_view_academic:false,can_view_finance:false}];
toggle();await settle();await settle();
markup=ops.render({kind:"staff",role:"owner"});
assert(markup.includes("نظارت این سرپرست از سمت سرور قطع شد."),"Verified guardian update must succeed");

// Node's FormData cannot accept a synthetic form; substitute only for this offline test.
globalThis.FormData=class {
 constructor(form){this.values=form.values}
 get(key){return this.values[key]??null}
 has(key){return Object.hasOwn(this.values,key)}
};
const form={id:"rfops-assignment",values:{
 course_id:course,title:"Practical assignment",instructions:"Complete and upload your project",
 due_at:"2026-10-30T10:00",notify_guardians:"on"
}};
function submit(){handlers.submit({target:form,preventDefault(){}})}
submit();await settle();await settle();
markup=ops.render({kind:"staff",role:"owner"});
assert(markup.includes("انتشار تکلیف در پایگاه داده تأیید نشد"),"Zero-row assignment insert must be rejected");
assert(!markup.includes("تکلیف منتشر شد و اعلان مربوطه"),"Denied insert must not show success");
postResult=[{id:assignment,course_id:course,published:true}];
submit();await settle();await settle();
markup=ops.render({kind:"staff",role:"owner"});
assert(markup.includes("تکلیف منتشر شد و اعلان مربوطه"),"Verified assignment insert must succeed");
console.log("PASS: guardian RLS zero-row denial, confirmed toggle, assignment insert denial and confirmation");
