"use strict";
(function(){
const ENDPOINT="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
const OLD="https://roshanfekran-academy-control.floot.app";
const state={courses:[],news:{ai:[],markets:[],world:[]},daily:null,settings:{},loading:true,error:"",detail:{},pending:{}};
const root=document.getElementById("app");
const menu=document.getElementById("mainNav"),toggle=document.getElementById("mobileMenu"),helper=document.getElementById("helperPanel"),helperBtn=document.getElementById("helperButton");
const esc=(v)=>String(v??"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const safeUrl=(v)=>{try{const u=new URL(String(v));return /^https?:$/.test(u.protocol)?u.href:"#"}catch{return "#"}};
const money=(v)=>new Intl.NumberFormat("fa-IR").format(Number(v||0))+" تومان";
const number=(v)=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
function date(v){if(!v)return "به‌زودی";try{const d=new Date(v+"T12:00:00Z");return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"long",day:"numeric"}).format(d)}catch{return "به‌زودی"}}
const go=(path)=>"#/"+path.replace(/^\/+/,"");
function icon(n){return ({"ai":"✳","crypto":"₿","fx":"↗","course":"◈","learn":"◎","news":"◉"}[n]||"✦")}
function head(k,title,desc,right=""){return '<div class="section-head"><div><span class="kicker">'+esc(k)+'</span><h2>'+title+'</h2><p>'+esc(desc)+'</p></div>'+right+'</div>'}
function courseCard(c){
 const slug=/^[a-z0-9-]{3,60}$/i.test(String(c.slug||""))?String(c.slug):"";
 const price=Number(c.base_fee||0);
 return '<article class="card course-card">'+
  '<div class="card-icon">'+icon("course")+'</div><span class="pill" style="position:absolute;left:20px;top:22px">ثبت‌نام باز</span>'+
  '<h3>'+esc(c.title||"دوره آموزشی")+'</h3>'+
  '<p>'+esc(c.teacher_name?"مدرس: "+c.teacher_name:"آموزش مهارت‌محور")+'<br>شروع دوره: '+esc(date(c.start_date))+'<br>تعداد جلسات: '+number(c.session_count||0)+'</p>'+
  '<div class="card-foot"><div><small>شهریه دوره</small><div class="price">'+(price>0?money(price):"استعلام از آموزشگاه")+'</div></div>'+
  (slug?'<a class="btn btn-primary" href="#/course/'+encodeURIComponent(slug)+'">جزئیات و ثبت‌نام ←</a>':'<a class="thin-link" href="tel:09164880996">استعلام →</a>')+
  '</div></article>'
}
function newsCard(n){
 const u=safeUrl(n.url),valid=u!=="#";
 return '<article class="news-card"><span class="pill">'+esc(n.category||"خبر")+'</span><h3>'+esc(n.title||"خبر آموزشی")+'</h3><p>'+esc(n.source||"منابع عمومی")+' · '+esc(date(n.published_at))+'</p>'+
 (valid?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">مطالعه در منبع اصلی ↗</a>':'<span class="small">منبع بیرونی مشخص نشده</span>')+'</article>';
}
function cardsEmpty(){return '<div class="empty">در حال حاضر دوره‌ای برای ثبت‌نام عمومی فعال نیست. فقط دوره‌هایی که مدیریت منتشر کرده باشد نمایش داده می‌شوند.</div>'}
function sectionCourse(limit=99){const items=state.courses.slice(0,limit);if(state.loading)return '<div class="card-grid">'+Array.from({length:3},()=>'<div class="skeleton"></div>').join("")+'</div>';if(state.error)return '<div class="error" role="alert">'+esc(state.error)+'</div>';return items.length?'<div class="card-grid">'+items.map(courseCard).join("")+'</div>':cardsEmpty()}
function sectionNews(limit=3){const rows=[...(state.news.ai||[]).map(x=>({...x,category:"هوش مصنوعی"})),...(state.news.markets||[]).map(x=>({...x,category:"بازارهای مالی"})),...(state.news.world||[]).map(x=>({...x,category:"جهان و فناوری"}))];if(state.loading)return '<div class="news-list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';return rows.length?'<div class="news-list">'+rows.slice(0,limit).map(newsCard).join("")+'</div>':'<div class="empty">هنوز خبر تأییدشده‌ای در سامانه ثبت نشده است؛ تیتر یا منبع ساختگی نمایش نمی‌دهیم.</div>'}

function experientialSection(){
 const steps=[
  ['01','شروع هوشمند','کشف مسیر مناسب','مشاهده دوره‌های فعال، آشنایی با ابزارها و انتخاب هدف روشن برای یادگیری.'],
  ['02','ساخت و تجربه','یادگیری با پروژه','تمرین‌های واقعی و مأموریت‌های مرحله‌ای به‌جای یادگیری صرفاً تئوری.'],
  ['03','ارزیابی و رشد','بازخورد قابل اتکا','بازبینی مدرس، ارزیابی مهارت‌ها و پیشرفت مستند در پورتال اختصاصی.'],
  ['04','هویت حرفه‌ای','ارائه مهارت','گالری نمونه‌کار و رزومه تأییدشده؛ انتشار فقط با اجازه صاحب پروفایل.']
 ];
 return '<section class="rf-journey-section shell" aria-labelledby="rf-journey-heading">'+
  '<div class="rf-journey-top"><div><span class="rf-journey-eyebrow"><span class="rf-journey-dot"></span> THE ART OF LEARNING</span><h2 id="rf-journey-heading">اینجا یادگیری، <em>یک مسیر واقعی</em> است.</h2></div><p>زیبایی فناوری وقتی معنا پیدا می‌کند که به مهارت تبدیل شود. از نخستین تجربه تا نمونه‌کاری که می‌توان با افتخار ارائه کرد.</p></div>'+
  '<div class="rf-journey-surface"><div class="rf-journey-pillar" aria-hidden="true"><div class="rf-pillar-ring"></div><div class="rf-pillar-core"><span>R</span><small>ROSHANFEKRAN</small></div><div class="rf-pillar-base"></div></div>'+
  '<div class="rf-journey-interface"><div class="rf-journey-index"><span>ROADMAP / 2026</span><span>01 — 04</span></div>'+
  '<div class="rf-journey-steps" role="group" aria-label="مراحل رشد آموزشی">'+steps.map((x,i)=>'<button type="button" class="rf-journey-step'+(i===0?' current':'')+'" aria-pressed="'+(i===0)+'" data-rf-journey="'+i+'"><span>'+x[0]+'</span><b>'+x[1]+'</b><span class="rf-journey-arrow">↗</span></button>').join('')+'</div>'+
  '<div class="rf-journey-detail" id="rf-journey-detail" aria-live="polite"><span class="rf-journey-detail-label">مرحله ۰۱ / مسیر هنرجو</span><h3>کشف مسیر مناسب</h3><p>مشاهده دوره‌های فعال، آشنایی با ابزارها و انتخاب هدف روشن برای یادگیری.</p><a class="rf-journey-start" href="#/courses">شروع مسیر یادگیری <span>↗</span></a></div>'+
  '</div></div><div class="rf-journey-foot"><span>◈ مهارت واقعی</span><span>◈ آموزش پروژه‌محور</span><span>◈ حریم خصوصی در اولویت</span></div></section>';
}

function home(){
 return '<main>'+
  '<section class="shell hero"><div><div class="eyebrow">آموزشگاه آزاد فنی و حرفه‌ای روشنفکران</div><h1>آینده را فقط <span class="gradient-text">تماشا نکن.</span><br>آن را بساز.</h1><p>از هوش مصنوعی تا بازارهای مالی؛ مهارت را با پروژه‌های واقعی، همراهی مدرس و مسیری روشن از آموزش تا ارائه نمونه‌کار یاد بگیر.</p>'+
  '<div class="actions"><a href="#/courses" class="btn btn-primary">مشاهده دوره‌های ثبت‌نام باز <span>↙</span></a><a href="#/about" class="btn btn-outline">آشنایی با روشنفکران ↗</a></div>'+
  '<div class="micro"><span>یادگیری پروژه‌محور</span><span>مسیر رشد شخصی</span><span>اعتبارسنجی مهارت‌ها</span></div></div>'+
  '<div class="stage" role="img" aria-label="کره تعاملی با نورپردازی متالیک، نماد یادگیری فناوری"><canvas id="rf-3d-canvas" class="rf-webgl" aria-hidden="true"></canvas><div class="orbit"></div><div class="orb"></div><div class="stage-chip chip-1"><b>AI</b> آینده هوشمند</div><div class="stage-chip chip-2"><b>FOREX</b> تحلیل مسئولانه</div><div class="stage-chip chip-3"><b>WEB3</b> سواد دارایی دیجیتال</div></div></section>'+
  experientialSection()+
  '<section class="section shell">'+head("OUR FOCUS","یادگیری که به عمل می‌رسد","مسیرهای آموزشی متناسب با مهارت‌های امروز و آینده")+
  '<div class="card-grid"><article class="card"><div class="card-icon">✳</div><h3>هوش مصنوعی کاربردی</h3><p>از آشنایی و پرامپت‌نویسی تا تولید محتوای حرفه‌ای، اتوماسیون و ساخت ایجنت.</p><div class="card-foot"><span>یادگیری با تمرین</span><a class="thin-link" href="#/courses">مشاهده دوره‌ها ←</a></div></article>'+
  '<article class="card"><div class="card-icon">₿</div><h3>ارز دیجیتال و وب۳</h3><p>مفاهیم بلاکچین، امنیت کیف پول و تحلیل فرصت و ریسک بدون وعده سود.</p><div class="card-foot"><span>دانش همراه با مدیریت ریسک</span><a class="thin-link" href="#/courses">مشاهده دوره‌ها ←</a></div></article>'+
  '<article class="card"><div class="card-icon">↗</div><h3>فارکس و مهارت تحلیل</h3><p>شناخت ساختار بازار، سناریونویسی و اصول مدیریت سرمایه با نگاه آموزشی.</p><div class="card-foot"><span>مهارت پیش از معامله</span><a class="thin-link" href="#/courses">مشاهده دوره‌ها ←</a></div></article></div></section>'+
  '<section class="section shell">'+head("OPEN ENROLLMENT","دوره‌هایی که همین حالا ثبت‌نام دارند","فهرست مستقیم از سامانه آموزشگاه دریافت می‌شود؛ دوره‌های بسته یا غیرفعال نمایش داده نمی‌شوند",'<a class="thin-link" href="#/courses">تمام دوره‌های باز ←</a>')+sectionCourse(3)+'</section>'+
  '<section class="section shell"><div class="panels"><article class="feature-panel"><span class="kicker">STUDENT JOURNEY</span><h3>پورتال مهارتی هنرجو</h3><p>مدیریت مسیر یادگیری، نمونه‌کارهای تأییدشده، پیشرفت مرحله‌ای و ساخت رزومه. اطلاعات خصوصی فقط پس از ورود معتبر قابل مشاهده‌اند.</p><a href="#/portals" class="btn btn-outline">ورود به فضای هنرجو ←</a></article><article class="feature-panel"><span class="kicker">FAMILY SPACE</span><h3>خانواده، شریک مسیر رشد</h3><p>مشاهده پیشرفت فرزند با مجوز مناسب، اطلاع از مسیر آموزشی و نکته‌های کوتاه روزانه درباره هوش مصنوعی.</p><a href="#/portals" class="btn btn-outline">ورود خانواده ←</a></article></div></section>'+
  '<section class="section shell">'+head("UPDATES","از دنیای فناوری چه خبر؟","خبرهای ثبت‌شده در منابع عمومی آموزشگاه؛ بدون ساختن خبر یا تاریخ غیرواقعی",'<a class="thin-link" href="#/updates">آرشیو خبرها ←</a>')+sectionNews(3)+'</section>'+
  '<section class="section shell">'+dailyTeaser()+'</section>'+
  '<section class="section shell"><div class="ticker"><strong>یک سؤال، یک شروع.</strong> <span>برای انتخاب دوره مناسب یا ثبت‌نام، با مشاور آموزشگاه تماس بگیر.</span><a class="btn btn-primary" style="margin-right:auto" href="tel:09164880996">تماس با آموزشگاه ←</a></div></section>'+
  '</main>';
}
function dailyTeaser(){
 const d=state.daily?.today||state.daily?.latest;
 return '<div class="panels"><div class="card featured"><span class="kicker">نکته روز روشنفکران</span><h3>'+esc(d?.title||"هر روز یک قدم به جلو")+'</h3><p>'+esc(d?.body||"یادگیری با یک تمرین کوتاه روزانه شروع می‌شود. نکته تازه پس از تأیید آموزشگاه نمایش داده خواهد شد.")+'</p>'+(d?.action_prompt?'<div class="card-foot"><span>'+esc(d.action_title||"تمرین امروز")+'</span></div>':'')+'</div><div class="card"><span class="kicker">ACADEMY OS</span><h3>پیشرفت قابل اندازه‌گیری</h3><p>مأموریت‌های مرحله‌ای، تمرین، ارزیابی و مسیر رشد هنرجویان در محیط محافظت‌شده سامانه.</p><a class="thin-link" href="#/portals">پورتال‌های اختصاصی ←</a></div></div>';
}
function courses(){
 return '<main class="shell"><section class="page-hero"><span class="kicker">COURSE CATALOG</span><h1>دوره‌های <span class="gradient-text">ثبت‌نام باز</span></h1><p>تنها دوره‌هایی در این فهرست دیده می‌شوند که مدیریت روشنفکران آن‌ها را به‌صورت عمومی فعال کرده است.</p></section><section class="section" style="padding-top:20px">'+sectionCourse()+'</section></main>';
}
function course(slug){
 if(!/^[a-z0-9-]{3,60}$/i.test(slug||""))return notfound();
 const found=state.detail[slug];
 if(!found&&!state.pending[slug]){state.pending[slug]=true;api("public_registration_info",{slug}).then(data=>{state.detail[slug]=data;delete state.pending[slug];render()}).catch(e=>{state.detail[slug]={error:e.message};delete state.pending[slug];render()})}
 if(!found)return '<main class="shell section"><div class="skeleton"></div></main>';
 if(found.error)return '<main class="shell section"><div class="error">'+esc(found.error)+'</div><a class="btn btn-outline" href="#/courses">بازگشت به دوره‌ها</a></main>';
 const d=found.course||{}, l=found.link||{},p=found.pricing||{};
 const full=Number(p.full_amount||0),install=Number(p.installment_total||0);
 const oldUrl="#/enroll/"+encodeURIComponent(slug);
 return '<main class="shell"><section class="page-hero"><a class="thin-link" href="#/courses">← همه دوره‌ها</a><h1>'+esc(d.title||"دوره آموزشی")+'</h1><p>دوره '+esc(d.code||"")+' · مدرس: '+esc(d.teacher_name||"در حال تعیین")+'</p></section>'+
 '<section class="section" style="padding-top:0"><div class="reg-grid"><div class="card"><span class="kicker">اطلاعات ثبت‌نام</span><h3>جزئیات دوره</h3><div class="qa-list">'+
 '<details open><summary>زمان برگزاری</summary><p>شروع: '+esc(date(d.start_date))+'<br>پایان: '+esc(date(d.end_date))+'<br>'+esc(d.schedule_note||"برنامه دقیق توسط آموزشگاه اعلام می‌شود.")+'</p></details>'+
 '<details><summary>ظرفیت و شرایط</summary><p>ظرفیت باقیمانده: '+(d.seats_left===null?"اعلام‌نشده":number(d.seats_left))+'<br>تعداد جلسات: '+number(d.session_count||0)+'</p></details>'+
 '<details><summary>شهریه و اقساط</summary><p>شهریه نقدی: '+money(full)+(l.installment_enabled?'<br>کل شهریه اقساطی: '+money(install)+'<br>حداکثر اقساط: '+number(l.installment_max_count)+' قسط':'<br>اقساط برای این دوره فعال نیست.')+'</p></details></div></div>'+
 '<aside class="card"><span class="pill">ثبت‌نام عمومی فعال</span><h3>شروع مسیر یادگیری</h3><p>شهریه پایه دوره</p><div class="reg-price">'+money(full)+'</div>'+
 '<p>ثبت‌نام نهایی فعلاً در سامانه اصلی روشنفکران انجام می‌شود تا رسیدهای پرداخت و پرونده‌ها در یک مسیر امن باقی بمانند.</p>'+
 '<a class="btn btn-primary" href="#/enroll/'+encodeURIComponent(slug)+'">ارسال درخواست ثبت‌نام ←</a><div style="height:14px"></div><a class="btn btn-outline" href="tel:09164880996">پرسش از مشاور ↗</a>'+
 '<p class="small" style="margin-top:20px">پیش‌ثبت‌نام از طریق فرم ایمن روشنفکران انجام می‌شود؛ پرداخت و ثبت‌نام قطعی پس از بررسی مدیریت تأیید خواهد شد.</p></aside></div></section></main>';
}
function updates(){return '<main class="shell"><section class="page-hero"><span class="kicker">NEWS & KNOWLEDGE</span><h1>اخبار و <span class="gradient-text">نکته‌های روز</span></h1><p>تازه‌های فناوری، هوش مصنوعی و بازارهای مالی بر اساس مطالب منتشرشده در سامانه.</p></section><section class="section" style="padding-top:0">'+sectionNews(18)+'</section><section class="section">'+dailyTeaser()+'</section></main>'}
function portals(){
 const list=[
 {name:"هنرجویان",icon:"◈",url:"#/access",desc:"مراحل رشد، نمونه‌کار، آزمون واقعی، مأموریت‌ها و رزومه آموزشی."},
 {name:"خانواده‌ها",icon:"◎",url:"#/access",desc:"پیشرفت فرزند دارای مجوز، رضایت آگاهانه و ۳۰ آموزش روزانه."},
 {name:"مدرسان و مدیریت",icon:"✳",url:"#/access",desc:"ورود با نقش تخصصی و ادامه مدیریت کلاس‌ها و دوره‌ها."}
 ];
 return '<main class="shell"><section class="page-hero"><span class="kicker">PRIVATE PORTALS</span><h1>هر نقش، <span class="gradient-text">فضای خودش</span></h1><p>اطلاعات خصوصی فقط پس از احراز هویت و بررسی نقش در سرور نمایش داده می‌شوند؛ سوابق قبلی در دیتابیس اصلی باقی می‌مانند.</p></section><section class="section" style="padding-top:0"><div class="portal-links">'+list.map(x=>'<a class="portal-tile" href="'+esc(x.url)+'"><span class="card-icon">'+x.icon+'</span><b>'+esc(x.name)+'</b><p>'+esc(x.desc)+'</p><strong>ورود امن و تعیین نقش ←</strong></a>').join("")+'</div>'+
 '<div class="notice" style="margin-top:30px">با همان حساب آموزشگاه وارد شوید. برخی گردش‌کارهای تخصصی در سامانه مدیریتی فعلی تکمیل می‌شوند؛ حساب جدید یا دیتابیس موازی ساخته نمی‌شود.</div></section></main>';
}
function about(){return '<main class="shell"><section class="page-hero"><span class="kicker">ABOUT US</span><h1>آموزشگاه <span class="gradient-text">روشنفکران</span></h1><p>آموزش کاربردی برای رشد واقعی مهارت در اقلید، همراه با تمرین و پروژه‌های قابل ارائه.</p></section><section class="section" style="padding-top:0"><div class="panels"><article class="card"><span class="card-icon">✧</span><h3>آموزش برای ساختن</h3><p>تلفیق فناوری و آموزش حضوری، با تمرکز بر استقلال هنرجو و استفاده مسئولانه از ابزارهای جدید.</p><a class="thin-link" href="#/courses">دوره‌های فعال ←</a></article><article class="card"><span class="card-icon">⌖</span><h3>ارتباط و آدرس</h3><p>اقلید، خیابان امام، روبروی بانک ملت، طبقه فوقانی بانک توسعه تعاون</p><a href="tel:09164880996" class="thin-link">۰۹۱۶۴۸۸۰۹۹۶</a><p></p><a href="tel:07144520283" class="thin-link">۰۷۱۴۴۵۲۰۲۸۳</a></article></div></section></main>'}
function notfound(){return '<main class="shell section narrow"><div class="empty"><h2>این صفحه پیدا نشد</h2><a class="btn btn-primary" href="#/">بازگشت به خانه</a></div></main>'}
function render(){
 const route=(location.hash||"#/").replace(/^#\/?/,"").split("?")[0];
 const parts=route.split("/").filter(Boolean);
 let html="";
 const enrollmentRoute=window.RFENROLL?.route?.(parts);
 const publicRoute=enrollmentRoute===null?window.RFPUBLIC?.route?.(parts):null;
 const privateRoute=publicRoute===null?window.RFPORTAL?.route?.(parts):null;
 if(enrollmentRoute!==null&&enrollmentRoute!==undefined)html=enrollmentRoute;
 else if(publicRoute!==null&&publicRoute!==undefined)html=publicRoute;
 else if(privateRoute!==null&&privateRoute!==undefined)html=privateRoute;
 else if(!parts.length)html=home();
 else if(parts[0]==="courses")html=courses();
 else if(parts[0]==="course")html=course(decodeURIComponent(parts[1]||""));
 else if(parts[0]==="updates")html=updates();
 else if(parts[0]==="portals")html=portals();
 else if(parts[0]==="about")html=about();
 else html=notfound();
 root.innerHTML=html;
 window.RFSCENE?.mount?.();
 window.RFMOTION?.refresh?.();
 document.querySelectorAll("#mainNav a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#/"+route));
 document.title=(parts.length?({courses:"دوره‌های روشنفکران",course:"ثبت‌نام دوره",updates:"اخبار روشنفکران",portals:"پورتال‌ها",about:"درباره ما"}[parts[0]]||"روشنفکران")+" | ":"")+"آموزشگاه روشنفکران";
}
async function api(action,body={}){
 const ctl=new AbortController(),id=setTimeout(()=>ctl.abort(),13000);
 try{
  const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...body}),signal:ctl.signal});
  const data=await res.json();
  if(!res.ok||data?.error)throw Error(data.error||"ارتباط با سامانه برقرار نشد");
  return data;
 }finally{clearTimeout(id)}
}
async function load(){
 try{
  const results=await Promise.allSettled([api("public_catalog"),api("public_news"),api("daily_public")]);
  if(results[0].status==="fulfilled"){state.courses=Array.isArray(results[0].value.courses)?results[0].value.courses:[];state.settings=results[0].value.settings||{}}
  else state.error="بارگذاری دوره‌ها موقتاً ممکن نیست. کمی بعد دوباره تلاش کنید.";
  if(results[1].status==="fulfilled")state.news=results[1].value;
  if(results[2].status==="fulfilled")state.daily=results[2].value;
 }catch(e){state.error=e?.message||"خطا در دریافت اطلاعات"}
 state.loading=false;render();
}
toggle.addEventListener("click",()=>{let open=menu.classList.toggle("is-open");toggle.setAttribute("aria-expanded",String(open));});
window.addEventListener("hashchange",()=>{menu.classList.remove("is-open");toggle.setAttribute("aria-expanded","false");render();window.scrollTo({top:0,behavior:"auto"});window.RFMOTION?.scrollTop?.();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){menu.classList.remove("is-open");toggle.setAttribute("aria-expanded","false");helper.hidden=true;helperBtn.setAttribute("aria-expanded","false")}});
helperBtn.addEventListener("click",()=>{helper.hidden=!helper.hidden;helperBtn.setAttribute("aria-expanded",String(!helper.hidden));});
document.getElementById("helperClose").addEventListener("click",()=>{helper.hidden=true;helperBtn.setAttribute("aria-expanded","false")});
helper.addEventListener("click",e=>{if(e.target.closest("a")){helper.hidden=true;helperBtn.setAttribute("aria-expanded","false")}});
window.RFCORE={render};render();load();
})();