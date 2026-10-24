/* Roshanfekran Unified Academy Operations — staff only; existing Supabase RLS owns authorization. */
(function(){
"use strict";
const root=document.getElementById("app");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0))+" تومان";
const fa=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
const when=v=>{if(!v)return "بدون تاریخ";try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium"}).format(new Date(v))}catch{return "—"}};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||""));
const configs={
 courses:["academy_courses","id,title,code,status,teacher_name,start_date,capacity,session_count"],
 courseOps:["academy_courses","id,course_type,session_count,schedule_note,status"],
 students:["academy_students","id,full_name,user_id,status,archived_at"],
 enrollments:["academy_enrollments","id,student_id,course_id,status,final_fee,created_at"],
 applications:["academy_registration_requests","id,full_name,course_id,status,deposit_amount,installment_count,submitted_at,payment_plan"],
 payments:["academy_payment_submissions","id,student_id,enrollment_id,status,amount,submitted_at,method"],
 installments:["academy_installments","id,enrollment_id,installment_no,amount,paid_amount,due_date,status"],
 classes:["academy_classes","id,course_id,title,session_no,starts_at,status,published"],
 assignments:["academy_assignments","id,course_id,title,instructions,due_at,published,notify_guardians,created_at"],
 submissions:["academy_assignment_submissions","id,assignment_id,student_id,status,score,submitted_at,feedback"],
 guardians:["academy_guardians","id,full_name,email,user_id,active"],
 links:["academy_guardian_students","id,guardian_id,student_id,can_view_academic,can_view_attendance,can_view_finance,can_receive_notifications"],
 studentContracts:["academy_student_contracts","id,student_id,course_id,contract_no,start_date,end_date,status,delivered_copy"],
 staffContracts:["academy_staff_contracts","id,staff_user_id,contract_no,contract_type,start_date,end_date,status"],
 publicLinks:["academy_course_public_links","id,course_id,slug,active,show_in_public_catalog,deposit_amount,installment_enabled,installment_markup_percent,installment_max_count"]
};
const grants={
 owner:Object.keys(configs),
 manager:Object.keys(configs),
 finance:["courses","enrollments","payments","installments","students"],
 teacher:["courses","classes","assignments","submissions"],
 registrar:["courses","courseOps","students","enrollments","applications","guardians","links","studentContracts"],
 viewer:["courses"],
};
let role=null, request=null, datasets={},failures={},inflight=null,selected="students",working=false,info="",warning="",generated="";
let sessionEpoch=0;
// Clear every private projection and invitation link on logout or account switch.
function reset(){
 sessionEpoch++;role=null;request=null;datasets={};failures={};inflight=null;
 selected="students";working=false;info="";warning="";generated="";
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
 const generation=sessionEpoch;
 let job;
 job=(async()=>{
  if(nextRole?.kind==="teacher")return loadTeacher(generation);
  const keys=available();
  const results=await Promise.allSettled(keys.map(async key=>{
   const [table,cols]=configs[key];
   return proxy("/rest/v1/"+table+"?select="+cols+"&limit=150&order="+(key==="applications"?"submitted_at":key==="payments"?"submitted_at":key==="assignments"?"created_at":"id")+".desc");
  }));
  if(generation!==sessionEpoch)return false;
  const nextData={},nextFailures={};
  keys.forEach((key,i)=>{const r=results[i];if(r.status==="fulfilled"&&Array.isArray(r.value))nextData[key]=r.value;else nextFailures[key]=r.status==="rejected"?String(r.reason?.message||r.reason):"داده معتبر دریافت نشد";});
  datasets=nextData;failures=nextFailures;
  return true;
 })().finally(()=>{if(generation===sessionEpoch&&inflight===job){inflight=null;refresh()}});
 inflight=job;
 return job;
}
const name=(table,id)=>{let x=row(table).find(r=>String(r.id)===String(id));return x?.title||x?.full_name||"—"};
function section(label,content){return '<section class="rf-panel rfops-section"><div class="rf-panel-title"><span>◈</span><h3>'+esc(label)+'</h3></div>'+content+'</section>'}
function empty(k,label){return failures[k]?'<div class="rfops-warn">این بخش فعلاً قابل خواندن نیست: '+esc(failures[k])+'</div>':'<div class="rf-empty">'+esc(label||"رکوردی در سطح دسترسی شما موجود نیست.")+'</div>'}
function tabs(){
 const allowed=[
 ["students","پرونده هنرجویان",enrollmentManager()],
 ["family","نظارت خانواده",familyManager()],
 ["applications","درخواست‌های ثبت‌نام",enrollmentManager()],
 ["courses","دوره‌ها و لینک‌ها",enrollmentManager()||meRole()==="viewer"],
 ["finance","مالی و اقساط",financial()],
 ["contracts","قراردادها",enrollmentManager()],
 ["tasks","تکالیف و کلاس‌ها",teacher()]
 ].filter(x=>x[2]);
 if(!allowed.some(x=>x[0]===selected))selected=allowed[0]?.[0]||"tasks";
 return '<nav class="rfops-tabs" aria-label="بخش‌های مدیریت">'+allowed.map(x=>'<button type="button" data-rfops-tab="'+x[0]+'" aria-pressed="'+String(x[0]===selected)+'">'+x[1]+'</button>').join("")+'</nav>';
}
function students(){
 const rows=row("students");
 return section("پرونده و وضعیت دسترسی هنرجویان",'<div class="rfops-tools"><span>هنرجویان ثبت‌شده: '+fa(rows.length)+'</span><button type="button" data-rfops="reload">تازه‌سازی ↻</button></div>'+
 (rows.length?'<div class="rfops-table-wrap"><table><thead><tr><th>نام</th><th>وضعیت</th><th>ورود هنرجو</th><th>نظارت خانواده</th></tr></thead><tbody>'+rows.map(s=>{
 const links=row("links").filter(l=>l.student_id===s.id&&l.can_view_academic);
 return '<tr><td><strong>'+esc(s.full_name)+'</strong></td><td>'+esc(s.status||"—")+'</td><td>'+(s.user_id?"حساب متصل":'فعالسازی نشده')+'</td><td>'+(links.length?'فعال برای '+fa(links.length)+' سرپرست':'هنوز فعال نیست')+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("students","هنرجویی یافت نشد.")));
}
function family(){
 const students=row("students").filter(s=>s.status!=="archived"&&s.archived_at==null),guardians=row("guardians"),links=row("links");
 const options=students.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>').join("");
 return section("فعالسازی نظارت خانواده با یک تیک",'<p>سرپرست برای مشاهده پرونده فرزند، فقط هویت و ایمیل خودش را تأیید می‌کند؛ پس از آن همان صفحه ورود روشنفکران برای همه نقش‌ها استفاده می‌شود. این اتصال برای مشاهده خصوصی است و اجازه انتشار عمومی رزومه نیست.</p>'+
 '<form id="rfops-invite-guardian" class="rfops-form rfops-invite"><label>انتخاب هنرجو<select name="student_id" required>'+options+'</select></label><label>نام قانونی سرپرست<input name="full_name" minlength="3" maxlength="90" required placeholder="نام پدر، مادر یا سرپرست قانونی"/></label><label>ایمیل سرپرست<input type="email" name="email" required dir="ltr" placeholder="guardian@example.com"/></label><label>تلفن اختیاری<input name="mobile" dir="ltr" inputmode="tel" /></label><label class="rfops-consent"><input type="checkbox" name="verified" required/> من به‌عنوان مدیر، هویت و رابطه قانونی سرپرست را بررسی کرده‌ام و اجازه دسترسی آموزشی را تأیید می‌کنم.</label><button class="btn btn-primary" type="submit" '+(working||!students.length?"disabled":"")+'>✓ فعال‌سازی نظارت و دریافت لینک امن</button></form>'+
 (generated?'<div class="rfops-link"><strong>لینک اختصاصی فعال‌سازی</strong><p>این لینک را فقط به ایمیل تأییدشده سرپرست بفرستید.</p><div class="rfops-link-row"><input readonly dir="ltr" value="'+esc(generated)+'" id="rfops-invite-url"/><button type="button" data-rfops="copy-link">کپی لینک</button></div></div>':"")+
 '<h4>سرپرستان متصل</h4>'+
 (links.length?'<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو</th><th>سرپرست</th><th>هویت</th><th>نظارت تحصیلی</th><th>اعلان داخلی</th></tr></thead><tbody>'+links.map(l=>{
  const g=guardians.find(g=>g.id===l.guardian_id);
  return '<tr><td>'+esc(name("students",l.student_id))+'</td><td>'+esc(g?.full_name||"—")+'<small>'+esc(g?.email||"")+'</small></td><td>'+(g?.user_id?"فعال":"منتظر فعال‌سازی")+'</td><td><button class="rfops-switch" type="button" data-rfops="family-switch" data-link="'+esc(l.id)+'" data-enabled="'+String(!l.can_view_academic)+'" aria-pressed="'+String(!!l.can_view_academic)+'">'+(l.can_view_academic?"✓ روشن":"○ خاموش")+'</button></td><td>'+(l.can_receive_notifications&&l.can_view_academic?"فعال":"خاموش")+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("links","هنوز سرپرستی به هنرجو متصل نشده است."))+
 '<p class="rf-caption">خاموش‌کردن نظارت، دیدن پرونده، تکالیف و اعلان‌های مربوط به این هنرجو را در سرور قطع می‌کند. ارسال اعلان گوشی نیازمند اجازه Push سرپرست است؛ اعلان‌های داخل سامانه به‌صورت خودکار ایجاد می‌شوند.</p>');
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
 // Read-only summary; the authenticated user's RLS is enforced by Supabase.
 // Do not expose file paths, private notes, or contract attachments here.
 const studentItems=row("studentContracts"),staffItems=manage()?row("staffContracts"):[];
 const studentRows=studentItems.map(c=>'<tr><td>'+esc(c.contract_no||"ثبت نشده")+'</td><td>'+esc(name("students",c.student_id))+'</td><td>'+esc(name("courses",c.course_id))+'</td><td>'+when(c.start_date)+'</td><td>'+when(c.end_date)+'</td><td>'+esc(c.status||"—")+'</td><td>'+(c.delivered_copy?"تحویل‌شده":"ثبت نشده")+'</td></tr>').join("");
 const staffRows=staffItems.map(c=>'<tr><td>'+esc(c.contract_no||"ثبت نشده")+'</td><td>'+esc(c.contract_type||"—")+'</td><td>'+when(c.start_date)+'</td><td>'+when(c.end_date)+'</td><td>'+esc(c.status||"—")+'</td></tr>').join("");
 const studentTable=studentRows?'<div class="rfops-table-wrap"><table><thead><tr><th>شماره قرارداد</th><th>هنرجو</th><th>دوره</th><th>شروع</th><th>پایان</th><th>وضعیت</th><th>نسخه تحویلی</th></tr></thead><tbody>'+studentRows+'</tbody></table></div>':empty("studentContracts","قرارداد هنرجویی قابل مشاهده‌ای وجود ندارد.");
 const staffTable=staffRows?'<div class="rfops-table-wrap"><table><thead><tr><th>شماره قرارداد</th><th>نوع</th><th>شروع</th><th>پایان</th><th>وضعیت</th></tr></thead><tbody>'+staffRows+'</tbody></table></div>':empty("staffContracts","قرارداد کارکنان قابل مشاهده‌ای وجود ندارد.");
 return section("قراردادها و وضعیت تحویل",'<p>این نما صرفاً خواندنی و محدود به مجوزهای سرور است. امضای الکترونیکی، دانلود فایل قرارداد و ثبت تعهد مالی در این نسخه فعال نیست.</p>'+
 '<div class="rfops-summary"><div><strong>'+fa(studentItems.length)+'</strong><span>قرارداد هنرجویی قابل مشاهده</span></div>'+(manage()?'<div><strong>'+fa(staffItems.length)+'</strong><span>قرارداد کارکنان قابل مشاهده</span></div>':"")+'</div>'+
 '<h4>قراردادهای هنرجویان</h4>'+studentTable+
 (manage()?'<h4>قراردادهای کارکنان</h4>'+staffTable:"")+
 '<p class="rf-caption">حداکثر ۱۵۰ رکورد اخیر در هر بخش نمایش داده می‌شود. وضعیت حقوقی قرارداد باید با نسخه امضاشده تطبیق داده شود.</p>');
}
function finance(){
 const items=row("payments"),inst=row("installments"),enrollments=row("enrollments");
 const byEnrollment=new Map(enrollments.map(e=>[String(e.id),e]));
 const open=inst.filter(i=>i.status==="open"||i.status==="partial");
 const remaining=open.reduce((total,i)=>total+Math.max(0,Number(i.amount||0)-Number(i.paid_amount||0)),0);
 const schedule=inst.slice().sort((a,b)=>String(a.due_date||"").localeCompare(String(b.due_date||"")));
 return section("کنترل رسیدها و اقساط",'<p>تأیید فیش فقط از طریق عملیات امن دیتابیس انجام می‌شود و پس از بررسی واقعی باید ثبت شود. مبالغ و شمارش‌ها مربوط به رکوردهای مجازِ بارگذاری‌شده‌اند و گزارش حسابداری قطعی نیستند.</p>'+
 '<div class="rfops-summary"><div><strong>'+fa(open.length)+'</strong><span>اقساط باز</span></div><div><strong>'+fa(items.filter(i=>i.status==="pending").length)+'</strong><span>فیش‌های در انتظار</span></div><div><strong>'+money(remaining)+'</strong><span>مانده اقساط بازِ بارگذاری‌شده</span></div></div>'+
 '<h4>سررسید و وضعیت اقساط</h4>'+
 (schedule.length?'<div class="rfops-table-wrap"><table><thead><tr><th>هنرجو / دوره</th><th>قسط</th><th>سررسید</th><th>مبلغ</th><th>پرداخت‌شده</th><th>مانده</th><th>وضعیت</th></tr></thead><tbody>'+schedule.map(i=>{
  const e=byEnrollment.get(String(i.enrollment_id));
  const left=Math.max(0,Number(i.amount||0)-Number(i.paid_amount||0));
  return '<tr><td>'+esc(e?name("students",e.student_id):"—")+'<small>'+esc(e?name("courses",e.course_id):"—")+'</small></td><td>'+fa(i.installment_no)+'</td><td>'+when(i.due_date)+'</td><td>'+money(i.amount)+'</td><td>'+money(i.paid_amount)+'</td><td>'+money(left)+'</td><td>'+esc(i.status||"—")+'</td></tr>';
 }).join("")+'</tbody></table></div>':empty("installments","قسطی در سطح دسترسی فعلی ثبت نشده است."))+
 '<h4>بررسی فیش‌های واریزی</h4>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>'<article class="rfops-card"><strong>درخواست پرداخت '+money(x.amount)+'</strong><p>روش: '+esc(x.method||"—")+' · وضعیت: '+esc(x.status)+'</p><small>ثبت: '+when(x.submitted_at)+'</small>'+(x.status==="pending"?'<div class="rfops-actions"><button data-rfops="payment-approve" data-id="'+esc(x.id)+'">تأیید بررسی‌شده</button><button data-rfops="payment-reject" data-id="'+esc(x.id)+'">رد فیش</button></div>':"")+'</article>').join("")+'</div>':empty("payments","فیش پرداختی در این نما ثبت نشده است.")));
}
function tasks(){
 const items=row("assignments"),classes=row("classes"),courses=row("courses"),students=row("students"),submissions=row("submissions");
 const assigned=courses.filter(c=>c.status==="active"||c.status==="planned");
 return section("کلاس‌ها، تکالیف و ارزیابی",'<p>می‌توانید تکلیف منتشر کنید و وضعیت تحویل آن را از همین سامانه بررسی کنید. اگر گزینه اعلان سرپرست فعال باشد، تکالیف جدید و تکالیف عقب‌افتاده برای سرپرست دارای مجوز در مرکز اعلان ثبت می‌شوند.</p>'+
 '<form id="rfops-assignment" class="rfops-form"><label>دوره<select name="course_id" required>'+assigned.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label><label>عنوان تکلیف<input name="title" minlength="4" maxlength="150" required/></label><label>مهلت تکلیف<input name="due_at" type="datetime-local" required/></label><label class="rfops-wide">شرح تمرین<textarea name="instructions" rows="3" required minlength="8"></textarea></label><label class="rfops-consent"><input type="checkbox" name="notify_guardians" checked/> در صورت فعال بودن نظارت، خانواده هم تکلیف و تأخیر را ببیند.</label><button class="btn btn-primary" '+(!assigned.length||working?"disabled":"")+' type="submit">انتشار تکلیف و آگاه‌سازی</button></form>'+
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
 // Resolve permitted tab before choosing the content; never render a stale tab from a previous role.
 const nav=tabs();
 let content="";
 switch(selected){case"family":content=family();break;case"applications":content=applications();break;case"courses":content=courses();break;case"finance":content=finance();break;case"contracts":content=contracts();break;case"tasks":content=tasks();break;default:content=students();}
 return '<div class="rfops" id="rfops-main"><header class="rfops-top"><div><span>ACADEMY OPERATIONS / LIVE DATA</span><h2>مدیریت یکپارچه آموزشگاه</h2><p>دوره‌ها، ثبت‌نام‌ها، هنرجویان، خانواده، تکالیف و مالی در همین سامانه؛ بدون انتقال به Floot.</p></div><button data-rfops="reload" type="button">تازه‌سازی ↻</button></header>'+alert()+nav+(inflight?'<div class="rfops-loading">در حال دریافت اطلاعات مجاز…</div>':"")+content+'</div>';
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
  if(action==="family-switch"){
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
  if(form.id==="rfops-invite-guardian"){
   if(!familyManager()||!data.get("verified"))throw Error("مجوز مدیر و تأیید رابطه قانونی لازم است.");
   const student_id=String(data.get("student_id")||""),full_name=String(data.get("full_name")||"").trim(),email=String(data.get("email")||"").trim().toLowerCase();
   if(!uuid(student_id)||full_name.length<3||!email.includes("@"))throw Error("اطلاعات سرپرست کامل نیست.");
   if(!row("students").some(s=>s.id===student_id&&s.status!=="archived"&&s.archived_at==null))throw Error("این هنرجو فعال نیست و نمی‌توان نظارت جدید ایجاد کرد.");
   if(row("links").some(l=>l.student_id===student_id&&row("guardians").some(g=>g.id===l.guardian_id&&g.email?.toLowerCase()===email)))
    throw Error("برای این سرپرست پیوند موجود است؛ از کلید روشن/خاموش همان ردیف استفاده کنید.");
   if(!confirm("هویت و رابطه سرپرست را تأیید می‌کنید و لینک فعال‌سازی اختصاصی صادر شود؟"))return;
   working=true;
   const result=await request("invite_guardian",{student_id,full_name,email,mobile:String(data.get("mobile")||""),relationship:"guardian",can_view_finance:false},true);
   const part=String(result.activation_path||"").split("?")[1]||"";
   const code=new URLSearchParams(part).get("code")||"";
   if(!/^[a-f0-9]{64}$/i.test(code))throw Error("لینک امن صادر نشد.");
   generated=location.origin+"/#/activate?kind=guardian&email="+encodeURIComponent(email)+"&code="+code;
   try{await navigator.clipboard.writeText(generated);info="سرپرست ثبت شد. لینک امن کپی شد؛ برای خودش بفرستید."}catch{info="سرپرست ثبت شد. لینک فعال‌سازی را فقط برای خودش ارسال کنید."}
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
  if(working)await load(role,request);
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
 if(form?.id!=="rfops-invite-guardian"&&form?.id!=="rfops-assignment"&&form?.id!=="rfops-course-ops")return;
 event.preventDefault();formSubmit(form);
});
window.RFOPS={load,render,reset};
})();
