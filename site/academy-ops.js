/* Roshanfekran Unified Academy Operations — staff only; existing Supabase RLS owns authorization. */
(function(){
"use strict";
const root=document.getElementById("app");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0))+" تومان";
const fa=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
const when=v=>{if(!v)return "بدون تاریخ";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium"}).format(new Date(v))}catch{return "—"}};
const dateTime=v=>{if(!v)return "بدون زمان";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}catch{return "—"}};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));
// Excel-compatible UTF-8 CSV; escape formula prefixes even after invisible leading characters.
const csvCell=value=>{
 const raw=String(value??"");
 const safe=/^[\s\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]*[=+\-@]/u.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
};
const configs={
 courses:["academy_courses","id,title,code,status,teacher_name,start_date,capacity,session_count"],
 courseOps:["academy_courses","id,course_type,session_count,schedule_note,status"],
 students:["academy_students","id,full_name,user_id,status,archived_at"],
 enrollments:["academy_enrollments","id,student_id,course_id,status,final_fee,created_at"],
 applications:["academy_registration_requests","id,full_name,course_id,status,deposit_amount,installment_count,submitted_at,payment_plan"],
 payments:["academy_payment_submissions","id,student_id,enrollment_id,status,amount,submitted_at,method"],
 ledgerPayments:["academy_payments","id,enrollment_id,installment_id,amount,paid_at,status"],
 installments:["academy_installments","id,enrollment_id,installment_no,amount,paid_amount,due_date,status"],
 classes:["academy_classes","id,course_id,title,session_no,starts_at,ends_at,room,mode,status,published"],
 assignments:["academy_assignments","id,course_id,title,instructions,due_at,published,notify_guardians,created_at"],
 submissions:["academy_assignment_submissions","id,assignment_id,student_id,status,score,submitted_at,feedback"],
 guardians:["academy_guardians","id,full_name,email,mobile,user_id,active"],
 links:["academy_guardian_students","id,guardian_id,student_id,can_view_academic,can_view_attendance,can_view_finance,can_receive_notifications"],
 studentContracts:["academy_student_contracts","id,student_id,course_id,contract_no,start_date,end_date,status,delivered_copy"],
 staffContracts:["academy_staff_contracts","id,staff_user_id,contract_no,contract_type,start_date,end_date,status"],
 serviceRequests:["academy_student_requests","id,student_id,category,subject,body,status,priority,staff_note,created_at,updated_at"],
 documents:["academy_student_documents","id,student_id,title,file_name,mime_type,status,review_note,created_at"],
 publicLinks:["academy_course_public_links","id,course_id,slug,active,show_in_public_catalog,deposit_amount,installment_enabled,installment_markup_percent,installment_max_count"]
};
const grants={
 owner:Object.keys(configs),
 manager:Object.keys(configs),
 finance:["courses","enrollments","payments","ledgerPayments","installments","students"],
 teacher:["courses","classes","assignments","submissions"],
 registrar:["courses","courseOps","students","enrollments","applications","guardians","links","studentContracts","serviceRequests","documents"],
 viewer:["courses"],
};
let role=null, request=null, datasets={},failures={},inflight=null,selected="students",working=false,info="",warning="",generated="";
let sessionEpoch=0;
let attendanceClassId="",attendanceSnapshot=null;
let riskRows=[],riskFailure="";
let documentLink=null,contractLink=null;
// Clear every private projection and invitation link on logout or account switch.
function reset(){
 sessionEpoch++;role=null;request=null;datasets={};failures={};inflight=null;
 selected="students";working=false;info="";warning="";generated="";attendanceClassId="";attendanceSnapshot=null;
 riskRows=[];riskFailure="";documentLink=null;contractLink=null;window.RFDAILY?.reset?.();
}
const meRole=()=>String(role?.role||"");
const manage=()=>["owner","manager"].includes(meRole());
const financial=()=>["owner","manager","finance"].includes(meRole());
const enrollmentManager=()=>["owner","manager","registrar"].includes(meRole());
const teacher=()=>role?.kind==="teacher"||manage();
const familyManager=()=>manage();
function available(){return grants[meRole()]||((role?.kind==="teacher")?grants.teacher:[])}
async function proxy(path,method="GET",body=null,prefer){if(!request)throw Error("ابتدا با حساب معتبر وارد شوید.");return request("proxy",{path,method,body,...(prefer?{prefer}:{})},true)}
async function rpc(name,body={}){if(!/^academy_[a-z0-9_]+$/.test(name))throw Error("عملیات پشتیبانی نمی‌شود.");return proxy("/rest/v1/rpc/"+name,"POST",body)}
function row(k){return Array.isArray(datasets[k])?datasets[k]:[]}
function alert(){return (info?'<div class="rfops-ok" role="status">'+esc(info)+'</div>':"")+(warning?'<div class="rfops-warn" role="alert">'+esc(warning)+'</div>':"")}
function refresh(){window.RFCORE?.render?.()}
async function loadTeacher(generation){
 // The legacy teacher role intentionally has NO direct RLS access to courses,
 // enrollments or students. Only this server-scoped RPC supplies its roster.
 let core;
 try{core=await rpc("academy_teacher_workspace_core")}
 catch(e){
  if(generation!==sessionEpoch)return false;
  datasets={};failures={assignments:"دسترسی امن به دوره‌های مدرس برقرار نشد: "+String(e?.message||e)};
  return false;
 }
 if(generation!==sessionEpoch)return false;
 if(!core||!Array.isArray(core.courses)||!Array.isArray(core.students)){
  datasets={};failures={assignments:"پاسخ پرونده مدرس معتبر نیست؛ اطلاعاتی نمایش داده نشد."};
  return false;
 }
 const courses=core.courses.filter(c=>uuid(c.id)).map(c=>({
  id:c.id,title:String(c.title||""),code:String(c.code||""),status:String(c.status||"")
 }));
 const courseIds=new Set(courses.map(c=>c.id));
 // Deliberately discard phone, national ID and any additional RPC fields.
 const students=core.students.filter(s=>uuid(s.id)).map(s=>({
  id:s.id,full_name:String(s.full_name||"هنرجو")
 }));
 const next={courses,students,classes:[],assignments:[],submissions:[]};
 const failuresNext={};
 if(!courseIds.size){
  if(generation!==sessionEpoch)return false;
  datasets=next;failures=failuresNext;return true;
 }
 const courseFilter="&course_id=in.("+[...courseIds].map(encodeURIComponent).join(",")+")";
 const firstKeys=["classes","assignments"];
 const first=await Promise.allSettled(firstKeys.map(key=>{
  const [table,cols]=configs[key];
  return proxy("/rest/v1/"+table+"?select="+cols+courseFilter+"&limit=150");
 }));
 if(generation!==sessionEpoch)return false;
 firstKeys.forEach((key,i)=>{
  const response=first[i];
  if(response.status!=="fulfilled"||!Array.isArray(response.value)){
   failuresNext[key]=response.status==="rejected"?String(response.reason?.message||response.reason):"پاسخ معتبر نیست";
   return;
  }
  next[key]=response.value.filter(x=>courseIds.has(String(x.course_id)));
 });
 const assignmentIds=new Set(next.assignments.filter(a=>uuid(a.id)).map(a=>a.id));
 if(assignmentIds.size){
  try{
   const [table,cols]=configs.submissions;
   const filter="&assignment_id=in.("+[...assignmentIds].map(encodeURIComponent).join(",")+")";
   const rows=await proxy("/rest/v1/"+table+"?select="+cols+filter+"&limit=150");
   if(generation!==sessionEpoch)return false;
   if(!Array.isArray(rows))throw Error("پاسخ معتبر نیست");
   next.submissions=rows.filter(s=>assignmentIds.has(String(s.assignment_id)));
  }catch(e){if(generation!==sessionEpoch)return false;failuresNext.submissions=String(e?.message||e)}
 }
 if(generation!==sessionEpoch)return false;
 datasets=next;failures=failuresNext;
 return true;
}
async function load(nextRole,apiFn){
 role=nextRole;request=apiFn;if(inflight)return inflight;
 documentLink=null;contractLink=null;
 const generation=sessionEpoch;
 let job;
 job=(async()=>{
  if(nextRole?.kind==="teacher"){riskRows=[];riskFailure="";window.RFDAILY?.reset?.();return loadTeacher(generation);}
  const keys=available();
  const canSeeRisk=["owner","manager","registrar","finance"].includes(String(nextRole?.role||""));
  // The RPC checks the staff role server-side. Select only the fields shown; never request phone numbers.
  const riskPath="/rest/v1/rpc/academy_list_student_risk?select=student_id,full_name,status,risk_score,risk_reasons,overdue_count,overdue_amount,absent_count,required_docs,approved_docs";
  const jobs=keys.map(async key=>{
   const [table,cols]=configs[key];
   return proxy("/rest/v1/"+table+"?select="+cols+"&limit=150&order="+(key==="applications"?"submitted_at":key==="payments"?"submitted_at":["assignments","serviceRequests","documents"].includes(key)?"created_at":"id")+".desc");
  });
  if(canSeeRisk)jobs.push(proxy(riskPath,"POST",{}));
  if(["owner","manager"].includes(String(nextRole?.role||"")))jobs.push(window.RFDAILY?.load?.(nextRole,request));
  else window.RFDAILY?.reset?.();
  const results=await Promise.allSettled(jobs);
  if(generation!==sessionEpoch)return false;
  const nextData={},nextFailures={};
  keys.forEach((key,i)=>{const r=results[i];if(r.status==="fulfilled"&&Array.isArray(r.value))nextData[key]=r.value;else nextFailures[key]=r.status==="rejected"?String(r.reason?.message||r.reason):"داده معتبر دریافت نشد";});
  datasets=nextData;failures=nextFailures;
  const riskResult=canSeeRisk?results[keys.length]:null;
  const activeIds=new Set((nextData.students||[]).filter(s=>s.status!=="archived"&&s.archived_at==null).map(s=>String(s.id)));
  riskRows=canSeeRisk&&riskResult?.status==="fulfilled"&&Array.isArray(riskResult.value)?
   riskResult.value.filter(s=>activeIds.has(String(s.student_id))&&s.status!=="archived")
    .map(s=>({student_id:String(s.student_id),full_name:String(s.full_name||"—"),risk_score:Number(s.risk_score||0),
      risk_reasons:String(s.risk_reasons||""),overdue_count:Number(s.overdue_count||0),
      overdue_amount:Number(s.overdue_amount||0),absent_count:Number(s.absent_count||0),
      required_docs:Number(s.required_docs||0),approved_docs:Number(s.approved_docs||0)}))
    .sort((a,b)=>b.risk_score-a.risk_score).slice(0,150):[];
  riskFailure=!canSeeRisk?"":!Array.isArray(nextData.students)?"فهرست فعال هنرجویان دریافت نشد؛ گزارش برای حفظ حریم خصوصی نمایش داده نمی‌شود.":
   riskResult?.status==="rejected"?String(riskResult.reason?.message||riskResult.reason):
   !Array.isArray(riskResult?.value)?"پاسخ پایش هنرجویان معتبر نیست.":"";
  return true;
 })().finally(()=>{if(generation===sessionEpoch&&inflight===job){inflight=null;refresh()}});
 inflight=job;
 return job;
}
const name=(table,id)=>{let x=row(table).find(r=>String(r.id)===String(id));return x?.title||x?.full_name||"—"};
function section(label,content){return '<section class="rf-panel rfops-section"><div class="rf-panel-title"><span>◈</span><h3>'+esc(label)+'</h3></div>'+content+'</section>'}
function empty(k,label){return failures[k]?'<div class="rfops-warn">این بخش فعلاً قابل خواندن نیست: '+esc(failures[k])+'</div>':'<div class="rf-empty">'+esc(label||"رکوردی در سطح دسترسی شما موجود نیست.")+'</div>'}

function allowedTabs(){
 return [
 ["overview","نمای کلی",true],
 ["students","پرونده هنرجویان",enrollmentManager()],
 ["applications","درخواست‌های ثبت‌نام",enrollmentManager()],
 ["serviceDesk","خدمات هنرجویی",enrollmentManager()],
 ["documents","مدارک هنرجویان",enrollmentManager()],
 ["finance","مالی و اقساط",financial()],
 ["contracts","قراردادها",enrollmentManager()],
 ["courses","دوره‌ها و کلاس‌ها",enrollmentManager()||meRole()==="viewer"],
 ["tasks","تکالیف و کلاس‌ها",teacher()],
 ["family","نظارت خانواده",familyManager()],
 ["risk","پایش هنرجویان",["owner","manager","registrar","finance"].includes(meRole())],
 ["daily","انتشار نکته روز",manage()]
 ].filter(x=>x[2]);
}
function tabs(){
 const allowed=allowedTabs();
 if(!allowed.some(x=>x[0]===selected))selected=allowed.find(x=>x[0]!=="overview")?.[0]||"overview";
 return '<nav class="rfops-tabs" aria-label="بخش‌های مدیریت">'+allowed.map(x=>'<button type="button" data-rfops-tab="'+x[0]+'" aria-pressed="'+String(x[0]===selected)+'">'+x[1]+'</button>').join("")+'</nav>';
}
const ovIcons={
 overview:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>',
 students:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 6a3 3 0 0 1 0 6M18 15a5 5 0 0 1 4 5"/>',
 serviceDesk:'<path d="M4 5h16v14H4zM8 10h8M8 14h5"/>',
 documents:'<path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5M9 13h7M9 17h5"/>',
 applications:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 finance:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8M12 5v14"/>',
 contracts:'<path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5M9 13h7M9 17h5"/>',
 courses:'<path d="m2 9 10-5 10 5-10 5L2 9zm4 3v5c4 3 8 3 12 0v-5M22 10v7"/>',
 tasks:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v5M16 3v5M8 15h3m-3 3h7"/>',
 family:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 15a5 5 0 0 1 7 5v1"/>',
 risk:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 18h.01"/>',
 daily:'<path d="M9 18h6M10 22h4M8 14c-3-3-2-8 1-10 2-2 6-2 8 0 3 2 4 7 1 10-1 1-2 2-2 4H9c0-2-1-3-1-4z"/>'
};
function ovIcon(name){
 return '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(ovIcons[name]||ovIcons.overview)+'</svg>';
}
function overviewDashboard(){
 const keys=allowedTabs().filter(x=>x[0]!=="overview");
 const read=k=>Array.isArray(datasets[k])&&!failures[k];
 const quantity=(k,fn)=>read(k)?fa(fn?row(k).filter(fn).length:row(k).length):"—";
 const cards=[
  ["students","پرونده‌های قابل مشاهده",quantity("students")],
  ["applications","درخواست‌های ثبت‌نام",quantity("applications")],
  ["courses","دوره‌های قابل مشاهده",quantity("courses")],
  ["tasks","جلسات ثبت‌شده",quantity("classes")],
  ["finance","فیش‌های در انتظار بررسی",quantity("payments",p=>p.status==="pending")]
 ].filter(x=>keys.some(t=>t[0]===x[0])||(x[0]==="tasks"&&keys.some(t=>t[0]==="tasks")));
 const descriptions={
  students:"پرونده، وضعیت حساب و دسترسی هنرجویان",
  applications:"بررسی درخواست‌های تازه و وضعیت پذیرش",
  serviceDesk:"صندوق امن درخواست‌های خدمات هنرجویی",
  documents:"بررسی و تأیید مدارک با لینک خصوصی موقت",
  finance:"کنترل اقساط، پرداخت‌ها و گزارش‌های مالی",
  contracts:"قراردادهای هنرجویان و کارکنان مجاز",
  courses:"دوره‌ها، برنامه آموزشی و لینک‌های ثبت‌نام",
  tasks:"تکالیف، جلسات و ارزیابی مدرس",
  family:"ارتباط مجاز با خانواده و رضایت‌ها",
  risk:"پیگیری وضعیت آموزشی و اقساط",
  daily:"تولید، زمان‌بندی و انتشار محتوای آموزشی"
 };
 const dateNow=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:"Asia/Tehran",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date());
 const cardsHTML=keys.map(([k,title])=>
 '<button type="button" data-rfops-tab="'+k+'" class="rfov-module rfov-module-'+k+'">'+
 '<span class="rfov-module-art">'+ovIcon(k)+'</span><span class="rfov-module-copy"><strong>'+esc(title)+'</strong><small>'+esc(descriptions[k]||"مدیریت بخش آموزشگاه")+'</small></span>'+
 '<span class="rfov-module-arrow" aria-hidden="true">↖</span></button>').join("");
 const metricHTML=cards.map(([k,label,count])=>'<div class="rfov-metric"><span class="rfov-metric-icon">'+ovIcon(k)+'</span><div class="rfov-metric-copy"><span>'+esc(label)+'</span><strong>'+count+'</strong></div></div>').join("");
 const activities=[];
 if(read("applications"))row("applications").forEach(x=>activities.push({kind:"applications",title:"درخواست ثبت‌نام",description:"وضعیت: "+String(x.status||"نامشخص"),at:x.submitted_at||"",sortable:Date.parse(x.submitted_at||"")||0}));
 if(read("payments"))row("payments").forEach(x=>activities.push({kind:"finance",title:"فیش پرداخت ارسالی",description:"وضعیت: "+String(x.status||"نامشخص"),at:x.submitted_at||"",sortable:Date.parse(x.submitted_at||"")||0}));
 activities.sort((x,y)=>y.sortable-x.sortable);
 const activityHTML=activities.slice(0,4).map(x=>'<button type="button" class="rfov-activity-row" data-rfops-tab="'+x.kind+'"><span class="rfov-activity-icon">'+ovIcon(x.kind)+'</span><span class="rfov-activity-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.description)+'</small></span><time>'+esc(when(x.at))+'</time></button>').join("")||'<p class="rfov-empty">فعالیت ثبت‌شده‌ای در محدوده دسترسی این حساب برای نمایش وجود ندارد.</p>';
 const quick=keys.filter(x=>["applications","finance","courses","tasks","family","students"].includes(x[0])).slice(0,4);
 const quickHTML=quick.map(x=>'<button type="button" data-rfops-tab="'+x[0]+'">'+ovIcon(x[0])+'<span>'+esc(x[1])+'</span><b aria-hidden="true">←</b></button>').join("");
 return '<section class="rfov-overview" aria-label="نمای کلی مدیریت">'+
 '<div class="rfov-metrics"><div class="rfov-today"><span class="rfov-today-icon">'+ovIcon("tasks")+'</span><div><small>امروز به وقت ایران</small><strong>'+esc(dateNow)+'</strong><span>خوش آمدید به فضای مدیریت</span></div></div>'+metricHTML+'</div>'+
 '<div class="rfov-overline"><div><span>ACADEMY CONTROL CENTER</span><h2>بخش‌های مدیریت</h2><p>برای ورود به هر بخش، کارت آن را انتخاب کنید.</p></div><span class="rfov-overline-accent">✦</span></div>'+
 '<div class="rfov-module-grid">'+cardsHTML+'</div>'+
 '<div class="rfov-bottom-grid">'+
 '<section class="rfov-bottom-panel rfov-recent"><header><span class="rfov-panel-symbol">'+ovIcon("applications")+'</span><h3>آخرین درخواست‌ها و پرداخت‌ها</h3></header><div class="rfov-activity-list">'+activityHTML+'</div><p class="rfov-caption">اطلاعات از رکوردهای مجاز همین حساب دریافت می‌شوند.</p></section>'+
 '<section class="rfov-bottom-panel rfov-notices"><header><span class="rfov-panel-symbol">'+ovIcon("daily")+'</span><h3>راهنمای مدیریت امن</h3></header>'+
 '<div class="rfov-note"><span class="rfov-dot"></span><div><strong>آمار این صفحه واقعی و محدود به مجوز شماست</strong><small>علامت «—» یعنی اطلاعات آن بخش دریافت نشده است.</small></div></div>'+
 '<div class="rfov-note"><span class="rfov-dot rfov-dot-gold"></span><div><strong>امور مالی نیازمند تأیید مسئول مربوط است</strong><small>پیش از اصلاح مبالغ، قرارداد و دفتر پرداخت را مطابقت دهید.</small></div></div>'+
 '<div class="rfov-note"><span class="rfov-dot rfov-dot-blue"></span><div><strong>نظارت خانواده با مجوز انجام می‌شود</strong><small>اطلاعات خصوصی فقط برای حساب‌های دارای دسترسی معتبر نمایش داده می‌شود.</small></div></div></section>'+
 '<section class="rfov-bottom-panel rfov-shortcuts"><header><span class="rfov-panel-symbol">'+ovIcon("overview")+'</span><h3>دسترسی سریع</h3></header><div class="rfov-quick-grid">'+quickHTML+'</div></section>'+
 '</div></section>';
}

function students(){
 const rows=row("students");
 return section("پرونده و وضعیت دسترسی هنرجویان",'<div class="rfops-tools"><span>هنرجویان ثبت‌شده: '+fa(rows.length)+'</span><button type="button" data-rfops="reload">تازه‌سازی ↻</button></div>'+
 (rows.length?'<div class="rfops-table-wrap"><table><thead><tr><th>نام</th><th>وضعیت</th><th>ورود هنرجو</th><th>نظارت خانواده</th></tr></thead><tbody>'+rows.map(s=>{
 const links=row("links").filter(l=>l.student_id===s.id&&l.can_view_academic);
 return '<tr><td><strong>'+esc(s.full_name)+'</strong></td><td>'+esc(s.status||"—")+'</td><td>'+(s.user_id?"حساب متصل":'فعالسازی نشده')+'</td><td>'+(links.length?'فعال برای '+fa(links.length)+' سرپرست':'هنوز فعال نیست')+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("students","هنرجویی یافت نشد.")));
}
function riskDashboard(){
 const high=riskRows.filter(s=>s.risk_score>=50).length;
 const overdue=riskRows.filter(s=>s.overdue_count>0).length;
 const missingDocs=riskRows.filter(s=>s.required_docs>s.approved_docs).length;
 const summary='<div class="rfops-summary"><div><strong>'+fa(riskRows.length)+'</strong><span>هنرجوی فعال بررسی‌شده</span></div>'+
  '<div><strong>'+fa(high)+'</strong><span>امتیاز پیگیری ۵۰ یا بیشتر</span></div>'+
  '<div><strong>'+fa(overdue)+'</strong><span>دارای قسط معوق</span></div>'+
  '<div><strong>'+fa(missingDocs)+'</strong><span>مدارک نیازمند تکمیل</span></div></div>';
 const table=riskRows.length?'<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو</th><th>امتیاز پیگیری</th><th>دلیل</th><th>غیبت</th><th>اقساط معوق</th><th>مبلغ معوق</th><th>مدارک تأییدشده</th></tr></thead><tbody>'+
  riskRows.map(s=>'<tr><td><strong>'+esc(s.full_name)+'</strong></td><td>'+fa(s.risk_score)+' / ۱۰۰</td><td>'+esc(s.risk_reasons||"موردی ثبت نشده")+'</td><td>'+fa(s.absent_count)+'</td><td>'+fa(s.overdue_count)+'</td><td>'+money(s.overdue_amount)+'</td><td>'+fa(s.approved_docs)+' / '+fa(s.required_docs)+'</td></tr>').join("")+
  '</tbody></table></div>':'<div class="rf-empty">در سطح دسترسی فعلی هنرجوی فعالی برای پایش موجود نیست.</div>';
 return section("پایش آموزشی و مالی هنرجویان",'<p>گزارش فقط خواندنی و مخصوص کارکنان مجاز است. امتیازها بر اساس قواعد ثبت‌شده محاسبه می‌شوند، نه پیش‌بینی هوش مصنوعی؛ برای تصمیم‌گیری با پرونده اصلی تطبیق دهید. هیچ اعلان یا تغییری به‌صورت خودکار انجام نمی‌شود.</p>'+
  (riskFailure?'<div class="rfops-warn" role="alert">'+esc(riskFailure)+'</div>':summary+table)+
  '<p class="rf-caption">پرونده‌های آرشیوشده نمایش داده نمی‌شوند. شماره تماس، کد ملی و اطلاعات شناسایی اضافی در این نما دریافت نمی‌شوند.</p>');
}
function family(){
 const students=row("students").filter(s=>s.status!=="archived"&&s.archived_at==null),guardians=row("guardians"),links=row("links");
 const options=students.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>').join("");
 return section("نظارت خانواده با موبایل",'<p>بدون ایمیل: از پرونده هنرجو شماره قانونی پدر، مادر یا سرپرست را تأیید کنید. خانواده پس از دریافت OTP، با همان شماره به فضای نظارت اختصاصی دسترسی خواهد داشت. فعال‌سازی به‌تنهایی مجوز انتشار عمومی رزومه نیست.</p>'+
 '<form id="rfops-invite-guardian" class="rfops-form rfops-invite"><label>هنرجو<select name="student_id" required>'+options+'</select></label><label>نام سرپرست<input name="full_name" minlength="3" maxlength="90" required placeholder="نام قانونی"/></label><label>شماره موبایل سرپرست<input name="mobile" type="tel" inputmode="tel" autocomplete="off" required placeholder="۰۹۱۲..." dir="ltr"/></label><label>نسبت با هنرجو<select name="relationship"><option value="father">پدر</option><option value="mother">مادر</option><option value="guardian">سرپرست قانونی</option></select></label><label class="rfops-consent"><input type="checkbox" name="verified" required/> من هویت سرپرست و نسبت قانونی او را بررسی کرده‌ام و فعال‌شدن نظارت آموزشی را تأیید می‌کنم.</label><button class="btn btn-primary" type="submit" '+(working||!students.length?"disabled":"")+'>✓ ثبت و فعال‌سازی دسترسی سرپرست</button></form>'+
 '<div class="rfops-help"><strong>مراحل ساده برای خانواده</strong><span>۱. مدیر ارتباط را ثبت می‌کند</span><span>۲. سرپرست از «ورود با موبایل» کد یک‌بارمصرف می‌گیرد</span><span>۳. بعد از تأیید پیامک، پیشرفت و تکالیف را می‌بیند</span></div>'+
  '<h4>سرپرستان متصل</h4>'+
 (links.length?'<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو</th><th>سرپرست</th><th>هویت</th><th>نظارت تحصیلی</th><th>اعلان داخلی</th></tr></thead><tbody>'+links.map(l=>{
  const g=guardians.find(g=>g.id===l.guardian_id);
  return '<tr><td>'+esc(name("students",l.student_id))+'</td><td>'+esc(g?.full_name||"—")+'<small>'+esc(g?.mobile?g.mobile.replace(/(\+989\d{2})\d{5}(\d{2})/,"$1•••••$2"):g?.email||"")+'</small></td><td>'+(g?.user_id?"فعال":"منتظر فعال‌سازی")+'</td><td><button class="rfops-switch" type="button" data-rfops="family-switch" data-link="'+esc(l.id)+'" data-enabled="'+String(!l.can_view_academic)+'" aria-pressed="'+String(!!l.can_view_academic)+'">'+(l.can_view_academic?"✓ روشن":"○ خاموش")+'</button></td><td>'+(l.can_receive_notifications&&l.can_view_academic?"فعال":"خاموش")+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("links","هنوز سرپرستی به هنرجو متصل نشده است."))+
 '<p class="rf-caption">خاموش‌کردن نظارت، دیدن پرونده، تکالیف و اعلان‌های مربوط به این هنرجو را در سرور قطع می‌کند. ارسال اعلان گوشی نیازمند اجازه Push سرپرست است؛ اعلان‌های داخل سامانه به‌صورت خودکار ایجاد می‌شوند.</p>');
}
function serviceDesk(){
 // All replies use the audited, role-scoped RPC; direct PATCH is revoked in the database.
 if(!enrollmentManager())return "";
 if(!Array.isArray(datasets.students)||failures.students)
  return section("درخواست‌های خدمات هنرجویی",'<div class="rfops-warn" role="alert">فهرست هنرجویان فعال دریافت نشد؛ برای جلوگیری از نمایش اطلاعات نامرتبط، درخواست‌ها پنهان شدند.</div>');
 if(!Array.isArray(datasets.serviceRequests)||failures.serviceRequests)
  return section("درخواست‌های خدمات هنرجویی",'<div class="rfops-warn" role="alert">صندوق درخواست‌ها از سرور قابل دریافت نیست. هیچ داده‌ای به‌عنوان صفر درخواست نمایش داده نمی‌شود.</div>');
 const active=new Set(row("students").filter(s=>s.status!=="archived"&&s.archived_at==null).map(s=>String(s.id)));
 const items=row("serviceRequests").filter(x=>active.has(String(x.student_id)));
 const labels={financial:"مالی و اقساط",certificate:"گواهی",schedule:"برنامه کلاس",absence:"حضور و غیاب",documents:"مدارک",other:"سایر"};
 const status={open:"جدید",in_progress:"در حال بررسی",resolved:"پاسخ داده‌شده",closed:"بسته"};
 const pending=items.filter(x=>!["resolved","closed"].includes(x.status)).length;
 const cards=items.map(x=>{
  const editable=uuid(x.id)&&["open","in_progress","resolved","closed"].includes(x.status);
  const statusOptions=[["open","جدید"],["in_progress","در حال بررسی"],["resolved","پاسخ داده‌شده"],["closed","بسته"]]
   .map(([value,label])=>'<option value="'+value+'"'+(x.status===value?' selected':'')+'>'+label+'</option>').join("");
  const priorityOptions=[["low","کم"],["normal","عادی"],["high","بالا"],["urgent","فوری"]]
   .map(([value,label])=>'<option value="'+value+'"'+(x.priority===value?' selected':'')+'>'+label+'</option>').join("");
  const editor=editable?'<details class="rfops-service-editor"><summary>رسیدگی و ثبت پاسخ امن</summary>'+
   '<form class="rfops-form rfops-service-form" data-rfops-form="service-reply" data-id="'+esc(x.id)+'">'+
   '<label>وضعیت<select name="status" required>'+statusOptions+'</select></label>'+
   '<label>اولویت<select name="priority" required>'+priorityOptions+'</select></label>'+
   '<label class="rfops-wide">پاسخ قابل مشاهده برای هنرجو<textarea name="staff_note" maxlength="4000" rows="3" placeholder="نتیجه بررسی و اقدام بعدی">'+esc(x.staff_note||"")+'</textarea></label>'+
   '<button type="submit" '+(working?'disabled':'')+'>ثبت پاسخ و وضعیت ←</button>'+
   '<small class="rfops-wide">تغییرات فقط پس از تأیید سرور و ثبت رویداد حسابرسی نمایش داده می‌شوند.</small></form></details>':"";
  return '<article class="rfops-card"><div><strong>'+esc(x.subject||"درخواست بدون عنوان")+'</strong><span>'+esc(name("students",x.student_id))+'</span></div>'+
   '<p>'+esc(labels[x.category]||"سایر")+' · '+esc(status[x.status]||x.status||"نامشخص")+' · '+when(x.created_at)+'</p>'+
   '<p class="rfops-service-body">'+esc(x.body||"")+'</p>'+
   (x.staff_note?'<div class="rfops-help"><strong>پاسخ ثبت‌شده</strong><span>'+esc(x.staff_note)+'</span></div>':"")+editor+'</article>';
 }).join("");
 return section("صندوق خدمات هنرجویی",'<p>درخواست‌های مالی، گواهی، برنامه کلاس، غیبت و مدارک از پورتال مستقل هنرجو دریافت می‌شوند. پاسخ‌ها فقط با کنترل نقش، پرونده فعال و ثبت رویداد سمت سرور ذخیره می‌شوند.</p>'+
  '<div class="rfops-summary"><div><strong>'+fa(items.length)+'</strong><span>درخواست قابل مشاهده</span></div><div><strong>'+fa(pending)+'</strong><span>در انتظار رسیدگی</span></div></div>'+
  (items.length?'<div class="rfops-cards">'+cards+'</div>':empty("serviceRequests","درخواستی از هنرجویان فعال ثبت نشده است."))+
  '<p class="rf-caption">فقط پرونده‌های فعال در این فهرست نمایش داده می‌شوند. حداکثر ۱۵۰ درخواست اخیر خوانده می‌شود و هیچ اطلاعاتی از این بخش به مرورگر عمومی ارسال نمی‌شود.</p>');
}
function documentsDesk(){
 if(!enrollmentManager())return "";
 if(!Array.isArray(datasets.students)||failures.students)
  return section("مدارک هنرجویان",'<div class="rfops-warn" role="alert">فهرست هنرجویان فعال در دسترس نیست؛ مدارک خصوصی نمایش داده نمی‌شوند.</div>');
 if(!Array.isArray(datasets.documents)||failures.documents)
  return section("مدارک هنرجویان",'<div class="rfops-warn" role="alert">دریافت مدارک ناموفق بود؛ این پیام به معنی نبود مدرک نیست.</div>');
 const active=new Set(row("students").filter(x=>x.status!=="archived"&&x.archived_at==null).map(x=>String(x.id)));
 const docs=row("documents").filter(x=>active.has(String(x.student_id))&&uuid(x.id));
 const labels={pending:"در انتظار بررسی",approved:"تأییدشده",rejected:"نیازمند اصلاح"};
 const cards=docs.map(x=>{
  const options=[["pending","در انتظار بررسی"],["approved","تأیید"],["rejected","رد با دلیل"]].map(([v,label])=>
   '<option value="'+v+'"'+(x.status===v?' selected':'')+'>'+label+'</option>').join("");
  const link=documentLink?.id===x.id&&documentLink.expires>Date.now()?
   '<a class="btn btn-outline" href="'+esc(documentLink.url)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">بازکردن فایل خصوصی ↗</a>':"";
  return '<article class="rfops-card"><div><strong>'+esc(x.title||"مدرک")+'</strong><span>'+esc(name("students",x.student_id))+'</span></div>'+
   '<p>'+esc(labels[x.status]||"وضعیت نامشخص")+' · '+esc(x.file_name||"فایل پیوست")+' · '+when(x.created_at)+'</p>'+
   (x.review_note?'<p class="rfops-service-body">'+esc(x.review_note)+'</p>':"")+
   '<div class="rfops-actions"><button type="button" data-rfops="document-link" data-id="'+esc(x.id)+'">دریافت لینک امن فایل</button>'+link+'</div>'+
   '<details class="rfops-service-editor"><summary>بررسی و تأیید مدرک</summary>'+
   '<form class="rfops-form rfops-service-form" data-rfops-form="document-review" data-id="'+esc(x.id)+'">'+
   '<label>نتیجه<select name="status" required>'+options+'</select></label>'+
   '<label class="rfops-wide">توضیح بررسی<textarea name="review_note" maxlength="1000" rows="3">'+esc(x.review_note||"")+'</textarea></label>'+
   '<button type="submit" '+(working?'disabled':'')+'>ثبت نتیجه با حسابرسی ←</button></form></details></article>';
 }).join("");
 return section("مرکز بررسی مدارک هنرجویان",'<p>مدارک خصوصی فقط برای مدیریت و پذیرش مجاز نمایش داده می‌شوند. لینک فایل امضاشده و موقت است و بررسی مدرک در سرور حسابرسی می‌شود.</p>'+
  '<div class="rfops-summary"><div><strong>'+fa(docs.length)+'</strong><span>مدرک قابل بررسی</span></div><div><strong>'+fa(docs.filter(x=>x.status==="pending").length)+'</strong><span>در انتظار بررسی</span></div></div>'+
  (docs.length?'<div class="rfops-cards">'+cards+'</div>':empty("documents","مدرکی برای هنرجویان فعال ثبت نشده است."))+
  '<p class="rf-caption">فقط ۱۵۰ مدرک اخیر خوانده می‌شود؛ پرونده‌های آرشیوشده نمایش داده نمی‌شوند.</p>');
}
function applications(){
 const items=row("applications");
 return section("رسیدگی به درخواست‌های دوره",'<p>تأیید درخواست ممکن است هنرجو، ثبت‌نام و سابقه مالی واقعی بسازد؛ بنابراین هر درخواست فقط پس از بررسی اطلاعات و رسید تأیید می‌شود.</p>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>{
 const pending=!["approved","rejected","cancelled"].includes(x.status);
 return '<article class="rfops-card"><div><strong>'+esc(x.full_name)+'</strong><span>'+esc(name("courses",x.course_id))+'</span></div><p>وضعیت: '+esc(x.status)+' · بیعانه: '+money(x.deposit_amount)+'</p><small>'+when(x.submitted_at)+'</small>'+(pending?'<div class="rfops-actions"><button type="button" data-rfops="registration-approve" data-id="'+esc(x.id)+'" '+(working?"disabled":"")+'>تأیید ثبت‌نام</button><button type="button" data-rfops="registration-reject" data-id="'+esc(x.id)+'">رد درخواست</button></div>':'')+'</article>';
 }).join("")+'</div>':empty("applications","درخواست جدیدی وجود ندارد.")));
}
function courses(){
 const items=row("courses"), links=row("publicLinks"),operations=row("courseOps");
 return section("مدیریت دوره‌ها و لینک ثبت‌نام",'<p>نمایش عمومی هر دوره تابع تنظیمات ثبت‌نام باز و لینک فعال در دیتابیس است؛ دوره بسته به‌صورت خودکار تبلیغ نمی‌شود.</p>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>{
 const link=links.find(y=>y.course_id===x.id&&y.active&&y.show_in_public_catalog);
 const shared=link?location.origin+"/#/course/"+encodeURIComponent(link.slug||""):"";
 const current=operations.find(y=>y.id===x.id);
 const canEdit=enrollmentManager()&&x.status!=="archived"&&current;
 const type=String(current?.course_type||"group");
 const typeSelect=[["group","گروهی"],["private","خصوصی"],["semi_private","نیمه‌خصوصی"]].map(([value,label])=>'<option value="'+value+'" '+(type===value?'selected':"")+'>'+label+'</option>').join("");
 const edit=canEdit?'<details class="rfops-course-editor"><summary>ویرایش برنامه آموزشی دوره</summary><form id="rfops-course-ops" class="rfops-form"><input type="hidden" name="course_id" value="'+esc(x.id)+'"/><label>نوع دوره<select name="course_type" required>'+typeSelect+'</select></label><label>تعداد جلسات<input name="session_count" type="number" min="1" max="200" step="1" required value="'+esc(current.session_count||x.session_count||1)+'"/></label><label>توضیحات برنامه<textarea name="schedule_note" maxlength="500" rows="3" placeholder="روز و ساعت برگزاری، شرایط کلاس">'+esc(current.schedule_note||"")+'</textarea></label><button class="btn btn-primary" type="submit">ذخیره برنامه دوره</button><small>فقط نوع دوره، تعداد جلسات و توضیحات برنامه تغییر می‌کند؛ شهریه، اقساط و ثبت‌نام‌ها دست‌نخورده می‌مانند.</small></form></details>':"";
 return '<article class="rfops-card"><strong>'+esc(x.title)+'</strong><p>کد: '+esc(x.code||"خودکار")+' · ظرفیت: '+fa(x.capacity||0)+' · وضعیت: '+esc(x.status)+'</p><div class="rfops-actions">'+(shared?'<a href="'+esc(shared)+'" target="_blank" rel="noopener">لینک دوره ↗</a><button data-rfops="copy-course" data-url="'+esc(shared)+'">کپی</button>':'<span>ثبت‌نام عمومی هنوز باز نشده است.</span>')+'</div>'+edit+'</article>';
 }).join("")+'</div>':empty("courses","دوره‌ای ثبت نشده است."))+(enrollmentManager()&&failures.courseOps?'<p class="rfops-warn">ویرایش دوره فعلاً در دسترس نیست: '+esc(failures.courseOps)+'</p>':""));
}
function contracts(){
 // Attachment URLs are never fetched in list projections. The gateway checks the
 // current staff role and Supabase RLS again before issuing a short-lived link.
 const studentItems=row("studentContracts"),staffItems=manage()?row("staffContracts"):[];
 const activeStudents=new Set(row("students").filter(s=>s.status!=="archived"&&s.archived_at==null).map(s=>String(s.id)));
 const linkButton=(kind,c)=>{
  const eligible=kind==="staff"?manage():activeStudents.has(String(c.student_id));
  if(!eligible||!uuid(c.id))return "";
  const ready=contractLink?.id===c.id&&contractLink.kind===kind&&contractLink.expires>Date.now();
  return '<div class="rfops-actions"><button type="button" data-rfops="contract-link" data-kind="'+kind+'" data-id="'+esc(c.id)+'" '+(working?"disabled":"")+'>دریافت لینک امن قرارداد</button>'+
   (ready?'<a class="btn btn-outline" href="'+esc(contractLink.url)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">بازکردن نسخه خصوصی ↗</a>':"")+'</div>';
 };
 const studentRows=studentItems.map(c=>'<tr><td>'+esc(c.contract_no||"ثبت نشده")+'</td><td>'+esc(name("students",c.student_id))+'</td><td>'+esc(name("courses",c.course_id))+'</td><td>'+when(c.start_date)+'</td><td>'+when(c.end_date)+'</td><td>'+esc(c.status||"—")+'</td><td>'+(c.delivered_copy?"تحویل‌شده":"ثبت نشده")+'</td><td>'+linkButton("student",c)+'</td></tr>').join("");
 const staffRows=staffItems.map(c=>'<tr><td>'+esc(c.contract_no||"ثبت نشده")+'</td><td>'+esc(c.contract_type||"—")+'</td><td>'+when(c.start_date)+'</td><td>'+when(c.end_date)+'</td><td>'+esc(c.status||"—")+'</td><td>'+linkButton("staff",c)+'</td></tr>').join("");
 const studentTable=studentRows?'<div class="rfops-table-wrap"><table><thead><tr><th>شماره قرارداد</th><th>هنرجو</th><th>دوره</th><th>شروع</th><th>پایان</th><th>وضعیت</th><th>نسخه تحویلی</th><th>فایل خصوصی</th></tr></thead><tbody>'+studentRows+'</tbody></table></div>':empty("studentContracts","قرارداد هنرجویی قابل مشاهده‌ای وجود ندارد.");
 const staffTable=staffRows?'<div class="rfops-table-wrap"><table><thead><tr><th>شماره قرارداد</th><th>نوع</th><th>شروع</th><th>پایان</th><th>وضعیت</th><th>فایل خصوصی</th></tr></thead><tbody>'+staffRows+'</tbody></table></div>':empty("staffContracts","قرارداد کارکنان قابل مشاهده‌ای وجود ندارد.");
 return section("قراردادها و وضعیت تحویل",'<p>خلاصه قراردادها فقط‌خواندنی است. فایل خصوصی صرفاً پس از درخواست صریح کارمند مجاز و تأیید مجدد سرور، با لینک موقت باز می‌شود. امضای الکترونیکی و ثبت تعهد مالی فعال نیست.</p>'+
 '<div class="rfops-summary"><div><strong>'+fa(studentItems.length)+'</strong><span>قرارداد هنرجویی قابل مشاهده</span></div>'+(manage()?'<div><strong>'+fa(staffItems.length)+'</strong><span>قرارداد کارکنان قابل مشاهده</span></div>':"")+'</div>'+
 '<h4>قراردادهای هنرجویان</h4>'+studentTable+
 (manage()?'<h4>قرارداد کارکنان</h4>'+staffTable:"")+
 '<p class="rf-caption">فایل‌ها تنها در فضای خصوصی Supabase نگهداری می‌شوند؛ لینک دریافت‌شده کوتاه‌مدت است و نباید برای اشخاص دیگر ارسال شود. قراردادهای فاقد فایل قابل بازکردن نیستند.</p>');
}
function finance(){
 const items=row("payments"),ledger=row("ledgerPayments"),inst=row("installments"),enrollments=row("enrollments");
 const enrollmentMap=new Map(enrollments.map(e=>[String(e.id),e]));
 const scheduleIds=new Set(inst.map(i=>String(i.enrollment_id)));
 const missingSchedules=enrollments.filter(e=>["active","pending"].includes(String(e.status))&&!scheduleIds.has(String(e.id)));
 const open=inst.filter(i=>["open","partial"].includes(String(i.status)));
 const remaining=open.reduce((total,i)=>total+Math.max(0,Number(i.amount||0)-Number(i.paid_amount||0)),0);
 const posted=ledger.filter(p=>p.status==="posted");
 const postedTotal=posted.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 // Compare posted ledger with contracted final fees; do not infer debt from missing schedules.
 // A capped/RLS-scoped projection may be incomplete, so only report positive discrepancies.
 const postedByEnrollment=new Map();
 for(const p of posted){
  const key=String(p.enrollment_id);
  postedByEnrollment.set(key,(postedByEnrollment.get(key)||0)+Number(p.amount||0));
 }
 const overpaid=enrollments.filter(e=>e.final_fee!==null&&e.final_fee!==undefined&&
  Number.isFinite(Number(e.final_fee))&&
  (postedByEnrollment.get(String(e.id))||0)>Number(e.final_fee));
 const overpaidExcess=overpaid.reduce((sum,e)=>sum+
  (postedByEnrollment.get(String(e.id))||0)-Number(e.final_fee),0);
 const schedule=inst.slice().sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||"")));
 const ready=key=>Array.isArray(datasets[key]);
 const figure=(key,value)=>ready(key)?fa(value):"—";
 const currency=(key,value)=>ready(key)?money(value):"—";
 const ledgerTable=ready("ledgerPayments")?(ledger.length?
  '<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو / دوره</th><th>تاریخ ثبت</th><th>مبلغ</th><th>وضعیت دفتر مالی</th></tr></thead><tbody>'+
  ledger.slice().sort((a,b)=>String(b.paid_at||"").localeCompare(String(a.paid_at||""))).slice(0,25).map(p=>{
   const enrollment=enrollmentMap.get(String(p.enrollment_id));
   return '<tr><td>'+esc(enrollment?name("students",enrollment.student_id):"—")+'<small>'+esc(enrollment?name("courses",enrollment.course_id):"—")+'</small></td><td>'+when(p.paid_at)+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.status||"—")+'</td></tr>';
  }).join("")+'</tbody></table></div>':
  '<div class="rf-empty">در دفتر مالی پرداخت قابل مشاهده‌ای ثبت نشده است.</div>'):
  '<div class="rfops-warn" role="alert">دفتر پرداخت‌ها بارگذاری نشد؛ مجموع پرداخت‌ها نامشخص است. '+esc(failures.ledgerPayments||"")+'</div>';
 return section("کنترل پرداخت‌ها، فیش‌ها و اقساط",
 '<p>دفتر پرداخت‌های ثبت‌شده از فیش‌های ارسالی برای بررسی جداست. مبلغ مانده فقط مربوط به اقساط ثبت‌شده است و به معنی کل بدهی هنرجویان نیست. گزارش حداکثر ۱۵۰ رکورد مجاز در هر جدول را پوشش می‌دهد.</p>'+
 '<div class="rfops-summary"><div><strong>'+figure("installments",open.length)+'</strong><span>اقساط بازِ ثبت‌شده</span></div>'+
 '<div><strong>'+figure("payments",items.filter(i=>i.status==="pending").length)+'</strong><span>فیش در انتظار بررسی</span></div>'+
 '<div><strong>'+currency("installments",remaining)+'</strong><span>مانده اقساط ثبت‌شده</span></div>'+
 '<div><strong>'+currency("ledgerPayments",postedTotal)+'</strong><span>جمع پرداخت‌های ثبت‌شده در دفتر</span></div>'+
 '<div><strong>'+(ready("enrollments")&&ready("installments")?fa(missingSchedules.length):"—")+'</strong><span>ثبت‌نام بدون برنامه اقساط</span></div></div>'+
 (ready("enrollments")&&ready("installments")&&missingSchedules.length?
  '<div class="rfops-warn" role="status">'+fa(missingSchedules.length)+' ثبت‌نام برنامه اقساط ندارد؛ این موضوع لزوماً بدهی یا نقص پرونده نیست (ممکن است نقدی باشد). برای تعیین مانده واقعی، دفتر پرداخت و قرارداد بررسی شود.</div>':"")+
 (ready("enrollments")&&ready("ledgerPayments")&&overpaid.length?
  '<div class="rfops-warn" role="alert">'+fa(overpaid.length)+' پرونده با پرداخت ثبت‌شده بیش از شهریه نهایی شناسایی شد (اختلاف مجموع: '+money(overpaidExcess)+'). پیش از اصلاح، قرارداد و دفتر مالی را تطبیق دهید. هشدار بر اساس رکوردهای بارگذاری‌شده است.</div>':"")+
 '<h4>سررسید و وضعیت اقساط</h4>'+
 (schedule.length?'<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو / دوره</th><th>قسط</th><th>سررسید</th><th>مبلغ</th><th>پرداخت‌شده</th><th>مانده</th><th>وضعیت</th></tr></thead><tbody>'+schedule.map(i=>{
  const e=enrollmentMap.get(String(i.enrollment_id));
  const left=Math.max(0,Number(i.amount||0)-Number(i.paid_amount||0));
  return '<tr><td>'+esc(e?name("students",e.student_id):"—")+'<small>'+esc(e?name("courses",e.course_id):"—")+'</small></td><td>'+fa(i.installment_no)+'</td><td>'+when(i.due_date)+'</td><td>'+money(i.amount)+'</td><td>'+money(i.paid_amount)+'</td><td>'+money(left)+'</td><td>'+esc(i.status||"—")+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("installments","قسطی در سطح دسترسی فعلی ثبت نشده است."))+
 '<h4>دفتر پرداخت‌های ثبت‌شده</h4>'+ledgerTable+
 '<h4>فیش‌های ارسالی برای بررسی</h4>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>'<article class="rfops-card"><strong>فیش '+money(x.amount)+'</strong><p>روش: '+esc(x.method||"—")+' · وضعیت: '+esc(x.status)+'</p><small>ثبت: '+when(x.submitted_at)+'</small>'+(x.status==="pending"?'<div class="rfops-actions"><button data-rfops="payment-approve" data-id="'+esc(x.id)+'">تأیید بررسی‌شده</button><button data-rfops="payment-reject" data-id="'+esc(x.id)+'">رد فیش</button></div>':"")+'</article>').join("")+'</div>':empty("payments","فیش جدیدی در این نما ثبت نشده است؛ این به معنی نبود پرداخت در دفتر مالی نیست.")));
}
function tasks(){
 const items=row("assignments"),classes=row("classes"),courses=row("courses"),students=row("students"),submissions=row("submissions");
 const assigned=courses.filter(c=>c.status==="active"||c.status==="planned");
 const classEditor=assigned.length?'<details class="rfops-course-editor rfops-session-editor"><summary>برنامه‌ریزی جلسه جدید</summary><form id="rfops-class" class="rfops-form"><label>دوره<select name="course_id" required>'+assigned.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label><label>عنوان جلسه<input name="title" minlength="3" maxlength="120" required placeholder="مثلاً کارگاه پروژه عملی"/></label><label>شماره جلسه<input name="session_no" type="number" min="1" max="200" step="1" required/></label><label>شروع جلسه<input name="starts_at" type="datetime-local" required/></label><label>پایان جلسه<input name="ends_at" type="datetime-local" required/></label><label>شیوه برگزاری<select name="mode"><option value="in_person">حضوری</option><option value="online">آنلاین</option><option value="hybrid">ترکیبی</option></select></label><label>اتاق یا محل برگزاری<input name="room" maxlength="100" placeholder="اختیاری"/></label><label class="rfops-consent"><input type="checkbox" name="published"/> جلسه همین حالا منتشر شود و برای هنرجویان ثبت‌نام‌شده اعلان داخلی ایجاد شود.</label><button class="btn btn-primary" type="submit" '+(working?"disabled":"")+'>ثبت جلسه در تقویم</button><small>به‌صورت پیش‌فرض پیش‌نویس است و اعلانی ارسال نمی‌شود. زمان‌ها براساس ساعت دستگاه شما وارد می‌شوند.</small></form></details>':'<p class="rf-caption">برای برنامه‌ریزی جلسه، ابتدا یک دوره فعال یا برنامه‌ریزی‌شده لازم است.</p>';
 const classTimeline=classes.length?'<div class="rfops-table-wrap"><table><thead><tr><th>دوره و جلسه</th><th>زمان شروع و پایان</th><th>نوع و مکان</th><th>وضعیت</th></tr></thead><tbody>'+classes.slice().sort((a,b)=>String(a.starts_at||"").localeCompare(String(b.starts_at||""))).map(c=>'<tr><td><strong>'+esc(c.title||"جلسه "+fa(c.session_no||0))+'</strong><small>'+esc(name("courses",c.course_id))+' · جلسه '+fa(c.session_no||0)+'</small></td><td>'+dateTime(c.starts_at)+'<small>تا '+dateTime(c.ends_at)+'</small></td><td>'+esc(({"in_person":"حضوری","online":"آنلاین","hybrid":"ترکیبی"})[c.mode]||"—")+'<small>'+esc(c.room||"—")+'</small></td><td>'+esc(c.status||"—")+'<small>'+(c.published?"منتشرشده":"پیش‌نویس")+'</small></td></tr>').join("")+'</tbody></table></div>':empty("classes","هنوز جلسه‌ای برای دوره‌های مجاز ثبت نشده است.");

 const attendanceClasses=classes.filter(c=>c.published&&["scheduled","completed"].includes(c.status));
 const attendanceSelector=attendanceClasses.length?
  '<div class="rfops-attendance-picks" role="group" aria-label="انتخاب جلسه برای حضور و غیاب">'+
  attendanceClasses.map(c=>'<button type="button" data-rfops="attendance-open" data-id="'+esc(c.id)+'" aria-pressed="'+String(attendanceClassId===c.id)+'">'+esc(c.title||"جلسه "+fa(c.session_no||0))+' · '+esc(name("courses",c.course_id))+'</button>').join("")+'</div>':
  '<div class="rf-empty">برای حضور و غیاب، ابتدا یک جلسه منتشرشده لازم است.</div>';
 let attendancePanel="";
 if(attendanceClassId){
  const currentClass=attendanceClasses.find(c=>c.id===attendanceClassId);
  if(!currentClass)attendancePanel='<div class="rfops-warn">این جلسه دیگر در فهرست مجاز نیست؛ صفحه را تازه‌سازی کنید.</div>';
  else if(attendanceSnapshot?.class_id!==attendanceClassId||!Array.isArray(attendanceSnapshot.roster))
   attendancePanel='<div class="rf-empty">فهرست امن هنرجویان این جلسه هنوز دریافت نشده است.</div>';
  else {
   const ready=Date.parse(currentClass.starts_at)<=Date.now();
   const summary={present:0,absent:0,late:0,excused:0,unmarked:0};
   for(const person of attendanceSnapshot.roster){
    if(Object.hasOwn(summary,person.status))summary[person.status]++;else summary.unmarked++;
   }
   const summaryHTML='<div class="rfops-attendance-summary" aria-label="خلاصه حضور و غیاب">'+
    [['present','حاضر'],['absent','غایب'],['late','با تأخیر'],['excused','موجه'],['unmarked','ثبت‌نشده']]
     .map(([key,label])=>'<div><strong>'+fa(summary[key])+'</strong><span>'+label+'</span></div>').join('')+
    '</div><button type="button" class="rfops-export" data-rfops="attendance-export" data-id="'+esc(attendanceClassId)+'">دریافت گزارش CSV این جلسه</button>'+
    '<p class="rf-caption">گزارش شامل اطلاعات هنرجویان همین جلسه است؛ فایل را فقط در محل امن نگهداری کنید.</p>';
   const forms=attendanceSnapshot.roster.map(s=>{
    const options=[["","انتخاب وضعیت"],["present","حاضر"],["absent","غایب"],["late","با تأخیر"],["excused","موجه"]]
     .map(([value,label])=>'<option value="'+value+'" '+(s.status===value?'selected':"")+'>'+label+'</option>').join("");
    return '<form class="rfops-attendance-form" data-rfops-form="attendance">'+
     '<input type="hidden" name="class_id" value="'+esc(attendanceClassId)+'"/>'+
     '<input type="hidden" name="student_id" value="'+esc(s.student_id)+'"/>'+
     '<div class="rfops-attendance-person"><strong>'+esc(s.name)+'</strong><small>'+(s.marked_at?'آخرین ثبت: '+esc(dateTime(s.marked_at)):'هنوز ثبت نشده')+'</small></div>'+
     '<label>وضعیت<select name="status" required>'+options+'</select></label>'+
     '<label>توضیح (اختیاری)<input name="note" maxlength="250" value="'+esc(s.note||"")+'" placeholder="توضیح کوتاه"/></label>'+
     '<button type="submit" '+(working||!ready?'disabled':'')+'>ثبت و تأیید</button></form>';
   }).join("");
   attendancePanel='<div class="rfops-attendance-board"><p class="rf-caption">'+
    (ready?'حضور هر هنرجو به‌صورت مستقل ثبت و با پاسخ سرور تأیید می‌شود.':'ثبت حضور فقط پس از شروع جلسه فعال می‌شود.')+
    '</p>'+summaryHTML+(forms||'<div class="rf-empty">هنرجوی فعال ثبت‌نام‌شده‌ای برای این جلسه وجود ندارد.</div>')+'</div>';
  }
 }
 return section("کلاس‌ها، تکالیف و ارزیابی",'<p>می‌توانید تکلیف منتشر کنید و وضعیت تحویل آن را از همین سامانه بررسی کنید. اگر گزینه اعلان سرپرست فعال باشد، تکالیف جدید و تکالیف عقب‌افتاده برای سرپرست دارای مجوز در مرکز اعلان ثبت می‌شوند.</p>'+
 classEditor+'<h4>تقویم جلسات ثبت‌شده</h4>'+classTimeline+'<h4>حضور و غیاب جلسات</h4>'+attendanceSelector+attendancePanel+'<h4>تعریف تکلیف</h4>'+'<form id="rfops-assignment" class="rfops-form"><label>دوره<select name="course_id" required>'+assigned.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label><label>عنوان تکلیف<input name="title" minlength="4" maxlength="150" required/></label><label>مهلت تکلیف<input name="due_at" type="datetime-local" required/></label><label class="rfops-wide">شرح تمرین<textarea name="instructions" rows="3" required minlength="8"></textarea></label><label class="rfops-consent"><input type="checkbox" name="notify_guardians" checked/> در صورت فعال بودن نظارت، خانواده هم تکلیف و تأخیر را ببیند.</label><button class="btn btn-primary" '+(!assigned.length||working?"disabled":"")+' type="submit">انتشار تکلیف و آگاه‌سازی</button></form>'+
 '<div class="rfops-summary"><div><strong>'+fa(classes.length)+'</strong><span>جلسه ثبت‌شده</span></div><div><strong>'+fa(items.length)+'</strong><span>تکلیف</span></div><div><strong>'+fa(submissions.length)+'</strong><span>تحویل انجام‌شده</span></div></div>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>{
 const subs=submissions.filter(s=>s.assignment_id===x.id);
 return '<article class="rfops-card"><strong>'+esc(x.title)+'</strong><p>'+esc(name("courses",x.course_id))+' · مهلت '+when(x.due_at)+' · '+(x.notify_guardians?"نظارت خانواده مجاز":"بدون اعلان خانواده")+'</p><small>تحویل‌ها: '+fa(subs.length)+'</small>'+
 subs.map(s=>'<div class="rfops-mark"><span>'+esc(name("students",s.student_id))+' · '+esc(s.status)+'</span><button type="button" data-rfops="grade" data-id="'+esc(s.id)+'" '+(working?"disabled":"")+'>ثبت ارزیابی</button></div>').join("")+'</article>';
 }).join("")+'</div>':empty("assignments","تکلیفی تعریف نشده است.")));
}
function render(nextRole){
 if(!nextRole||!["staff","teacher"].includes(nextRole.kind))return "";
 role=nextRole;
 const nav=tabs();
 let content="";
 switch(selected){case"overview":content=overviewDashboard();break;case"family":content=family();break;case"risk":content=riskDashboard();break;case"applications":content=applications();break;case"serviceDesk":content=serviceDesk();break;case"documents":content=documentsDesk();break;case"courses":content=courses();break;case"finance":content=finance();break;case"contracts":content=contracts();break;case"tasks":content=tasks();break;case"daily":content=window.RFDAILY?.render?.(nextRole)||"";break;default:content=students();}
 const header=selected==="overview"?"":'<header class="rfops-top"><div><span>ACADEMY OPERATIONS / SECURE WORKSPACE</span><h2>'+esc(allowedTabs().find(x=>x[0]===selected)?.[1]||"مدیریت آموزشگاه")+'</h2><p>این بخش از داده‌ها و مجوزهای فعلی حساب شما استفاده می‌کند.</p></div><button data-rfops="reload" type="button">تازه‌سازی ↻</button></header>';
 return '<div class="rfops rfops-view-'+selected+'" id="rfops-main">'+alert()+(selected==="overview"?content+(meRole()==="viewer"?'<div class="rfov-all-sections"><span>همه بخش‌های مجاز</span>'+nav+'</div>':""):header+nav+content)+(inflight?'<div class="rfops-loading">در حال دریافت اطلاعات مجاز…</div>':"")+'</div>';
}

async function act(action,element){
 if(working)return;const generation=sessionEpoch;warning="";info="";
 const id=String(element.dataset.id||""),link=String(element.dataset.link||"");
 try{
  if(action==="reload"){await load(role,request);return}
  if(action==="copy-link"||action==="copy-course"){
   const value=action==="copy-link"?generated:element.dataset.url;
   if(!value)throw Error("لینک هنوز موجود نیست.");await navigator.clipboard.writeText(value);
   info="لینک کپی شد.";return;
  }
  if(action==="attendance-export"){
   const cls=row("classes").find(c=>c.id===id&&c.published&&["scheduled","completed"].includes(c.status));
   if(!teacher()||!cls||!uuid(id)||attendanceClassId!==id||
      attendanceSnapshot?.class_id!==id||attendanceSnapshot.course_id!==cls.course_id||
      !Array.isArray(attendanceSnapshot.roster))throw Error("گزارش این جلسه در سطح دسترسی فعلی موجود نیست.");
   if(!confirm("گزارش حضور و غیاب این جلسه شامل نام هنرجویان است. فایل CSV دانلود شود؟"))return;
   const labels={present:"حاضر",absent:"غایب",late:"با تأخیر",excused:"موجه"};
   const rows=[["هنرجو","وضعیت","توضیح","زمان آخرین ثبت"],...attendanceSnapshot.roster.map(s=>[
    s.name,labels[s.status]||"ثبت‌نشده",s.note||"",s.marked_at?dateTime(s.marked_at):""
   ])];
   const csv="\uFEFF"+rows.map(columns=>columns.map(csvCell).join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
   try{
    const a=document.createElement("a");
    a.href=url;a.download="roshanfekran-attendance-"+id+".csv";a.style.display="none";
    document.body.appendChild(a);try{a.click()}finally{a.remove()}
   }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
   info="گزارش این جلسه آماده دانلود شد.";return;
  }
  if(action==="attendance-open"){
   if(!teacher()||!uuid(id)||!row("classes").some(c=>c.id===id&&c.published&&["scheduled","completed"].includes(c.status)))throw Error("این جلسه برای حضور و غیاب در دسترس نیست.");
   attendanceClassId=id;attendanceSnapshot=null;
   const snapshot=await rpc("academy_attendance_roster",{p_class_id:id});
   if(generation!==sessionEpoch)return;
   if(!snapshot||snapshot.class_id!==id||!Array.isArray(snapshot.roster))throw Error("فهرست امن حضور و غیاب معتبر دریافت نشد.");
   attendanceSnapshot=snapshot;info="فهرست هنرجویان مجاز جلسه دریافت شد.";
  }else if(action==="document-link"){
    if(!enrollmentManager()||!uuid(id)||!Array.isArray(datasets.students)||!Array.isArray(datasets.documents))throw Error("مجوز مشاهده مدرک معتبر نیست.");
    const doc=row("documents").find(x=>x.id===id);
    if(!doc||!row("students").some(x=>x.id===doc.student_id&&x.status!=="archived"&&x.archived_at==null))throw Error("مدرک یا پرونده فعال یافت نشد.");
    const result=await request("student_document_url",{document_id:id},true);
    if(generation!==sessionEpoch)return;
    let url;try{url=new URL(String(result?.url||""))}catch{throw Error("لینک فایل معتبر نیست.");}
    if(!result?.ok||url.origin!=="https://sdsdzktsqpahpdrgmzuo.supabase.co"||
       !url.pathname.startsWith("/storage/v1/object/sign/academy-student-documents/")||url.username||url.password||url.hash)
     throw Error("لینک فایل از دامنه امن آموزشگاه دریافت نشد.");
    documentLink={id,url:url.href,expires:Date.now()+9*60*1000};
    info="لینک موقت آماده است؛ روی «بازکردن فایل خصوصی» بزنید.";
  }else if(action==="contract-link"){
    const kind=String(element.dataset.kind||"");
    if(!enrollmentManager()||!uuid(id)||!["student","staff"].includes(kind))throw Error("مجوز دریافت قرارداد معتبر نیست.");
    if(kind==="staff"&&!manage())throw Error("فایل قرارداد کارکنان فقط برای مدیریت مجاز است.");
    const record=row(kind==="staff"?"staffContracts":"studentContracts").find(c=>c.id===id);
    if(!record)throw Error("قرارداد در فهرست مجاز حساب موجود نیست.");
    if(kind==="student"&&!row("students").some(s=>s.id===record.student_id&&s.status!=="archived"&&s.archived_at==null))
     throw Error("فایل قرارداد پرونده غیرفعال از این پنل قابل دریافت نیست.");
    const result=await request("contract_file_url",{kind,id},true);
    if(generation!==sessionEpoch)return;
    let url;try{url=new URL(String(result?.url||""))}catch{throw Error("لینک فایل قرارداد معتبر نیست.");}
    const bucket=kind==="staff"?"academy-staff-contracts":"academy-student-contracts";
    if(!result?.ok||url.protocol!=="https:"||url.origin!=="https://sdsdzktsqpahpdrgmzuo.supabase.co"||
       !url.pathname.startsWith("/storage/v1/object/sign/"+bucket+"/")||
       !url.searchParams.get("token")||url.username||url.password||url.port||url.hash)
     throw Error("سرور لینک امضاشده معتبر برای قرارداد صادر نکرد.");
    contractLink={id,kind,url:url.href,expires:Date.now()+9*60*1000};
    info="لینک موقت قرارداد صادر شد؛ روی «بازکردن نسخه خصوصی» بزنید.";
  }else if(action==="family-switch"){
   if(!familyManager())throw Error("فقط مدیر مجاز به تغییر دسترسی سرپرست است.");
   const rowValue=row("links").find(x=>x.id===link);if(!rowValue)throw Error("پیوند سرپرست یافت نشد.");
   const enable=element.dataset.enabled==="true";
   if(!confirm(enable?"نظارت این سرپرست بر پرونده هنرجو فعال شود؟":"نظارت و اعلان‌های این سرپرست برای این هنرجو قطع شود؟"))return;
   working=true;
   const updated=await proxy("/rest/v1/academy_guardian_students?id=eq."+encodeURIComponent(link),"PATCH",{
    can_view_academic:enable,can_view_attendance:enable,can_receive_notifications:enable,can_view_finance:false
   });
   // PostgREST may return HTTP 200 with [] when RLS filters out the target row.
   // A successful HTTP response is not proof that a guardian's access changed.
   if(!Array.isArray(updated)||updated.length!==1||
      String(updated[0].id)!==link||
      updated[0].can_view_academic!==enable||
      updated[0].can_view_finance!==false)
     throw Error("تغییر دسترسی سرپرست در پایگاه داده تأیید نشد؛ وضعیت قبلی حفظ شده است.");
   info=enable?"نظارت و اعلان داخلی فعال شد.":"نظارت این سرپرست از سمت سرور قطع شد.";
  }else if(action.startsWith("registration-")){
   if(!enrollmentManager())throw Error("دسترسی پذیرش فعال نیست.");
   const approve=action==="registration-approve",record=row("applications").find(x=>x.id===id);if(!record)throw Error("درخواست پیدا نشد.");
   if(!confirm(approve?"اطلاعات و رسید این متقاضی را بررسی کرده‌اید و ثبت‌نام قطعی شود؟":"این درخواست رد شود؟"))return;
   let due=null,count=0;
   if(approve&&Number(record.installment_count||0)>1){count=Number(record.installment_count);const raw=prompt("سررسید اولین قسط را به میلادی وارد کنید (YYYY-MM-DD). تعداد اقساط: "+count,"");if(raw===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw Error("تاریخ باید به شکل YYYY-MM-DD باشد.");due=raw}
   working=true;
   await rpc("academy_review_registration_request",{p_request_id:id,p_action:approve?"approve":"reject",p_review_note:null,p_installment_count:count,p_first_due:due});
   info=approve?"ثبت‌نام بعد از تأیید سرور ثبت شد.":"درخواست رد شد.";
  }else if(action.startsWith("payment-")){
   if(!financial())throw Error("دسترسی امور مالی فعال نیست.");
   if(!uuid(id))throw Error("فیش نامعتبر است.");
   const approve=action==="payment-approve";
   if(!confirm(approve?"رسید را با مدارک بانکی مطابقت داده‌اید؟ این عملیات پرداخت واقعی را ثبت می‌کند.":"فیش رد شود؟"))return;
   working=true;
   await rpc("academy_review_payment",{p_submission_id:id,p_action:approve?"approve":"reject",p_review_note:null});
   info=approve?"فیش با تأیید سرور در سوابق مالی ثبت شد.":"فیش رد شد.";
  }else if(action==="grade"){
   if(!teacher()||!uuid(id))throw Error("مجوز ارزیابی ندارید.");
   const raw=prompt("نمره از ۰ تا ۱۰۰", "");
   if(raw===null)return;
   const score=Number(raw);if(!Number.isFinite(score)||score<0||score>100||String(raw).trim()==="")throw Error("نمره بین ۰ تا ۱۰۰ لازم است.");
   const feedback=prompt("بازخورد مدرس برای هنرجو","")||"";
   if(!confirm("این نمره و بازخورد برای هنرجو ثبت شود؟"))return;
   working=true;await rpc("academy_grade_assignment",{p_submission_id:id,p_score:score,p_feedback:feedback});
   info="ارزیابی با کنترل مجوز در سرور ثبت شد.";
  }
  if(working)await load(role,request);
 }catch(e){if(generation===sessionEpoch)warning=e instanceof Error?e.message:"عملیات انجام نشد";}
 finally{if(generation===sessionEpoch){working=false;refresh()}}
}
async function formSubmit(form){
 if(working)return;const generation=sessionEpoch;warning="";info="";generated="";
 const data=new FormData(form);
 try{
  if(form.dataset?.rfopsForm==="document-review"){
    if(!enrollmentManager()||!Array.isArray(datasets.students)||!Array.isArray(datasets.documents))throw Error("مجوز بررسی مدارک فعال نیست.");
    const docId=String(form.dataset.id||""),doc=row("documents").find(x=>x.id===docId);
    if(!uuid(docId)||!doc||!row("students").some(x=>x.id===doc.student_id&&x.status!=="archived"&&x.archived_at==null))
     throw Error("مدرک یا پرونده فعال معتبر نیست.");
    const status=String(data.get("status")||""),note=String(data.get("review_note")||"").trim();
    if(!["pending","approved","rejected"].includes(status)||note.length>1000||(status==="rejected"&&note.length<3))
     throw Error("وضعیت یا دلیل رد مدرک معتبر نیست.");
    if(!confirm("نتیجه بررسی مدرک ثبت شود؟ این اقدام در سرور حسابرسی خواهد شد."))return;
    working=true;
    const result=await rpc("academy_review_student_document",{p_document_id:docId,p_status:status,p_review_note:note||null});
    if(!result?.ok||result.id!==docId||result.status!==status)throw Error("سرور ثبت بررسی را تأیید نکرد.");
    documentLink=null;info="نتیجه بررسی با تأیید سرور و حسابرسی ذخیره شد.";
   }else if(form.dataset?.rfopsForm==="service-reply"){
   if(!enrollmentManager())throw Error("مجوز رسیدگی به درخواست‌های هنرجویی فعال نیست.");
   const requestId=String(form.dataset.id||"");
   const record=row("serviceRequests").find(x=>x.id===requestId);
   if(!uuid(requestId)||!record||!row("students").some(s=>s.id===record.student_id&&s.archived_at==null&&s.status!=="archived"))
    throw Error("درخواست یا پرونده هنرجوی فعال یافت نشد.");
   const status=String(data.get("status")||""),priority=String(data.get("priority")||"");
   const note=String(data.get("staff_note")||"").trim();
   if(!["open","in_progress","resolved","closed"].includes(status)||
      !["low","normal","high","urgent"].includes(priority)||note.length>4000)
    throw Error("وضعیت، اولویت یا طول پاسخ معتبر نیست.");
   if(status==="resolved"&&note.length<3)throw Error("برای پاسخ‌داده‌شده، نتیجه رسیدگی را بنویسید.");
   if(!confirm("پاسخ و وضعیت این درخواست برای هنرجو ثبت شود؟ این اقدام در حسابرسی سرور ثبت می‌شود."))return;
   working=true;
   const saved=await rpc("academy_reply_service_request",{
    p_request_id:requestId,p_status:status,p_priority:priority,p_staff_note:note||null
   });
   if(!saved?.ok||String(saved.id)!==requestId||saved.status!==status||saved.priority!==priority)
    throw Error("ثبت پاسخ در سرور تأیید نشد؛ وضعیت درخواست را تازه‌سازی کنید.");
   info="پاسخ و وضعیت با تأیید سرور و ثبت حسابرسی ذخیره شد.";
  }else if(form.dataset?.rfopsForm==="attendance"){
   if(!teacher())throw Error("مجوز ثبت حضور و غیاب ندارید.");
   const class_id=String(data.get("class_id")||""),student_id=String(data.get("student_id")||"");
   const status=String(data.get("status")||""),note=String(data.get("note")||"").trim();
   const cls=row("classes").find(c=>c.id===class_id&&c.published&&["scheduled","completed"].includes(c.status));
   if(!uuid(class_id)||!uuid(student_id)||!cls||Date.parse(cls.starts_at)>Date.now()||
      attendanceClassId!==class_id||attendanceSnapshot?.class_id!==class_id||
      !attendanceSnapshot.roster.some(x=>x.student_id===student_id))throw Error("جلسه یا هنرجوی انتخاب‌شده مجاز نیست.");
   if(!["present","absent","late","excused"].includes(status)||note.length>250)throw Error("وضعیت حضور یا توضیح معتبر نیست.");
   if(!confirm("وضعیت حضور این هنرجو در جلسه ثبت شود؟"))return;
   working=true;
   const saved=await rpc("academy_mark_class_attendance",{p_class_id:class_id,p_student_id:student_id,p_status:status,p_note:note||null});
   if(!saved||saved.class_id!==class_id||saved.student_id!==student_id||saved.status!==status)
    throw Error("ثبت حضور توسط سرور تأیید نشد؛ پیش از تلاش دوباره وضعیت جلسه را بررسی کنید.");
   const snapshot=await rpc("academy_attendance_roster",{p_class_id:class_id});
   if(generation!==sessionEpoch)return;
   if(!snapshot||snapshot.class_id!==class_id||!Array.isArray(snapshot.roster))
    throw Error("ثبت تأیید شد اما تازه‌سازی فهرست انجام نشد؛ دوباره فهرست را باز کنید.");
   attendanceSnapshot=snapshot;info="وضعیت حضور هنرجو با تأیید سرور ثبت شد.";
  }else if(form.id==="rfops-invite-guardian"){
   if(!familyManager()||!data.get("verified"))throw Error("مجوز مدیر و تأیید نسبت قانونی سرپرست لازم است.");
   const student_id=String(data.get("student_id")||"");
   const full_name=String(data.get("full_name")||"").trim(),mobile=String(data.get("mobile")||"").trim(),relationship=String(data.get("relationship")||"guardian");
   if(!uuid(student_id)||full_name.length<3||!["father","mother","guardian"].includes(relationship))throw Error("نام، هنرجو و نسبت قانونی باید معتبر باشد.");
   if(!row("students").some(s=>s.id===student_id&&s.status!=="archived"&&s.archived_at==null))throw Error("پرونده هنرجوی فعال پیدا نشد.");
   if(!/^(?:09[0-9۰-۹]{9}|\+989[0-9۰-۹]{9}|989[0-9۰-۹]{9})$/.test(mobile))throw Error("شماره موبایل معتبر وارد کنید.");
   if(!confirm("هویت و نسبت سرپرست را بررسی کرده‌اید؟ نظارت آموزشی برای شماره موبایل او ثبت شود؟"))return;
   working=true;
   const saved=await rpc("academy_guardian_phone_invite",{p_student_id:student_id,p_full_name:full_name,p_phone:mobile,p_relationship:relationship});
   if(!saved?.ok)throw Error("سرور دعوت موبایلی را تأیید نکرد.");
   info="سرپرست با شماره "+String(saved.phone_masked||"").replace(/[<>]/g,"")+" ثبت شد. خانواده از همان صفحه ورود، کد پیامکی درخواست می‌کند.";
   generated="";
  }else if(form.id==="rfops-course-ops"){
    if(!enrollmentManager())throw Error("مجوز ویرایش برنامه دوره وجود ندارد.");
    const course_id=String(data.get("course_id")||"");
    const course=row("courses").find(c=>c.id===course_id&&c.status!=="archived");
    const existing=row("courseOps").find(c=>c.id===course_id&&c.status!=="archived");
    const course_type=String(data.get("course_type")||"");
    const session_count=Number(data.get("session_count"));
    const schedule_note=String(data.get("schedule_note")||"").trim();
    if(!uuid(course_id)||!course||!existing)throw Error("این دوره برای ویرایش در دسترس نیست.");
    if(!["group","private","semi_private"].includes(course_type)||!Number.isInteger(session_count)||session_count<1||session_count>200||schedule_note.length>500)throw Error("نوع دوره، تعداد جلسات یا توضیحات برنامه معتبر نیست.");
    if(!confirm("برنامه آموزشی این دوره به‌روزرسانی شود؟ شهریه و اقساط تغییر نمی‌کنند."))return;
    working=true;
    const result=await rpc("academy_update_course_ops",{p_course_id:course_id,p_course_type:course_type,p_session_count:session_count,p_schedule_note:schedule_note});
    if(!result||String(result.id)!==course_id||result.course_type!==course_type||Number(result.session_count)!==session_count||String(result.schedule_note||"")!==schedule_note)throw Error("ذخیره برنامه در سرور تأیید نشد؛ پیش از تلاش دوباره وضعیت دوره را بررسی کنید.");
    info="برنامه دوره با تأیید سرور به‌روزرسانی شد.";
  }else if(form.id==="rfops-class"){
   if(!teacher())throw Error("فقط مدرس یا مدیر می‌تواند جلسه آموزشی بسازد.");
   const course_id=String(data.get("course_id")||"");
   const title=String(data.get("title")||"").trim(),room=String(data.get("room")||"").trim();
   const session_no=Number(data.get("session_no")),mode=String(data.get("mode")||"");
   const startMs=Date.parse(String(data.get("starts_at")||"")),endMs=Date.parse(String(data.get("ends_at")||""));
   const published=data.has("published");
   if(!uuid(course_id)||!row("courses").some(c=>c.id===course_id&&["active","planned"].includes(c.status)))
    throw Error("دوره مجاز و فعال برای برنامه‌ریزی جلسه انتخاب نشده است.");
   if(title.length<3||title.length>120||room.length>100||!Number.isInteger(session_no)||session_no<1||session_no>200||
      !["in_person","online","hybrid"].includes(mode)||!Number.isFinite(startMs)||!Number.isFinite(endMs)||
      startMs<Date.now()-300000||endMs<=startMs||endMs-startMs>12*3600000)
    throw Error("عنوان، شماره جلسه، ساعت شروع و پایان یا شیوه برگزاری معتبر نیست (حداکثر ۱۲ ساعت).");
   if(row("classes").some(c=>c.course_id===course_id&&Number(c.session_no)===session_no&&c.status!=="cancelled"))
    throw Error("برای این دوره، شماره جلسه قبلاً ثبت شده است؛ قبل از ثبت دوباره فهرست را بررسی کنید.");
   if(!confirm(published?"جلسه منتشر شود؟ برای هنرجویان ثبت‌نام‌شده اعلان داخلی ایجاد خواهد شد.":"جلسه به‌صورت پیش‌نویس و بدون اعلان ثبت شود؟"))return;
   working=true;
   const created=await proxy("/rest/v1/academy_classes","POST",{
    course_id,title,session_no,starts_at:new Date(startMs).toISOString(),ends_at:new Date(endMs).toISOString(),
    mode,room:room||null,status:"scheduled",published
   },"return=representation");
   if(!Array.isArray(created)||created.length!==1||!uuid(created[0].id)||
      created[0].course_id!==course_id||Number(created[0].session_no)!==session_no||
      created[0].published!==published||created[0].status!=="scheduled")
    throw Error("ثبت جلسه در سرور تأیید نشد؛ پیش از تلاش دوباره فهرست جلسات را تازه‌سازی کنید.");
   info=published?"جلسه منتشر شد؛ اعلان داخلی برای هنرجویان واجد شرایط ایجاد می‌شود.":"جلسه به‌صورت پیش‌نویس و بدون اعلان ثبت شد.";
  }else if(form.id==="rfops-assignment"){
   if(!teacher())throw Error("فقط مدرس یا مدیر می‌تواند تکلیف بسازد.");
   const course_id=String(data.get("course_id")||""),title=String(data.get("title")||"").trim(),instructions=String(data.get("instructions")||"").trim(),due=String(data.get("due_at")||"");
   if(!uuid(course_id)||title.length<4||instructions.length<8||!due)throw Error("دوره، عنوان، توضیح و مهلت معتبر لازم است.");
   if(!confirm("این تکلیف منتشر و به هنرجویان مربوطه اعلان داده شود؟"))return;
   working=true;
   const created=await proxy("/rest/v1/academy_assignments","POST",{course_id,title,instructions,due_at:new Date(due).toISOString(),published:true,notify_guardians:data.has("notify_guardians")}, "return=representation");
   if(!Array.isArray(created)||created.length!==1||!uuid(created[0].id)||
      String(created[0].course_id)!==course_id||created[0].published!==true)
     throw Error("انتشار تکلیف در پایگاه داده تأیید نشد؛ لطفاً وضعیت دوره را دوباره بررسی کنید.");
   info="تکلیف منتشر شد و اعلان مربوطه در صورت مجاز بودن ثبت خواهد شد.";
  }
  if(working&&form.dataset?.rfopsForm!=="attendance")await load(role,request);
 }catch(e){if(generation===sessionEpoch)warning=e instanceof Error?e.message:"عملیات انجام نشد";}
 finally{if(generation===sessionEpoch){working=false;refresh()}}
}
root?.addEventListener("click",event=>{
 const tab=event.target.closest("[data-rfops-tab]");if(tab&&root.contains(tab)){event.preventDefault();selected=String(tab.dataset.rfopsTab);info="";warning="";refresh();return}
 const button=event.target.closest("[data-rfops]");if(!button||!root.contains(button))return;
 event.preventDefault();act(button.dataset.rfops,button);
});
root?.addEventListener("submit",event=>{
 const form=event.target;
 if(!["attendance","service-reply","document-review"].includes(form?.dataset?.rfopsForm)&&form?.id!=="rfops-invite-guardian"&&form?.id!=="rfops-assignment"&&form?.id!=="rfops-course-ops"&&form?.id!=="rfops-class")return;
 event.preventDefault();formSubmit(form);
});
window.RFOPS={load,render,reset,showOverview(){selected="overview"}};
})();
