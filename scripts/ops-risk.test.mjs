// Read-only risk dashboard regression: role isolation, minimal projection, archive filter and fail-closed behavior.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const src=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const listeners={},root={addEventListener(k,f){listeners[k]=f},contains(){return true}};
const window={RFCORE:{render(){}}},document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",src)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>false,()=>null
);
const ops=window.RFOPS;
const active="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",archived="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const riskPath="/rest/v1/rpc/academy_list_student_risk?select=";
const requests=[];
let denyRisk=false;
const api=async(_,{path})=>{
 requests.push(path);
 if(path.startsWith(riskPath)){
  if(denyRisk)throw Error("403 FORBIDDEN");
  return [
   {student_id:active,full_name:"ACTIVE_RISK_STUDENT",status:"active",risk_score:65,risk_reasons:"قسط معوق",overdue_count:2,overdue_amount:700,absent_count:3,required_docs:2,approved_docs:1,mobile:"SECRET_PHONE"},
   {student_id:archived,full_name:"ARCHIVED_RISK_STUDENT",status:"archived",risk_score:100,overdue_count:4,overdue_amount:900}
  ];
 }
 if(path.startsWith("/rest/v1/academy_students?"))return [
  {id:active,full_name:"ACTIVE_RISK_STUDENT",status:"active",archived_at:null},
  {id:archived,full_name:"ARCHIVED_RISK_STUDENT",status:"archived",archived_at:null}
 ];
 return [];
};
await ops.load({kind:"staff",role:"finance"},api);
assert(requests.some(x=>x.startsWith(riskPath)),"Finance should request scoped risk RPC");
assert(requests.every(x=>!x.includes("mobile")&&!x.includes("student_no")),"Risk query must not request unnecessary personal data");
listeners.click({target:{closest:s=>s==="[data-rfops-tab]"?{dataset:{rfopsTab:"risk"}}:null},preventDefault(){}});
let html=ops.render({kind:"staff",role:"finance"});
assert(html.includes("ACTIVE_RISK_STUDENT"),"Active student missing from risk view");
assert(html.includes("۶۵ / ۱۰۰"),"Risk score missing");
assert(!html.includes("ARCHIVED_RISK_STUDENT"),"Archived student must be filtered");
assert(!html.includes("SECRET_PHONE"),"Phone number must never render");
ops.reset();requests.length=0;
await ops.load({kind:"staff",role:"viewer"},api);
html=ops.render({kind:"staff",role:"viewer"});
assert(!requests.some(x=>x.startsWith(riskPath)),"Viewer must not fetch risk data");
assert(!html.includes('data-rfops-tab="risk"')&&!html.includes("ACTIVE_RISK_STUDENT"),"Viewer must not see risk view");
ops.reset();requests.length=0;denyRisk=true;
await ops.load({kind:"staff",role:"finance"},api);
listeners.click({target:{closest:s=>s==="[data-rfops-tab]"?{dataset:{rfopsTab:"risk"}}:null},preventDefault(){}});
html=ops.render({kind:"staff",role:"finance"});
assert(html.includes("403 FORBIDDEN"),"Risk RPC denial must be visible");
assert(!html.includes("ACTIVE_RISK_STUDENT"),"Failed RPC must not reuse prior private data");
ops.reset();
assert(!ops.render({kind:"staff",role:"finance"}).includes("403 FORBIDDEN"),"Reset must clear private errors");
console.log("PASS: scoped student risk dashboard, viewer isolation, archived exclusion and denial fail-closed");
