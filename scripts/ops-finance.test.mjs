// Offline QA: finance installments use authorized projections; viewer never requests private records.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";

const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const root={addEventListener(){},contains(){return true}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>false,()=>null
);
const ops=window.RFOPS;
const requests=[];
const data={
 academy_courses:[{id:"c1",title:"دوره آزمون",status:"active"}],
 academy_students:[{id:"s1",full_name:"هنرجوی آزمایشی",user_id:"u1",status:"active"}],
 academy_enrollments:[{id:"e1",student_id:"s1",course_id:"c1",status:"active",final_fee:200},{id:"e2",student_id:"s1",course_id:"c1",status:"active",final_fee:1000}],
 academy_installments:[{id:"i1",enrollment_id:"e1",installment_no:1,amount:1000,paid_amount:300,due_date:"2026-11-01",status:"partial"}],
 academy_payment_submissions:[{id:"p1",amount:300,method:"bank",status:"pending",submitted_at:"2026-10-23"}],
 academy_payments:[{id:"pay1",enrollment_id:"e1",amount:300,paid_at:"2026-10-23",status:"posted"},{id:"pay2",enrollment_id:"e1",amount:500,paid_at:"2026-10-24",status:"void"}]
};
const api=async(_,{path})=>{
 requests.push(path);
 if(path==="/rest/v1/rpc/academy_finance_reconciliation_snapshot")return {
  posted_count:1,posted_total:300,voided_count:1,open_installment_count:1,
  remaining_installments:700,missing_schedule_count:1,enrollment_count:2
 };
 const table=Object.keys(data).find(k=>path.startsWith("/rest/v1/"+k+"?"));
 return table?data[table]:[];
};
await ops.load({kind:"staff",role:"finance"},api);
const finance=ops.render({kind:"staff",role:"finance"});
assert(finance.includes("هنرجوی آزمایشی"),"Finance should show the enrolled student");
assert(finance.includes("دوره آزمون"),"Finance should show the linked course");
assert(finance.includes("۷۰۰ تومان"),"Outstanding balance must be amount minus paid");
assert(finance.includes("۳۰۰ تومان"),"Paid installment amount must be shown");
assert(finance.includes("سررسید و وضعیت اقساط"),"Installment schedule missing");
assert(finance.includes("دفتر پرداخت‌های ثبت‌شده"),"Posted payment ledger must be separate from receipt submissions");
assert(finance.includes("۱ پرونده با پرداخت ثبت‌شده بیش از شهریه نهایی"),"Overpaid enrollment should trigger a reconciliation warning");
assert(finance.includes("۱۰۰ تومان"),"Overpayment discrepancy must use posted payments minus final fee");
assert(finance.includes("جمع پرداخت‌های ثبت‌شده در دفتر"),"Posted payment summary missing");
assert(finance.includes("جمع‌بندی مالی از محاسبه کامل و کنترل‌شده سرور"),"Finance totals must be uncapped server-side");
assert(finance.includes("پرداخت‌های ابطال‌شده: ۱ مورد"),"Voided payments must be excluded and disclosed");
assert(requests.includes("/rest/v1/rpc/academy_finance_reconciliation_snapshot"),"Finance role must request RLS-scoped aggregate");
ops.reset();
const failingApi=async(action,body)=>{
 if(body.path==="/rest/v1/rpc/academy_finance_reconciliation_snapshot")throw Error("temporarily unavailable");
 return api(action,body);
};
await ops.load({kind:"staff",role:"finance"},failingApi);
assert(ops.render({kind:"staff",role:"finance"}).includes("جمع‌بندی قطعی مالی از سرور دریافت نشد"),"Unavailable aggregate must fail closed");

assert(finance.includes("ثبت‌نام بدون برنامه اقساط"),"Unscheduled enrollment warning missing");
assert(finance.includes("۱ ثبت‌نام برنامه اقساط ندارد"),"Do not infer settlement from missing schedule");
assert(requests.some(x=>x.startsWith("/rest/v1/academy_payments?select=id,enrollment_id,installment_id,amount,paid_at,status")),"Use minimal RLS-scoped payment projection");
assert(!requests.some(x=>/emergency_name|emergency_mobile|reference_no/.test(x)),"Do not fetch unused private details");
ops.reset();
requests.length=0;
await ops.load({kind:"staff",role:"viewer"},api);
assert.deepEqual(requests.length,1,"Viewer should load one public-like courses projection");
assert(requests[0].startsWith("/rest/v1/academy_courses?"),"Viewer must not fetch student/finance data");
const viewer=ops.render({kind:"staff",role:"viewer"});
assert(viewer.includes("دوره آزمون"),"Viewer must retain the read-only course view");
assert(!viewer.includes("هنرجوی آزمایشی"),"Viewer must not display private student data");
assert(!viewer.includes("۷۰۰ تومان"),"Viewer must not display financial data");
assert(!requests.some(x=>x.startsWith("/rest/v1/academy_payments?")),"Viewer must not request payment ledger");
console.log("PASS: installment balances and least-privilege viewer access");
