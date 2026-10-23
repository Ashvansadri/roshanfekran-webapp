/*
 * Roshanfekran Studio 2026 — Conversion-focused public homepage.
 * Deliberately no personal information, unauthenticated writes or fictitious
 * reviews/teachers. All published courses come from academy public_catalog.
 */
(function(){
"use strict";
const root=document.getElementById("app");
if(!root)return;
const enc=(x)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toPersian=(x)=>new Intl.NumberFormat("fa-IR").format(Number(x)||0);
const date=(s)=>{if(!s)return "به‌زودی";try{const d=new Date(String(s).slice(0,10)+"T12:00:00Z");return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{month:"long",day:"numeric",year:"numeric"}).format(d)}catch{return "پس از تکمیل ثبت‌نام"}};
const fee=(v)=>Number(v)>0?toPersian(v)+" تومان":"استعلام شهریه";
const routeTo=(str)=>"#/"+String(str).replace(/^\/+/,"");
const questions=[
 {label:"دوست داری چه چیزی بسازی؟",hint:"لازم نیست از قبل تجربه داشته باشی.",options:[
  {label:"محتوا، تصویر و ابزارهای هوشمند",type:"ai",icon:"✳"},
  {label:"شناخت ارزهای دیجیتال و بلاکچین",type:"crypto",icon:"₿"},
  {label:"تحلیل نمودار و رفتار بازار",type:"forex",icon:"↗"}]},
 {label:"وقتی یاد می‌گیری، چه روشی را دوست داری؟",hint:"همین حالا روش دلخواهت را انتخاب کن.",options:[
  {label:"انجام پروژه و ساخت نمونه‌کار",type:"ai",icon:"◈"},
  {label:"آزمایش مفاهیم و یادگیری امنیت",type:"crypto",icon:"◉"},
  {label:"تحلیل سناریو و تمرین روی داده",type:"forex",icon:"⌁"}]},
 {label:"مهم‌ترین هدف تو چیست؟",hint:"پیشنهاد صرفاً راهنماست، نه ارزیابی استعداد یا تضمین نتیجه.",options:[
  {label:"خلق کردن و استفاده از فناوری روز",type:"ai",icon:"✦"},
  {label:"افزایش سواد فناوری مالی",type:"crypto",icon:"⬡"},
  {label:"یادگیری مدیریت ریسک و تحلیل",type:"forex",icon:"↗"}]}
];
const resultData={
 ai:{over:"CREATIVE INTELLIGENCE",title:"به مسیر هوش مصنوعی نزدیک‌تری.",desc:"اگر از خلق کردن، ساخت ابزار و حل مسئله لذت می‌بری، با پروژه‌های کاربردی و هوش مصنوعی شروع کن.",tag:"محتوا · اتوماسیون · ایجنت",lookup:["هوش","مصنوعی","ai","agent"]},
 crypto:{over:"DIGITAL ASSETS",title:"مسیر فناوری مالی برای تو جذاب است.",desc:"با شناخت بلاکچین، امنیت دارایی و مدیریت ریسک شروع کن؛ آگاهی مهم‌تر از عجله برای معامله است.",tag:"بلاکچین · کیف پول · امنیت",lookup:["ارز","دیجیتال","crypto","بلاکچین"]},
 forex:{over:"MARKET THINKING",title:"تو به مسیر تحلیل بازار علاقه داری.",desc:"با اصول نمودارخوانی، ساخت سناریو و مدیریت ریسک آشنا شو. این پیشنهاد آموزشی، توصیه سرمایه‌گذاری نیست.",tag:"تحلیل · سناریو · مدیریت ریسک",lookup:["فارکس","forex","تریدر","معامل"]}
};
let quizStep=0,answers=[],snapshot=null;
function publicCourse(c,index){
 const title=enc(c.title||"دوره آموزشی"),slug=String(c.slug||"");
 const safe=/^[a-z0-9-]{3,60}$/i.test(slug);
 return '<article class="rf26-course">'+
  '<div class="rf26-course-top"><span class="rf26-course-number" dir="ltr">0'+(index+1)+'</span><span class="rf26-open-label"><i></i> ثبت‌نام باز</span></div>'+
  '<div class="rf26-course-symbol" aria-hidden="true">'+(index%3===0?"✳":index%3===1?"◈":"⌘")+'</div>'+
  '<h3>'+title+'</h3><p>آموزش مهارتی با مسیر قابل پیگیری، تمرین و همراهی مدرس.</p>'+
  '<div class="rf26-course-data"><span>شروع: <b>'+enc(date(c.start_date))+'</b></span><span>جلسات: <b>'+toPersian(c.session_count||0)+'</b></span></div>'+
  '<div class="rf26-course-bottom"><span>شهریه <strong>'+enc(fee(c.base_fee))+'</strong></span>'+
  (safe?'<a href="#/course/'+encodeURIComponent(slug)+'" aria-label="جزئیات '+title+'">بررسی دوره <span aria-hidden="true">↗</span></a>':'<a href="tel:09164880996">استعلام <span aria-hidden="true">↗</span></a>')+
  '</div></article>';
}
function courseBlock(state){
 if(state.loading)return '<div class="rf26-course-list"><div class="rf26-course rf26-skeleton"></div><div class="rf26-course rf26-skeleton"></div></div>';
 if(state.error)return '<div class="rf26-empty" role="status">دریافت دوره‌ها موقتاً در دسترس نیست. از بخش دوره‌ها دوباره امتحان کنید. <a href="#/courses">بررسی دوره‌ها ↗</a></div>';
 const list=Array.isArray(state.courses)?state.courses:[];
 if(!list.length)return '<div class="rf26-empty">در حال حاضر دوره‌ای برای ثبت‌نام عمومی فعال نشده است. برای اطلاع از نوبت بعدی با آموزشگاه تماس بگیر. <a href="tel:09164880996">تماس با مشاور ↗</a></div>';
 const side=list.length===1?'<aside class="rf26-course-guide"><span class="rf26-guide-number">YOUR NEXT MOVE / 01</span><div class="rf26-guide-orb" aria-hidden="true"><i></i><b>R</b></div><h3>فقط ثبت‌نام نیست؛ <em>شروع یک مسیر است.</em></h3><p>با انتخاب دوره، برنامه یادگیری و پروژه‌های قابل پیگیری در پورتال اختصاصی در دسترس هنرجویان واجد شرایط قرار می‌گیرد.</p><div class="rf26-guide-features"><span>◈ پروژه‌های مهارتی</span><span>◈ مسیر رشد</span><span>◈ رزومه آموزشی</span></div><button type="button" data-rf26-scroll="rf26-discover">هنوز مطمئن نیستی؟ مسیرت را پیدا کن <span>↗</span></button></aside>':'';
 return '<div class="rf26-course-list">'+list.slice(0,3).map(publicCourse).join("")+side+'</div>';
}
function newsBlock(state){
 const news=state.news||{};
 const arr=[...(news.ai||[]).map(x=>({...x,kind:"هوش مصنوعی"})),...(news.markets||[]).map(x=>({...x,kind:"بازارهای مالی"})),...(news.world||[]).map(x=>({...x,kind:"فناوری"}))].slice(0,3);
 if(!arr.length){
  const notes=[["هوش مصنوعی","یک پرامپت خوب، نقش و هدف و نوع خروجی را مشخص می‌کند."],["امنیت دیجیتال","عبارت بازیابی کیف پول را در هیچ سایت یا پیامی وارد نکن."],["تفکر تحلیلی","قبل از هر تصمیم مالی، سناریوی اشتباه بودن را هم تعریف کن."]];
  return '<div class="rf26-notes">'+notes.map((x,i)=>'<div class="rf26-note rf26-teaching-note"><span class="rf26-note-num" dir="ltr">0'+(i+1)+'</span><span class="rf26-note-body"><small>نکته آموزشی · '+enc(x[0])+'</small><b>'+enc(x[1])+'</b></span><span aria-hidden="true">✳</span></div>').join("")+'</div>';
 }
 return '<div class="rf26-notes">'+arr.map((n,i)=>{
 let href="#/updates";try{let x=new URL(String(n.url));if(["https:","http:"].includes(x.protocol))href=x.href}catch{}
 return '<a class="rf26-note" href="'+enc(href)+'"'+(href.startsWith("http")?' target="_blank" rel="noopener noreferrer"':'')+'>'+
  '<span class="rf26-note-num" dir="ltr">0'+(i+1)+'</span><span class="rf26-note-body"><small>'+enc(n.kind)+'</small><b>'+enc(n.title||"خبر آموزشی")+'</b></span><span aria-hidden="true">↗</span></a>';
 }).join("")+'</div>';
}
function demoPanel(){
 return '<div class="rf26-dashboard" aria-label="نمونه نمای بصری مسیر مهارتی؛ داده هنرجوی واقعی نیست">'+
   '<div class="rf26-board-head"><span><i></i><i></i><i></i></span><b>LEARNING PROFILE / DEMO</b><small>نمای مفهومی</small></div>'+
   '<div class="rf26-board-body"><div class="rf26-board-side"><div class="rf26-board-mark">R.</div><div class="rf26-board-vlines"><i></i><i></i><i></i><i></i></div></div>'+
   '<div class="rf26-board-main"><span class="rf26-board-label">مسیر یادگیری شخصی</span><h3>هر قدم، یک مهارت تازه.</h3>'+
   '<div class="rf26-board-stages"><div class="done"><span>۱</span><b>پروفایل</b></div><div class="done"><span>۲</span><b>تمرین‌ها</b></div><div class="active"><span>۳</span><b>نمونه‌کار</b></div><div><span>۴</span><b>ارزیابی</b></div><div><span>۵</span><b>رزومه</b></div></div>'+
   '<div class="rf26-board-project"><div class="rf26-board-project-art"><div class="rf26-board-glyph">✦</div></div><div><small>نمونه جریان کاری</small><strong>از ایده تا نمونه‌کار</strong><p>ثبت، بازخورد و رشد مرحله‌ای</p></div><span class="rf26-board-check">↗</span></div>'+
   '<div class="rf26-board-bottom"><span>گالری مهارتی با اختیار اشتراک‌گذاری</span><b>SHOWCASE ↗</b></div></div></div>'+
   '<div class="rf26-board-float" aria-hidden="true">✦ <span>PROFILE / PROGRESS / PORTFOLIO</span></div>'+
 '</div>';
}
function quizMarkup(){
 const q=questions[quizStep];
 if(!q){const tally={ai:0,crypto:0,forex:0};answers.forEach(x=>{if(tally[x]!==undefined)tally[x]++});
  const key=Object.keys(tally).sort((a,b)=>tally[b]-tally[a])[0]||"ai",r=resultData[key],c=(snapshot?.courses||[]).find(c=>r.lookup.some(x=>String(c.title||"").toLowerCase().includes(x)));
  const specific=c&&/^[a-z0-9-]{3,60}$/i.test(String(c.slug||""))?routeTo("course/"+c.slug):"#/courses";
  return '<div class="rf26-quiz-answer"><span class="rf26-quiz-result-icon">'+(key==="ai"?"✳":key==="crypto"?"₿":"↗")+'</span><span class="rf26-mono">'+enc(r.over)+'</span><h3>'+enc(r.title)+'</h3><p>'+enc(r.desc)+'</p><span class="rf26-result-tag">'+enc(r.tag)+'</span><div class="rf26-quiz-actions"><a class="rf26-btn rf26-btn-light" href="'+specific+'">مشاهده مسیر پیشنهادی <span>↗</span></a><button type="button" data-rf26-quiz="restart">از اول امتحان می‌کنم ↺</button></div><small>پاسخ‌ها ذخیره یا به سرور ارسال نمی‌شوند.</small></div>';
 }
 return '<div class="rf26-quiz-head"><span>سؤال '+toPersian(quizStep+1)+' از '+toPersian(questions.length)+'</span><span dir="ltr">'+String(quizStep+1).padStart(2,"0")+' / 03</span></div>'+
 '<div class="rf26-quiz-meter"><span style="width:'+((quizStep+1)/questions.length*100)+'%"></span></div>'+
 '<h3>'+enc(q.label)+'</h3><p>'+enc(q.hint)+'</p>'+
 '<div class="rf26-quiz-choices">'+q.options.map((o,i)=>'<button type="button" data-rf26-quiz="'+enc(o.type)+'"><span class="rf26-choice-icon">'+o.icon+'</span><b>'+enc(o.label)+'</b><span aria-hidden="true">↗</span></button>').join("")+'</div>'+
 '<div class="rf26-quiz-foot"><span>بدون نیاز به ثبت‌نام یا واردکردن اطلاعات</span>'+(quizStep?'<button type="button" data-rf26-quiz="back">مرحله قبل ←</button>':'<span>۳ پرسش کوتاه</span>')+'</div>';
}
function render(state){
 snapshot=state;
 const opened=Array.isArray(state.courses)?state.courses.length:0;
 const pill=state.loading?"در حال دریافت دوره‌ها":state.error?"دریافت دوره‌ها":" "+toPersian(opened)+" دوره قابل ثبت‌نام";
 const daily=state.daily?.today||state.daily?.latest;
 return '<main class="rf26-home">'+
 '<section class="rf26-hero" aria-labelledby="rf26-main-title"><div class="rf26-hero-atmosphere" aria-hidden="true"></div><div class="rf26-hero-grid shell">'+
 '<div class="rf26-hero-copy"><div class="rf26-eyebrow"><span class="rf26-eyebrow-glow"></span><span>آموزشگاه روشنفکران / اقلید</span><i></i><span class="rf26-latin">FUTURE-READY LEARNING</span></div>'+
 '<h1 id="rf26-main-title">آینده را <span class="rf26-hero-white">انتظار نکش.</span><br><em>خودت بسازش.</em></h1>'+
 '<p>اینجا آموزش، به یک تجربه واقعی تبدیل می‌شود؛ از اولین جرقه کنجکاوی تا پروژه، نمونه‌کار و هویت حرفه‌ای خودت.</p>'+
 '<div class="rf26-hero-actions"><button type="button" class="rf26-btn rf26-btn-glow" data-rf26-scroll="rf26-discover">مسیر خودم را پیدا کنم <span aria-hidden="true">↗</span></button>'+
 '<a href="#/courses" class="rf26-btn rf26-btn-ghost">دوره‌های ثبت‌نام باز <span aria-hidden="true">←</span></a></div>'+
 '<div class="rf26-hero-proof"><span><b>01</b> تمرین و پروژه</span><span><b>02</b> ارزیابی مهارت</span><span><b>03</b> رزومه قابل ارائه</span></div></div>'+
 '<div class="rf26-stage" aria-label="نمای هنری سه‌بعدی فناوری و یادگیری"><div class="rf26-stage-circles" aria-hidden="true"></div><div class="rf26-scene-caption" aria-hidden="true">THE FUTURE IS NOW <span>✦</span></div>'+
 '<div class="rf26-orbit-label rf26-label-a"><span>01 /</span><b>CREATE</b><small>هوش مصنوعی</small></div><div class="rf26-orbit-label rf26-label-b"><span>02 /</span><b>EXPLORE</b><small>فناوری مالی</small></div>'+
 '<div class="rf26-stage-footer"><span>RF — LEARNING UNIVERSE</span><span dir="ltr">EST. IN EQLID / IRAN</span></div></div></div>'+
 '<div class="rf26-hero-foot shell"><span class="rf26-now"><i></i> '+enc(pill)+'</span><button type="button" data-rf26-scroll="rf26-tracks">بیشتر کشف کن <span>↓</span></button><span class="rf26-hero-index" dir="ltr">SCROLL / 001</span></div></section>'+
 '<div class="rf26-ticker" aria-label="حوزه‌های آموزشی"><div class="rf26-ticker-track" aria-hidden="true"><span>AI & CREATIVE TECHNOLOGY</span><i>✳</i><span>BLOCKCHAIN LITERACY</span><i>✳</i><span>MARKET INTELLIGENCE</span><i>✳</i><span>PROJECT-BASED LEARNING</span><i>✳</i><span>AI & CREATIVE TECHNOLOGY</span><i>✳</i><span>BLOCKCHAIN LITERACY</span></div></div>'+
 '<section class="rf-spatial shell" id="rf-spatial"><div class="rf-spatial-intro"><span>EXPERIENCE / 01—03</span><h2>سه جهان برای کشف آینده</h2><p>بین فضاهای آموزشی حرکت کن و حوزه موردعلاقه‌ات را بشناس.</p></div><div class="rf-spatial-scene" data-rf-room-active="0"><div class="rf-spatial-copy"><strong class="rf-spatial-kicker">AI / STUDIO</strong><h3 class="rf-spatial-title">کارگاه هوش مصنوعی</h3><p class="rf-spatial-desc">از ایده‌پردازی تا ساخت پروژه‌های هوشمند</p><a href="#/courses">دوره‌های ثبت‌نام باز ↗</a></div><div class="rf-spatial-menu" role="group" aria-label="انتخاب فضای آموزشی"><button type="button" data-rf-room="0" aria-pressed="true">۰۱ / هوش مصنوعی</button><button type="button" data-rf-room="1" aria-pressed="false">۰۲ / ارز دیجیتال</button><button type="button" data-rf-room="2" aria-pressed="false">۰۳ / فارکس</button></div></div><small class="rf-spatial-caption">تصاویر، فضاسازی مفهومی هستند و نمای ساختمان واقعی آموزشگاه نیستند.</small></section>'+
 '<section class="rf26-tracks-wrap" id="rf26-tracks"><div class="shell"><div class="rf26-section-top"><span class="rf26-section-code">01 / CHOOSE YOUR WORLD</span><div class="rf26-section-line"></div><span>سه مسیر برای آینده‌ای که می‌سازی</span></div>'+
 '<div class="rf26-tracks-intro"><h2>دنیای تو، <br><em>از اینجا شروع می‌شود.</em></h2><p>فقط یک دوره انتخاب نمی‌کنی؛ مسیری را انتخاب می‌کنی که قرار است با دست‌های خودت بسازی.</p></div>'+
 '<div class="rf26-tracks"><a href="#/courses" class="rf26-track rf26-track-ai"><div class="rf26-track-meta"><span>01 / CREATIVE AI</span><span class="rf26-track-arrow">↗</span></div><div class="rf26-track-visual" aria-hidden="true"><span class="rf26-art-label">NEURAL / STUDIO</span><div class="rf26-ai-art"><i></i><i></i><i></i><i></i><strong>✳</strong></div></div><div class="rf26-track-copy"><span class="rf26-track-tag">آفرینش و فناوری</span><h3>هوش مصنوعی</h3><p>از ایده تا خلق تصویر، محتوا، ابزار و ایجنت‌های هوشمند.</p><span class="rf26-track-link">کشف این دنیا <b>↗</b></span></div></a>'+
 '<a href="#/courses" class="rf26-track rf26-track-crypto"><div class="rf26-track-meta"><span>02 / DIGITAL ASSETS</span><span class="rf26-track-arrow">↗</span></div><div class="rf26-track-visual" aria-hidden="true"><span class="rf26-art-label">WEB3 / BLOCKCHAIN</span><div class="rf26-crypto-art"><span>◇</span><i></i><i></i></div></div><div class="rf26-track-copy"><span class="rf26-track-tag">آگاهی و تکنولوژی</span><h3>ارز دیجیتال</h3><p>شناخت بلاکچین، امنیت کیف پول و سواد دارایی دیجیتال.</p><span class="rf26-track-link">کشف این دنیا <b>↗</b></span></div></a>'+
 '<a href="#/courses" class="rf26-track rf26-track-fx"><div class="rf26-track-meta"><span>03 / MARKET THINKING</span><span class="rf26-track-arrow">↗</span></div><div class="rf26-track-visual" aria-hidden="true"><span class="rf26-art-label">CHART / THINKING</span><svg viewBox="0 0 280 154" aria-hidden="true"><path d="M3 125L34 108L53 112L75 77L97 94L128 48L147 66L167 41L200 73L228 25L275 11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 125L34 108L53 112L75 77L97 94L128 48L147 66L167 41L200 73L228 25L275 11V154H3Z" fill="url(#rffill)"/><defs><linearGradient id="rffill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs></svg></div><div class="rf26-track-copy"><span class="rf26-track-tag">تحلیل و تصمیم‌گیری</span><h3>فارکس و بازار</h3><p>شناخت نمودار، سناریوسازی و مدیریت مسئولانه ریسک.</p><span class="rf26-track-link">کشف این دنیا <b>↗</b></span></div></a></div>'+
 '<div class="rf26-tracks-bottom"><span>KNOW MORE. BUILD MORE. BECOME MORE.</span><a href="#/courses">مشاهده همه دوره‌های عمومی ↗</a></div></div></section>'+
 '<section class="rf26-quiz-section" id="rf26-discover"><div class="shell rf26-quiz-layout"><div class="rf26-quiz-lead"><span class="rf26-section-code">02 / FIND YOUR DIRECTION</span><h2>هنوز نمی‌دونی <br><em>از کجا شروع کنی؟</em></h2><p>این آزمون کوتاه کمک می‌کند موضوعی متناسب با علاقه‌ات پیدا کنی. نه ثبت‌نام لازم دارد، نه اطلاعات شخصی.</p><div class="rf26-quiz-orbit" aria-hidden="true"><span>YOU</span><i>AI</i><b>₿</b><em>↗</em></div></div><div class="rf26-quiz-box"><div id="rf26-quiz-live">'+quizMarkup()+'</div></div></div></section>'+
 '<section class="rf26-courses-section" id="rf26-open-courses"><div class="shell"><div class="rf26-section-top"><span class="rf26-section-code">03 / YOUR NEXT STEP</span><div class="rf26-section-line"></div><span>ظرفیت‌ها طبق تنظیم مدیریت</span></div>'+
 '<div class="rf26-split-heading"><div><h2>وقتِ <em>شروع کردن</em> است.</h2><p>دوره‌هایی که همین حالا امکان ثبت‌نام عمومی دارند، مستقیماً از سامانه آموزشگاه نمایش داده می‌شوند.</p></div><a href="#/courses" class="rf26-inline-link">همه دوره‌ها <span>↗</span></a></div>'+
 courseBlock(state)+'</div></section>'+
 '<section class="rf26-growth-section"><div class="shell rf26-growth-layout"><div class="rf26-growth-narrative"><span class="rf26-section-code">04 / MORE THAN A CLASS</span><h2>فقط سر کلاس <em>نمی‌نشینی.</em><br>چیزی می‌سازی که می‌مونه.</h2><p>هر هنرجو یک مسیر اختصاصی دارد: تکمیل پروفایل، تمرین، نمونه‌کار، ارزیابی و در نهایت رزومه‌ای قابل ارائه. اشتراک عمومی نمونه‌کار فقط با اجازه معتبر فعال می‌شود.</p><div class="rf26-growth-stats"><div><strong>۲۴</strong><span>مأموریت تعریف‌شده</span></div><div><strong>۳۰</strong><span>درس کوتاه خانواده</span></div><div><strong>۵</strong><span>ایستگاه مسیر پروفایل</span></div></div><a class="rf26-text-link" href="#/portals">فضای هنرجو و خانواده <span>↗</span></a></div>'+
 demoPanel()+'</div></section>'+
 '<section class="rf26-mission-section"><div class="shell"><div class="rf26-section-top"><span class="rf26-section-code">05 / THE 90-DAY MISSION</span><div class="rf26-section-line"></div><span>یادگیری، با حرکت روزانه</span></div><div class="rf26-mission-header"><div><h2>نود روز برای <em>متفاوت شدن.</em></h2><p>یادگیری با مأموریت‌های مرحله‌ای و بازخورد واقعی معنا پیدا می‌کند. برنامه مأموریت‌ها برای هنرجویان واجد شرایط از داخل پورتال فعال می‌شود.</p></div><span class="rf26-mission-giant" dir="ltr">90<span>DAYS</span></span></div>'+
 '<div class="rf26-mission-path"><div><span>01</span><b>آغاز مسیر</b><small>انتخاب مهارت</small></div><div><span>30</span><b>تمرین و کشف</b><small>ساخت عادت</small></div><div><span>60</span><b>ساخت و اصلاح</b><small>بازخورد مدرس</small></div><div><span>90</span><b>ارائه و ارزیابی</b><small>ثبت مسیر پیشرفت</small></div></div>'+
 '<a href="#/access" class="rf26-mission-cta">ورود به مسیر اختصاصی <span>↗</span></a></div></section>'+
 '<section class="rf26-family-section"><div class="shell rf26-family-layout"><div class="rf26-family-symbol" aria-hidden="true"><span>◎</span><small>FAMILY FIRST</small></div><div><span class="rf26-section-code">06 / GROW TOGETHER</span><h2>خانواده هم <em>هم‌مسیر</em> است.</h2><p>با دسترسی مخصوص والدین، پیشرفت‌های مجاز فرزند را ببینید و از درس‌های کوتاه کاربردی استفاده کنید. داده‌های خصوصی فقط با احراز هویت و رضایت لازم نمایش داده می‌شوند.</p><div class="rf26-family-actions"><a href="#/access" class="rf26-btn rf26-btn-dark">ورود خانواده <span>↗</span></a><span>۳۰ نکته کوتاه · مشاهده پیشرفت · حریم خصوصی</span></div></div></div></section>'+
 '<section class="rf26-notes-section"><div class="shell"><div class="rf26-section-top"><span class="rf26-section-code">07 / THE SIGNAL</span><div class="rf26-section-line"></div><span>آموختنی‌های تازه</span></div><div class="rf26-split-heading"><div><h2>برای ذهن‌هایی که <em>کنجکاوند.</em></h2><p>خبرها، نکته‌های روز و ایده‌های آموزشی بدون تیتر یا آمار ساختگی.</p></div><a href="#/updates" class="rf26-inline-link">آرشیو خبرها <span>↗</span></a></div>'+
 '<div class="rf26-news-layout"><div class="rf26-daily"><span>DAILY INSIGHT ✳</span><h3>'+enc(daily?.title||"یادگیری، از یک سؤال خوب شروع می‌شود.")+'</h3><p>'+enc(daily?.body||"نکته‌های آموزشی روزانه پس از تأیید محتوا در همین بخش منتشر می‌شوند.")+'</p><a href="#/updates">خواندن نکته‌های بیشتر ↗</a></div>'+newsBlock(state)+'</div></div></section>'+
 '<section class="rf26-faq-section"><div class="shell rf26-faq-layout"><div><span class="rf26-section-code">08 / GOOD QUESTIONS</span><h2>شاید همین سؤال <em>مال تو باشه.</em></h2><p>قبل از انتخاب مسیر، جواب مهم‌ترین سؤال‌ها را بدان.</p></div><div class="rf26-faq-list">'+[
 ["چطور بفهمم کدام دوره برای من مناسب‌تر است؟","از بخش «مسیر خودم را پیدا کنم» شروع کن. این راهنمای کوتاه بدون ثبت اطلاعات شخصی، موضوعات را بر اساس علاقه‌ات پیشنهاد می‌دهد. برای مشاوره دقیق هم می‌توانی با آموزشگاه تماس بگیری."],
 ["آیا می‌توانم بدون مراجعه حضوری ثبت‌نام کنم؟","برای دوره‌هایی که مدیریت ثبت‌نام آنلاین را فعال کرده باشد، اطلاعات دوره و درخواست ثبت‌نام از طریق سایت در دسترس است. تأیید نهایی طبق بررسی آموزشگاه انجام می‌شود."],
 ["پرداخت اقساطی هم امکان‌پذیر است؟","امکان اقساط به تنظیمات هر دوره بستگی دارد. اگر برای دوره‌ای فعال باشد، شرایط آن در صفحه همان دوره نمایش داده می‌شود."],
 ["پورتال هنرجو چه امکاناتی دارد؟","مسیر مرحله‌ای، پروژه‌ها، ارزیابی، اطلاعات مجاز کلاس‌ها و رزومه آموزشی. انتشار عمومی نمونه‌کار نیازمند رضایت معتبر است."],
 ["والدین چگونه پیشرفت فرزند را می‌بینند؟","والد یا سرپرست با حساب و ارتباط تأییدشده وارد پورتال خانواده می‌شود و فقط اطلاعاتی را می‌بیند که مجاز به مشاهده آن است."]
 ].map((x,i)=>'<details'+(i===0?' open':'')+'><summary><span>'+enc(String(i+1).padStart(2,"0"))+'</span><b>'+enc(x[0])+'</b><i aria-hidden="true">+</i></summary><p>'+enc(x[1])+'</p></details>').join("")+'</div></div></section>'+
 '<section class="rf26-last-section"><div class="shell rf26-last-layout"><span class="rf26-last-deco" aria-hidden="true">R.</span><span class="rf26-section-code">YOUR NEXT CHAPTER</span><h2>فصل بعدی‌ات، <em>از همین‌جا شروع می‌شه.</em></h2><p>انتخاب مسیر را سخت نکن. یک قدم کافی‌ست.</p><div class="rf26-last-actions"><a class="rf26-btn rf26-btn-glow" href="#/courses">دوره‌ها را ببین <span>↗</span></a><a class="rf26-btn rf26-btn-outline" href="tel:09164880996">با ما صحبت کن <span>↗</span></a></div><div class="rf26-last-contact"><span>ROSHANFEKRAN ACADEMY — EQLID</span><span>۰۹۱۶۴۸۸۰۹۹۶ · ۰۷۱۴۴۵۲۰۲۸۳</span></div></div></section></main>';
}
function scrollToSection(id){
 const el=document.getElementById(id);if(!el)return;
 const offset=80;
 const y=Math.max(0,window.scrollY+el.getBoundingClientRect().top-offset);
 if(window.RFMOTION?.status?.smooth&&window.Lenis){
  window.scrollTo({top:y,behavior:"smooth"});
 }else window.scrollTo({top:y,behavior:window.matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
}
root.addEventListener("click",e=>{
 const button=e.target.closest("[data-rf-room]");
 if(!button||!root.contains(button))return;
 const n=Number(button.dataset.rfRoom),rooms=[
 ["AI / STUDIO","کارگاه هوش مصنوعی","از ایده‌پردازی تا ساخت پروژه‌های هوشمند"],
 ["CRYPTO / LAB","آزمایشگاه بلاکچین","سواد ارز دیجیتال، امنیت و مدیریت ریسک"],
 ["FOREX / MARKET","اتاق تحلیل بازار","نمودار، تحلیل سناریو و مدیریت مسئولانه ریسک"]
 ];
 if(!Number.isInteger(n)||n<0||n>=rooms.length)return;
 const box=root.querySelector(".rf-spatial-scene");if(!box)return;box.dataset.rfRoomActive=String(n);
 const targets=[".rf-spatial-kicker",".rf-spatial-title",".rf-spatial-desc"];
 targets.forEach((selector,i)=>{const el=box.querySelector(selector);if(el)el.textContent=rooms[n][i]});
 box.querySelectorAll("[data-rf-room]").forEach(el=>el.setAttribute("aria-pressed",String(el===button)));
});
root.addEventListener("click",e=>{
 const action=e.target.closest("[data-rf26-scroll],[data-rf26-quiz]");if(!action||!root.contains(action))return;
 if(action.hasAttribute("data-rf26-scroll")){scrollToSection(action.getAttribute("data-rf26-scroll"));return}
 const key=action.getAttribute("data-rf26-quiz");if(!key)return;
 if(key==="restart"){quizStep=0;answers=[]}
 else if(key==="back"){quizStep=Math.max(0,quizStep-1);answers.pop()}
 else if(["ai","crypto","forex"].includes(key)&&quizStep<questions.length){answers[quizStep]=key;quizStep++}
 else return;
 const slot=root.querySelector("#rf26-quiz-live");if(slot)slot.innerHTML=quizMarkup();
});
window.RFHOMEPAGE={render};
})();
