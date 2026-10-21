(function(){
"use strict";
const END="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
const OLD="https://roshanfekran-academy-control.floot.app";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const safeURL=v=>{try{let u=new URL(String(v));return u.protocol==="https:"?u.href:"#"}catch{return "#"}};
const date=v=>{try{return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium"}).format(new Date(v))}catch{return "—"}};
const num=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
let session=null,role=null,journey=null,parent=null,familyTip=null,resume=null,works=[],missions=[],campaigns=[],staffData=null,profileFormOpen=false,workFormOpen=false,stage=0,busy=false,error="",notice="",loading=false,quizQuestions=null,quizLoading=false;
try{const saved=sessionStorage.getItem("rf_safe_session_v1");if(saved)session=JSON.parse(saved)}catch{sessionStorage.removeItem("rf_safe_session_v1")}
const token=()=>session?.access_token||"";
const setSession=x=>{session=x;sessionStorage.setItem("rf_safe_session_v1",JSON.stringify({access_token:x.access_token,refresh_token:x.refresh_token,expires_at:Date.now()+Number(x.expires_in||3600)*1000}))};
const clear=()=>{session=null;role=null;journey=null;parent=null;familyTip=null;works=[];missions=[];campaigns=[];sessionStorage.removeItem("rf_safe_session_v1")};
async function api(action,body={},auth=false){const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),16000);try{const r=await fetch(END,{method:"POST",headers:{"Content-Type":"application/json",...(auth&&token()?{Authorization:"Bearer "+token()}:{})},body:JSON.stringify({action,...body}),signal:ctl.signal});let d=await r.json().catch(()=>({error:"پاسخ سرور معتبر نیست"}));if(!r.ok||d?.error)throw Error(d?.error||"درخواست ناموفق بود");return d}finally{clearTimeout(timeout)}}
async function proxy(path,method="GET",body=null){return api("proxy",{path,method,body},true)}
async function rpc(name,body={}){if(!/^academy_[a-z0-9_]+$/.test(name))throw Error("عملیات معتبر نیست");return proxy("/rest/v1/rpc/"+name,"POST",body)}
function refresh(){if(window.RFCORE?.render)window.RFCORE.render();else window.dispatchEvent(new Event("hashchange"))}
function showError(e){error=e instanceof Error?e.message:String(e||"خطای غیرمنتظره");notice="";refresh()}
function showNotice(t){notice=t;error="";refresh()}
const actions=()=>'<div class="workspace-actions"><button type="button" class="portal-secondary" data-rf="refresh">به‌روزرسانی ↻</button><button type="button" class="portal-secondary" data-rf="logout">خروج ایمن ↗</button></div>';
const toast=()=>error?'<div class="portal-alert" role="alert">'+esc(error)+'</div>':notice?'<div class="portal-success" role="status">'+esc(notice)+'</div>':"";
const input=(id,title,value="",multiline=false)=>'<label class="portal-field"><span>'+esc(title)+'</span>'+(multiline?'<textarea id="'+id+'" rows="4">'+esc(value)+'</textarea>':'<input id="'+id+'" value="'+esc(value)+'" />')+'</label>';
const badge=s=>'<span class="rf-chip">'+esc(s)+'</span>';
const loadingHTML=()=>'<section class="shell rf-panel-container"><div class="rf-panel"><div class="rf-rotator"></div><h2>در حال دریافت اطلاعات امن...</h2><p>اطلاعات فقط پس از بررسی دسترسی شما نمایش داده می‌شوند.</p></div></section>';
async function loadWorkspace(){
 if(!session||loading)return;
 loading=true;try{
  role=await api("resolve_portal",{},true);
  if(role.kind==="student"){journey=await rpc("academy_student_journey_snapshot");await loadStudentExtras()}
  else if(role.kind==="guardian"){const a=await Promise.allSettled([rpc("academy_parent_journey_snapshot"),rpc("academy_family_tip_today")]);parent=a[0].status==="fulfilled"?a[0].value:null;familyTip=a[1].status==="fulfilled"?a[1].value:null}
  else if(role.kind==="staff"||role.kind==="teacher"){await loadStaffExtras()}
  error="";
 }catch(e){error=e.message||"ارتباط امن با حساب برقرار نشد";if(/AUTH_REQUIRED|JWT|401|expired|Unauthorized/.test(error))clear()}
 finally{loading=false;refresh()}
}
async function loadStudentExtras(){
 const items=await Promise.allSettled([
  proxy("/rest/v1/academy_showcase_works?select=id,title,description,category,project_url,review_status,review_note,created_at&order=created_at.desc"),
  proxy("/rest/v1/academy_mission_templates?select=id,mission_no,phase,title,objective,release_day,deliverable&order=mission_no.asc"),
  proxy("/rest/v1/academy_mission_campaigns?select=id,course_id,start_date,active&active=eq.true"),
 ]);
 works=items[0].status==="fulfilled"&&Array.isArray(items[0].value)?items[0].value:[];
 missions=items[1].status==="fulfilled"&&Array.isArray(items[1].value)?items[1].value:[];
 campaigns=items[2].status==="fulfilled"&&Array.isArray(items[2].value)?items[2].value:[];
}
async function loadStaffExtras(){
 const names=role.kind==="teacher"?["academy_courses","academy_assignments"]:["academy_courses","academy_students","academy_enrollments","academy_registration_requests"];
 const requests=names.map(n=>proxy("/rest/v1/"+n+"?select=*&limit=50"));
 const res=await Promise.allSettled(requests);
 staffData={};names.forEach((n,i)=>staffData[n]=res[i].status==="fulfilled"&&Array.isArray(res[i].value)?res[i].value:[]);
}
function heading(k,title,subtitle){return '<div class="rf-page-head"><div><div class="rf-overline">'+esc(k)+'</div><h1>'+title+'</h1><p>'+esc(subtitle)+'</p></div></div>'}
function loginPage(){
 return '<main class="rf-auth shell"><section class="rf-auth-story"><div class="eyebrow">ROSHANFEKRAN · SECURE SPACE</div><h1>یک حساب،<br/><span class="gradient-text">یک مسیر رشد متفاوت.</span></h1><p>سامانه نقش شما را پس از تأیید هویت شناسایی می‌کند؛ هنرجو، خانواده، مدرس و مدیریت هرکدام به محیط اختصاصی خود هدایت می‌شوند.</p><div class="rf-tick">◈ حریم خصوصی و امنیت اطلاعات اولویت ماست.</div></section><div class="rf-auth-card">'+
 '<div class="rf-auth-symbol">✧</div><span class="rf-overline">ACCOUNT ACCESS</span><h2>ورود به پورتال</h2><p>اطلاعات حساب فعال آموزشگاه را وارد کنید.</p>'+toast()+
 '<form id="rf-login" class="rf-form"><label class="portal-field"><span>ایمیل</span><input name="email" type="email" required autocomplete="username" placeholder="name@example.com" dir="ltr"/></label><label class="portal-field"><span>رمز عبور</span><input name="password" type="password" required autocomplete="current-password" minlength="8" placeholder="حداقل ۸ کاراکتر" dir="ltr"/></label><button class="btn btn-primary" type="submit" '+(busy?"disabled":"")+'>'+(busy?"در حال بررسی...":"ورود امن ←")+'</button></form>'+
 '<p class="rf-caption">هنوز حساب ندارید؟ پس از ثبت‌نام در دوره، لینک فعال‌سازی اختصاصی برایتان صادر می‌شود.</p><a class="thin-link" href="#/courses">مشاهده دوره‌ها ↗</a></div></main>';
}
function activate(){
 const frag=location.hash.split("?")[1]||"",q=new URLSearchParams(frag);
 const kind=q.get("kind")||"",email=q.get("email")||"",code=q.get("code")||"";
 const valid=["staff","student","guardian"].includes(kind)&&email.includes("@")&&/^[a-f0-9]{64}$/.test(code);
 return '<main class="shell rf-panel-container"><div class="rf-panel rf-activate"><div class="rf-auth-symbol">✧</div>'+heading("ACCOUNT INVITATION","فعال‌سازی امن حساب","هر لینک تنها برای نقش و ایمیل مشخص و تا زمان انقضا معتبر است.")+toast()+
 (valid?'<form id="rf-activate" class="rf-form"><input type="hidden" name="kind" value="'+esc(kind)+'"/><input type="hidden" name="email" value="'+esc(email)+'"/><input type="hidden" name="code" value="'+esc(code)+'"/><p>ایمیل دعوت‌شده: '+badge(email)+'</p><label class="portal-field"><span>رمز عبور</span><input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="رمز جدید یا رمز قبلی حساب موجود"/></label><button type="submit" class="btn btn-primary">تأیید لینک و ورود ←</button></form>':'<div class="portal-alert">لینک معتبر یا کامل نیست. از آموزشگاه لینک جدید درخواست کنید.</div>')+
 '<p class="rf-caption">اگر قبلاً حساب فعالی دارید، رمز قبلی شما تغییر نخواهد کرد.</p><a class="thin-link" href="#/access">ورود معمولی ←</a></div></main>';
}
function parentPage(){
 const children=Array.isArray(parent?.children)?parent.children:[];
 return '<main class="shell rf-dashboard">'+heading("FAMILY STUDIO","فضای خانواده","مسیر آموزشی، آثار تأییدشده و رشد فرزند فقط به سرپرست مجاز نشان داده می‌شود.")+
 actions()+toast()+'<div class="rf-stats"><div>'+badge("فرزندان مرتبط")+'<strong>'+num(children.length)+'</strong></div><div>'+badge("دروس خانواده")+'<strong>۳۰</strong></div><div>'+badge("زمان هر تمرین")+'<strong>۳ دقیقه</strong></div></div>'+
 '<section class="rf-grid-two"><div class="rf-panel"><div class="rf-panel-title"><span>✧</span><h3>پیشرفت فرزند</h3></div>'+
 (children.length?children.map(c=>'<article class="rf-child"><h3>'+esc(c.name)+'</h3><div class="rf-meters"><span>آثار تأییدشده</span><b>'+num(c.works_approved)+' / '+num(c.works_uploaded)+'</b></div><div class="rf-meters"><span>مأموریت‌های موفق</span><b>'+num(c.mission_approved_count)+'</b></div><div class="rf-meters"><span>آزمون مهارتی</span><b>'+(c.quiz_passed?"قبول‌شده":"در انتظار")+'</b></div><div class="rf-meters"><span>اجازه نمایش عمومی</span><b>'+(c.guardian_consent?"فعال":"غیرفعال")+'</b></div><div class="rf-action-row"><button class="portal-secondary" data-rf="consent" data-student="'+esc(c.student_id)+'" data-allow="true">تأیید با رضایت آگاهانه</button><button class="portal-secondary" data-rf="consent" data-student="'+esc(c.student_id)+'" data-allow="false">لغو رضایت</button></div><p class="rf-caption">تأیید والد به‌تنهایی رزومه را منتشر نمی‌کند؛ خود هنرجو نیز باید آن را فعال کند.</p></article>').join(""):'<div class="rf-empty">در این حساب هنوز ارتباط هنرجو و سرپرست با مجوز دیدن سوابق ثبت نشده است.</div>')+
 '</div><div class="rf-panel"><div class="rf-panel-title"><span>◎</span><h3>آموزش خانواده؛ درس امروز</h3></div>'+
 (familyTip?'<div class="rf-lesson"><div class="rf-overline">DAY '+num(familyTip.day_no)+' / ۳۰</div><h3>'+esc(familyTip.title)+'</h3><p>'+esc(familyTip.explanation)+'</p><div class="rf-lesson-practice"><strong>تمرین سه‌دقیقه‌ای</strong><p>'+esc(familyTip.exercise)+'</p></div><small>'+esc(familyTip.safety_note)+'</small></div>':'<div class="rf-empty">درس روز فقط برای والدین دارای مجوز مشاهده وضعیت هنرجو فعال می‌شود.</div>')+
 '<a class="btn btn-outline" href="#/courses">آشنایی با دوره‌های آموزشی</a></div></section></main>';
}
function studentPage(){
 const steps=Array.isArray(journey?.stages)?journey.stages:[],progress=Number(journey?.percentage||0);
 const headingText=journey?.student_name||"هنرجوی روشنفکران";
 const profileReady=!!journey, stageIndex=Math.max(0,Math.min(4,stage));
 const step=steps[stageIndex];
 const formData=journey||{};
 let right="";
 if(stageIndex===0){
  right='<div class="rf-panel"><h3>مرحله ۱ · هویت و تصویر</h3><p>مشخصات پایه توسط آموزشگاه ثبت می‌شود. تصویر پروفایل را اینجا با تأیید خودتان بارگذاری کنید.</p><form id="rf-avatar-upload" class="rf-form"><label class="portal-field"><span>تصویر (JPEG/PNG/WebP، کمتر از ۱٫۵ مگابایت)</span><input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required/></label><button class="btn btn-primary">بارگذاری امن تصویر</button></form><p class="rf-caption">پرونده شما تنها پس از احراز هویت قابل مشاهده است.</p></div>';
 }else if(stageIndex===1){
 right='<div class="rf-panel"><h3>مرحله ۲ · معرفی حرفه‌ای</h3><p>مهارت‌ها و علایق خود را دقیق بنویسید؛ این متن پایه رزومه خواهد بود.</p><form id="rf-profile-save" class="rf-form">'+input("rf-headline","عنوان حرفه‌ای",formData.headline)+input("rf-bio","درباره من (حداقل ۲۰ حرف)",formData.bio,true)+input("rf-tags","مهارت‌ها و علاقه‌مندی‌ها",formData.interest_tags)+input("rf-goal","هدف حرفه‌ای",formData.career_goal,true)+'<label class="rf-check"><input name="show_photo" type="checkbox"/> در صورت انتشار اختیاری رزومه، تصویر پروفایلم نمایش داده شود.</label><button class="btn btn-primary">ذخیره معرفی و هدف ←</button></form></div>';
 }else if(stageIndex===2){
 right='<div class="rf-panel"><h3>مرحله ۳ · گالری پروژه‌ها</h3><p>سه نمونه‌کار ثبت کنید؛ برای تکمیل این مرحله حداقل یک نمونه باید توسط آموزشگاه تأیید شده باشد.</p><div class="rf-works">'+(works.length?works.map(w=>'<article class="rf-work"><b>'+esc(w.title)+'</b><span>'+badge(w.review_status==="approved"?"تأیید شده":w.review_status==="rejected"?"نیازمند اصلاح":"در انتظار تأیید")+'</span><p>'+esc(w.description||"")+'</p>'+(safeURL(w.project_url)!=="#"?'<a href="'+esc(safeURL(w.project_url))+'" target="_blank" rel="noopener noreferrer">مشاهده پروژه ↗</a>':"")+'</article>').join(""):'<div class="rf-empty">هنوز نمونه‌کاری ثبت نکرده‌اید.</div>')+'</div><form id="rf-work-save" class="rf-form"><label class="portal-field"><span>عنوان پروژه</span><input name="title" maxlength="120" minlength="3" required/></label><label class="portal-field"><span>نوع خروجی</span><select name="category"><option value="agent">ایجنت و اتوماسیون</option><option value="video">ویدیو</option><option value="motion">موشن گرافیک</option><option value="website">وب‌سایت</option><option value="research">پژوهش</option><option value="image">تصویر</option><option value="other">سایر</option></select></label><label class="portal-field"><span>توضیح کوتاه</span><textarea name="description" maxlength="1200"></textarea></label><label class="portal-field"><span>لینک HTTPS پروژه (اختیاری)</span><input name="url" type="url" placeholder="https://..." /></label><button class="btn btn-primary">ارسال برای بررسی آموزشگاه ←</button></form></div>';
 }else if(stageIndex===3){
 if(quizQuestions===null&&!quizLoading){
  quizLoading=true;
  rpc("academy_showcase_quiz_questions").then(data=>{quizQuestions=Array.isArray(data)?data:[]}).catch(e=>{quizQuestions=[];error=e.message}).finally(()=>{quizLoading=false;refresh()});
 }
 const canTake=(journey.showcase_works_approved||0)>0;
 right='<div class="rf-panel"><h3>مرحله ۴ · آزمون مهارت</h3><p>پس از تأیید حداقل یک نمونه‌کار، به هشت سؤال واقعی آزمون پاسخ دهید. سقف تلاش: ۳ بار در ۲۴ ساعت.</p><div class="rf-meters"><span>بهترین نمره</span><b>'+num(journey.quiz_best_score||0)+'</b></div>'+
 (canTake?(quizQuestions===null?'<div class="rf-empty">در حال آماده‌سازی سؤال‌های آزمون...</div>':'<form id="rf-quiz" class="rf-form">'+quizQuestions.map(q=>'<fieldset class="rf-question"><legend>'+esc(q.q)+'</legend>'+((Array.isArray(q.options)?q.options:[]).map((o,i)=>'<label class="rf-choice"><input type="radio" name="'+esc(q.id)+'" value="'+i+'" required/><span>'+esc(o)+'</span></label>').join(""))+'</fieldset>').join("")+'<button class="btn btn-primary" type="submit">ثبت پاسخ و مشاهده نتیجه ←</button></form>'):'<div class="rf-empty">ابتدا حداقل یک نمونه‌کار باید تأیید شود تا آزمون برایتان باز شود.</div>')+'</div>';
 }else{
 right='<div class="rf-panel"><h3>مرحله ۵ · رزومه و اعتبار</h3><p>رزومه صرفاً شامل موارد واقعی ثبت‌شده و تأییدشده است. انتشار عمومی اختیاری است و برای افراد زیر ۱۸ سال نیازمند رضایت سرپرست است.</p><div class="rf-action-row"><button type="button" class="btn btn-primary" data-rf="resume">ساخت و چاپ رزومه PDF</button><button type="button" class="portal-secondary" data-rf="share-on">فعال‌کردن لینک با رضایت صریح</button><button type="button" class="portal-secondary" data-rf="share-off">لغو دسترسی عمومی</button></div><div class="rf-meters"><span>انتشار عمومی</span><b>'+(journey.public_sharing_enabled?"فعال":"خاموش")+'</b></div>'+(journey.requires_guardian_consent&&!journey.guardian_consent_granted?'<div class="portal-alert">برای انتشار، رضایت سرپرست دارای مجوز الزامی است.</div>':"")+'<p class="rf-caption">پیش‌نمایش و نسخه PDF خصوصی است؛ برای لینک عمومی باید کنترل امنیت و رضایت‌ها برقرار باشد.</p></div>';
 }
 return '<main class="shell rf-dashboard">'+heading("STUDENT JOURNEY","پرونده مهارتی "+esc(headingText),"از نخستین پروفایل تا نمونه‌کار تأییدشده و رزومه قابل ارائه؛ همه چیز قدم‌به‌قدم.")+
 actions()+toast()+'<div class="rf-progress-wrap"><div><span class="rf-overline">YOUR PROGRESS</span><h2>'+num(progress)+'٪ <small>تکمیل پرونده</small></h2></div><div class="rf-track"><span style="width:'+Math.max(0,Math.min(100,progress))+'%"></span></div><p>'+esc(journey.message||"مسیر رشد شما آغاز شده است.")+'</p></div>'+
 '<div class="rf-stages">'+steps.map((s,i)=>'<button class="rf-stage '+(i===stageIndex?"is-selected":"")+'" data-rf="stage" data-step="'+i+'"><span>'+(s.done?"✓":num(i+1))+'</span><b>'+esc(s.title)+'</b><small>'+(s.done?"تکمیل‌شده":i===stageIndex?"مرحله جاری":"آماده تکمیل")+'</small></button>').join("")+'</div>'+
 '<section class="rf-grid-two">'+right+
 '<div class="rf-panel"><div class="rf-panel-title"><span>✧</span><h3>مأموریت‌های ۹۰روزه</h3></div><p>۲۴ پروژه در سه مرحله، با تحویل و تأیید واقعی مدرس یا مدیر.</p><div class="rf-meters"><span>مأموریت‌های پذیرفته‌شده</span><strong>'+num(journey.missions_approved||0)+' / ۲۴</strong></div><div class="rf-mini-missions">'+missions.slice(0,6).map(m=>'<div><span>'+num(m.mission_no)+'</span><b>'+esc(m.title)+'</b></div>').join("")+'</div><a class="btn btn-outline" href="#/missions">مشاهده مسیر پروژه‌ها ↗</a></div></section></main>';
}
function missionsPage(){
 if(role?.kind!=="student")return '<main class="shell rf-panel-container"><div class="rf-empty">مشاهده مأموریت‌ها ویژه هنرجو است. <a href="#/access">ورود</a></div></main>';
 const active=campaigns.filter(c=>c.active);
 const options=active.map(c=>'<option value="'+esc(c.id)+'">مسیر فعال از '+esc(date(c.start_date))+'</option>').join("");
 return '<main class="shell rf-dashboard">'+heading("MISSION LAB","مأموریت‌های ۹۰روزه","۲۴ مأموریت در سه فاز؛ پروژه‌ها در زمان مشخص باز می‌شوند و استاد یا مدیر آن‌ها را بررسی می‌کند.")+toast()+
 '<div class="rf-stats"><div>'+badge("مأموریت‌ها")+'<strong>'+num(missions.length)+'</strong></div><div>'+badge("کمپین‌های فعال")+'<strong>'+num(active.length)+'</strong></div><div>'+badge("مأموریت‌های پذیرفته‌شده")+'<strong>'+num(journey?.missions_approved||0)+'</strong></div></div>'+
 '<div class="rf-mission-grid">'+(missions.length?missions.map(m=>'<article class="rf-mission"><div class="rf-mission-top"><span>روز '+num(m.release_day)+'</span><span>فاز '+num(m.phase)+'</span></div><h3>'+esc(m.title)+'</h3><p>'+esc(m.objective)+'</p><small>'+esc(m.deliverable||"")+'</small>'+
 (active.length?'<details class="rf-deliver"><summary>تحویل پروژه</summary><form class="rf-form rf-mission-submit"><input type="hidden" name="template_id" value="'+esc(m.id)+'"/><label class="portal-field"><span>کمپین مربوط</span><select name="campaign_id">'+options+'</select></label><label class="portal-field"><span>شرح اجرای پروژه</span><textarea name="submission_text" minlength="10" maxlength="12000" placeholder="توضیح مراحل انجام پروژه"></textarea></label><label class="portal-field"><span>لینک اثر (HTTPS، اختیاری)</span><input type="url" name="submission_url" placeholder="https://..."/></label><button class="btn btn-primary" type="submit">ارسال به مدرس ←</button></form></details>':'<div class="rf-caption">کمپین این دوره هنوز فعال نشده است.</div>')+'</article>').join(""):'<div class="rf-empty">دسترسی مأموریت‌ها در این حساب هنوز فعال نیست.</div>')+'</div>'+
 '<p class="rf-caption">ارسال تنها پس از باز شدن روز مأموریت و احراز ثبت‌نام معتبر پذیرفته می‌شود.</p></main>';
}
function staffPage(){
 const title=role?.kind==="teacher"?"پنل مدرس":"مرکز کنترل مدیریت";
 const courses=staffData?.academy_courses||[],students=staffData?.academy_students||[],enroll=staffData?.academy_enrollments||[],reqs=staffData?.academy_registration_requests||[];
 return '<main class="shell rf-dashboard">'+heading("ACADEMY CONTROL",title,"دسترسی به داده‌های این صفحه تنها پس از احراز نقش معتبر صادر می‌شود.")+actions()+toast()+
 '<div class="rf-stats"><div>'+badge("دوره‌ها")+'<strong>'+num(courses.length)+'</strong></div><div>'+badge("هنرجویان قابل مشاهده")+'<strong>'+num(students.length)+'</strong></div><div>'+badge("ثبت‌نام‌ها")+'<strong>'+num(enroll.length)+'</strong></div></div>'+
 '<div class="rf-panel"><h3>دوره‌های مرتبط با حساب</h3><div class="rf-admin-list">'+(courses.length?courses.slice(0,20).map(c=>'<div><b>'+esc(c.title)+'</b>'+badge(c.status||"فعال")+'</div>').join(""):'<div class="rf-empty">هنوز دوره مرتبط در این حساب قابل مشاهده نیست.</div>')+'</div><div class="rf-action-row"><a class="btn btn-outline" href="'+OLD+'/manage" rel="noopener noreferrer" target="_blank">پنل کامل مدیریت فعلی ↗</a>'+(role?.kind==="teacher"?'<a class="btn btn-outline" href="'+OLD+'/teacher" target="_blank" rel="noopener noreferrer">فضای مدرس ↗</a>':"")+'</div><p class="rf-caption">تکمیل انتقال امکانات مدیریتی و عملیاتی در حال انجام است. سوابق و مجوزهای قبلی تغییر نکرده‌اند.</p></div></main>';
}
async function printResume(){
 const d=await rpc("academy_student_resume_snapshot",{p_include_contact:false});
 const rows=(d.verified_works||[]).map(w=>'<li><b>'+esc(w.title)+'</b> — '+esc(w.description||"")+'</li>').join("");
 const courses=(d.courses||[]).map(c=>'<li>'+esc(c.title)+' ('+esc(c.code)+')</li>').join("");
 const html='<section class="rf-resume"><header><span>روشنفکران | ROSHANFEKRAN ACADEMY</span><small>رزومه آموزشی؛ گواهی رسمی نیست</small></header><h1>'+esc(d.name)+'</h1><h2>'+esc(d.headline)+'</h2><p>'+esc(d.about)+'</p><div><b>مهارت‌ها: </b>'+esc(d.interests||"")+'</div><h3>دوره‌های مرتبط</h3><ul>'+courses+'</ul><h3>نمونه‌کارهای تأییدشده</h3><ul>'+rows+'</ul><h3>مسیر رشد</h3><p>'+num(d.mission_90?.approved||0)+' مأموریت پذیرفته‌شده از ۲۴ مأموریت</p><p class="rf-caption">'+esc(d.disclaimer)+'</p></section>';
 const target=document.getElementById("rf-print-content");
 if(target){target.innerHTML=html;document.body.classList.add("rf-print-mode");window.print();document.body.classList.remove("rf-print-mode")}
}
function workspace(){
 if(!session)return loginPage();
 if(!role&&!loading){loadWorkspace();return loadingHTML()}
 if(loading)return loadingHTML();
 if(!role)return '<main class="shell rf-panel-container"><div class="rf-panel"><h2>اتصال به پورتال برقرار نشد</h2>'+toast()+'<button class="btn btn-outline" data-rf="refresh">تلاش مجدد</button><button class="portal-secondary" data-rf="logout">خروج</button></div></main>';
 if(role.kind==="student")return studentPage();
 if(role.kind==="guardian")return parentPage();
 return staffPage();
}
function route(parts){
 if(!["access","activate","workspace","student","family","staff","missions"].includes(parts[0]))return null;
 if(parts[0]==="access")return loginPage();
 if(parts[0]==="activate")return activate();
 if(parts[0]==="missions"){if(session&&!role&&!loading)loadWorkspace();return loading?loadingHTML():missionsPage()}
 return workspace();
}
async function submit(e){
 const f=e.target;if((!f.id||!f.id.startsWith("rf-"))&&!f.classList.contains("rf-mission-submit"))return;e.preventDefault();if(busy)return;busy=true;error="";notice="";
 try{
 const d=new FormData(f);
 if(f.id==="rf-login"){
  const response=await api("proxy",{path:"/auth/v1/token?grant_type=password",method:"POST",body:{email:String(d.get("email")||"").trim().toLowerCase(),password:String(d.get("password")||"")}});
  if(!response.access_token)throw Error("رمز یا ایمیل تأیید نشد");
  setSession(response);role=await api("resolve_portal",{},true);journey=null;parent=null;familyTip=null;staffData=null;
  location.hash="#/workspace";loadWorkspace();
 }else if(f.id==="rf-activate"){
  const kind=d.get("kind"),act=kind==="staff"?"signup_invited":kind==="student"?"signup_student":"signup_guardian";
  const response=await api(act,{email:d.get("email"),password:d.get("password"),invite_token:d.get("code")});
  if(!response.access_token)throw Error("حساب هنوز فعال نشده است");
  setSession(response);role=null;location.hash="#/workspace";loadWorkspace();
 }else if(f.id==="rf-profile-save"){
  const headline=document.getElementById("rf-headline")?.value||"",bio=document.getElementById("rf-bio")?.value||"";
  if(headline.trim().length<5||bio.trim().length<20)throw Error("عنوان دست‌کم ۵ حرف و معرفی دست‌کم ۲۰ حرف باشد.");
  await rpc("academy_save_showcase",{p_headline:headline,p_bio:bio,p_tags:document.getElementById("rf-tags").value,p_goal:document.getElementById("rf-goal").value,p_show_photo:!!d.get("show_photo")});
  journey=await rpc("academy_student_journey_snapshot");showNotice("معرفی حرفه‌ای ذخیره شد.");
 }else if(f.id==="rf-work-save"){
  const title=String(d.get("title")||"").trim(),url=String(d.get("url")||"").trim();
  if(title.length<3||url&&safeURL(url)==="#")throw Error("عنوان یا لینک پروژه معتبر نیست.");
  await rpc("academy_save_showcase_work",{p_work_id:null,p_category:d.get("category"),p_title:title,p_description:d.get("description")||"",p_project_url:url});
  journey=await rpc("academy_student_journey_snapshot");await loadStudentExtras();showNotice("نمونه‌کار برای بررسی آموزشگاه ثبت شد.");
 }else if(f.id==="rf-quiz"){
  const answer={};for(const [key,value] of d.entries()){if(/^q[1-8]$/.test(key))answer[key]=Number(value)}
  if(Object.keys(answer).length!==8)throw Error("به همه هشت سؤال پاسخ دهید.");
  const result=await rpc("academy_grade_showcase_quiz",{p_answers:answer});
  journey=await rpc("academy_student_journey_snapshot");
  showNotice("نمره شما: "+num(result.score)+" از ۱۰۰ — "+(result.passed?"آزمون با موفقیت گذرانده شد.":"برای تلاش بعدی بیشتر تمرین کنید."));
 }else if(f.classList.contains("rf-mission-submit")){
  const evidence=String(d.get("submission_text")||"").trim(),url=String(d.get("submission_url")||"").trim();
  if(evidence.length<10&&url.length<10)throw Error("شرح اجرا یا لینک پروژه باید دست‌کم ۱۰ حرف داشته باشد.");
  if(url&&safeURL(url)==="#")throw Error("لینک پروژه باید با HTTPS شروع شود.");
  await rpc("academy_submit_mission",{p_campaign_id:d.get("campaign_id"),p_template_id:d.get("template_id"),p_submission_text:evidence,p_submission_url:url});
  journey=await rpc("academy_student_journey_snapshot");showNotice("پروژه برای بررسی مدیریت ثبت شد.");
 }else if(f.id==="rf-avatar-upload"){
  const file=d.get("avatar");if(!(file instanceof File)||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>1572864)throw Error("تصویر معتبر و کمتر از ۱٫۵ مگابایت لازم است");
  const b64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||"").split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  await api("avatar_upload",{mime:file.type,data_base64:b64},true);journey=await rpc("academy_student_journey_snapshot");showNotice("تصویر پروفایل بارگذاری شد.");
 }
 }catch(e){showError(e)}finally{busy=false;refresh()}
}
async function click(e){
 const control=e.target.closest("[data-rf]");if(!control)return;
 const action=control.dataset.rf;
 if(!["logout","refresh","stage","consent","resume","share-on","share-off"].includes(action))return;
 e.preventDefault();if(busy)return;
 try{
 if(action==="logout"){clear();error="";notice="";location.hash="#/access";refresh();return}
 if(action==="stage"){stage=Number(control.dataset.step)||0;error="";refresh();return}
 busy=true;
 if(action==="refresh"){role=null;await loadWorkspace();return}
 if(action==="consent"){
  const approve=control.dataset.allow==="true";
  if(!confirm(approve?"با آگاهی از شرایط، اجازه نمایش عمومی رزومه این هنرجو را می‌دهید؟":"رضایت انتشار عمومی را لغو می‌کنید؟"))return;
  await rpc("academy_consent_showcase",{p_student_id:control.dataset.student,p_allow:approve});parent=await rpc("academy_parent_journey_snapshot");showNotice(approve?"رضایت ثبت شد؛ انتشار همچنان نیازمند اقدام خود هنرجوست.":"رضایت لغو و انتشار عمومی غیرفعال شد.");
 }
 if(action==="resume"){await printResume();return}
 if(action==="share-on"||action==="share-off"){
   const enable=action==="share-on";if(enable&&!confirm("با انتشار اختیاری رزومه تأییدشده به‌صورت عمومی موافق هستید؟ لینک ممکن است تا زمان لغو قابل مشاهده باشد."))return;
   const res=await rpc("academy_set_showcase_share",{p_enable:enable,p_rotate:enable});
   journey=await rpc("academy_student_journey_snapshot");
   if(enable&&res?.token){let url=location.origin+"/#/showcase/"+encodeURIComponent(res.token);try{await navigator.clipboard.writeText(url);showNotice("لینک رزومه فعال و کپی شد: "+url)}catch{showNotice("لینک رزومه: "+url)}}else if(enable)showNotice("درخواست انتشار ثبت شد اما لینک معتبر دریافت نشد؛ با مدیریت تماس بگیرید.");else showNotice("انتشار عمومی لغو شد و لینک قبلی دیگر نباید معتبر باشد.");
 }
 }catch(err){showError(err)}finally{busy=false;refresh()}
}
const box=document.getElementById("app");box.addEventListener("submit",submit);box.addEventListener("click",click);
document.body.insertAdjacentHTML("beforeend",'<div id="rf-print-content" aria-hidden="true"></div>');
window.RFPORTAL={route};if((location.hash||"").startsWith("#/workspace"))loadWorkspace();
})();