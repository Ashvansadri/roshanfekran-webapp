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
 students:["academy_students","id,full_name,user_id,email,status,archived_at,portal_enabled,emergency_name,emergency_mobile"],
 enrollments:["academy_enrollments","id,student_id,course_id,status,final_fee,created_at"],
 applications:["academy_registration_requests","id,full_name,course_id,status,deposit_amount,installment_count,submitted_at,payment_plan"],
 payments:["academy_payment_submissions","id,student_id,enrollment_id,status,amount,submitted_at,method,reference_no"],
 installments:["academy_installments","id,enrollment_id,installment_no,amount,paid_amount,due_date,status"],
 classes:["academy_classes","id,course_id,title,session_no,starts_at,status,published"],
 assignments:["academy_assignments","id,course_id,title,instructions,due_at,published,notify_guardians,created_at"],
 submissions:["academy_assignment_submissions","id,assignment_id,student_id,status,score,submitted_at,feedback"],
 guardians:["academy_guardians","id,full_name,email,user_id,active"],
 links:["academy_guardian_students","id,guardian_id,student_id,can_view_academic,can_view_attendance,can_view_finance,can_receive_notifications"],
 publicLinks:["academy_course_public_links","id,course_id,slug,active,show_in_public_catalog,deposit_amount,installment_enabled,installment_markup_percent,installment_max_count"]
};
const grants={
 owner:Object.keys(configs),
 manager:Object.keys(configs),
 finance:["courses","enrollments","payments","installments","students"],
 teacher:["courses","classes","assignments","submissions"],
 registrar:["courses","students","enrollments","applications","guardians","links"],
 viewer:["courses","students","enrollments","applications"],
};
let role=null, request=null, datasets={},failures={},inflight=null,selected="students",working=false,info="",warning="",generated="";
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
async function load(nextRole,apiFn){
 role=nextRole;request=apiFn;if(inflight)return inflight;
 const keys=available();
 inflight=(async()=>{
  const results=await Promise.allSettled(keys.map(async key=>{
   const [table,cols]=configs[key];
   return proxy("/rest/v1/"+table+"?select="+cols+"&limit=150&order="+(key==="applications"?"submitted_at":key==="payments"?"submitted_at":key==="assignments"?"created_at":"id")+".desc");
  }));
  datasets={};failures={};
  keys.forEach((key,i)=>{const r=results[i];if(r.status==="fulfilled"&&Array.isArray(r.value))datasets[key]=r.value;else failures[key]=r.status==="rejected"?String(r.reason?.message||r.reason):"داده معتبر دریافت نشد";});
  return true;
 })().finally(()=>{inflight=null;refresh()});
 return inflight;
}
const name=(table,id)=>{let x=row(table).find(r=>String(r.id)===String(id));return x?.title||x?.full_name||"—"};
function section(label,content){return '<section class="rf-panel rfops-section"><div class="rf-panel-title"><span>◈</span><h3>'+esc(label)+'</h3></div>'+content+'</section>'}
function empty(k,label){return failures[k]?'<div class="rfops-warn">این بخش فعلاً قابل خواندن نیست: '+esc(failures[k])+'</div>':'<div class="rf-empty">'+esc(label||"رکوردی در سطح دسترسی شما موجود نیست.")+'</div>'}
function tabs(){
 const allowed=[
 ["students","پرونده هنرجویان",enrollmentManager()],
 ["family","نظارت خانواده",familyManager()],
 ["applications","درخواست‌های ثبت‌نام",enrollmentManager()],
 ["courses","دوره‌ها و لینک‌ها",manage()],
 ["finance","مالی و اقساط",financial()],
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
 const students=row("students"),guardians=row("guardians"),links=row("links");
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
 const items=row("courses"), links=row("publicLinks");
 return section("مدیریت دوره‌ها و لینک ثبت‌نام",'<p>نمایش عمومی هر دوره تابع تنظیمات ثبت‌نام باز و لینک فعال در دیتابیس است؛ دوره بسته به‌صورت خودکار تبلیغ نمی‌شود.</p>'+
 (items.length?'<div class="rfops-cards">'+items.map(x=>{
 const link=links.find(y=>y.course_id===x.id&&y.active&&y.show_in_public_catalog);
 const shared=link?location.origin+"/#/course/"+encodeURIComponent(link.slug||""):"";
 return '<article class="rfops-card"><strong>'+esc(x.title)+'</strong><p>کد: '+esc(x.code||"خودکار")+' · ظرفیت: '+fa(x.capacity||0)+' · وضعیت: '+esc(x.status)+'</p><div class="rfops-actions">'+(shared?'<a href="'+esc(shared)+'" target="_blank" rel="noopener">لینک دوره ↗</a><button data-rfops="copy-course" data-url="'+esc(shared)+'">کپی</button>':'<span>ثبت‌نام عمومی هنوز باز نشده است.</span>')+'</div></article>';
 }).join("")+'</div>':empty("courses","دوره‌ای ثبت نشده است.")));
}
function finance(){
 const items=row("payments"),inst=row("installments");
 return section("کنترل رسیدها و اقساط",'<p>تأیید فیش فقط از طریق عملیات امن دیتابیس انجام می‌شود و پس از بررسی واقعی باید ثبت شود. هیچ مبلغی از روی اطلاعات نمایشی به حساب افزوده نمی‌شود.</p>'+
 '<div class="rfops-summary"><div><strong>'+fa(inst.filter(i=>i.status==="open"||i.status==="partial").length)+'</strong><span>اقساط باز</span></div><div><strong>'+fa(items.filter(i=>i.status==="pending").length)+'</strong><span>فیش‌های در انتظار</span></div></div>'+
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
 let content="";
 switch(selected){case"family":content=family();break;case"applications":content=applications();break;case"courses":content=courses();break;case"finance":content=finance();break;case"tasks":content=tasks();break;default:content=students();}
 return '<div class="rfops" id="rfops-main"><header class="rfops-top"><div><span>ACADEMY OPERATIONS / LIVE DATA</span><h2>مدیریت یکپارچه آموزشگاه</h2><p>دوره‌ها، ثبت‌نام‌ها، هنرجویان، خانواده، تکالیف و مالی در همین سامانه؛ بدون انتقال به Floot.</p></div><button data-rfops="reload" type="button">تازه‌سازی ↻</button></header>'+alert()+tabs()+(inflight?'<div class="rfops-loading">در حال دریافت اطلاعات مجاز…</div>':"")+content+'</div>';
}
async function act(action,element){
 if(working)return;warning="";info="";
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
   await proxy("/rest/v1/academy_guardian_students?id=eq."+encodeURIComponent(link),"PATCH",{
    can_view_academic:enable,can_view_attendance:enable,can_receive_notifications:enable,can_view_finance:false
   });
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
 }catch(e){warning=e instanceof Error?e.message:"عملیات انجام نشد";}
 finally{working=false;refresh()}
}
async function formSubmit(form){
 if(working)return;warning="";info="";generated="";
 const data=new FormData(form);
 try{
  if(form.id==="rfops-invite-guardian"){
   if(!familyManager()||!data.get("verified"))throw Error("مجوز مدیر و تأیید رابطه قانونی لازم است.");
   const student_id=String(data.get("student_id")||""),full_name=String(data.get("full_name")||"").trim(),email=String(data.get("email")||"").trim().toLowerCase();
   if(!uuid(student_id)||full_name.length<3||!email.includes("@"))throw Error("اطلاعات سرپرست کامل نیست.");
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
  }else if(form.id==="rfops-assignment"){
   if(!teacher())throw Error("فقط مدرس یا مدیر می‌تواند تکلیف بسازد.");
   const course_id=String(data.get("course_id")||""),title=String(data.get("title")||"").trim(),instructions=String(data.get("instructions")||"").trim(),due=String(data.get("due_at")||"");
   if(!uuid(course_id)||title.length<4||instructions.length<8||!due)throw Error("دوره، عنوان، توضیح و مهلت معتبر لازم است.");
   if(!confirm("این تکلیف منتشر و به هنرجویان مربوطه اعلان داده شود؟"))return;
   working=true;
   await proxy("/rest/v1/academy_assignments","POST",{course_id,title,instructions,due_at:new Date(due).toISOString(),published:true,notify_guardians:data.has("notify_guardians")}, "return=representation");
   info="تکلیف منتشر شد و اعلان مربوطه در صورت مجاز بودن ثبت خواهد شد.";
  }
  if(working)await load(role,request);
 }catch(e){warning=e instanceof Error?e.message:"عملیات انجام نشد";}
 finally{working=false;refresh()}
}
root?.addEventListener("click",event=>{
 const tab=event.target.closest("[data-rfops-tab]");if(tab&&root.contains(tab)){event.preventDefault();selected=String(tab.dataset.rfopsTab);info="";warning="";refresh();return}
 const button=event.target.closest("[data-rfops]");if(!button||!root.contains(button))return;
 event.preventDefault();act(button.dataset.rfops,button);
});
root?.addEventListener("submit",event=>{
 const form=event.target;
 if(form?.id!=="rfops-invite-guardian"&&form?.id!=="rfops-assignment")return;
 event.preventDefault();formSubmit(form);
});
window.RFOPS={load,render};
})();
