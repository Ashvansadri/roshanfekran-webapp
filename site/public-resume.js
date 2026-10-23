(function(){
"use strict";
const END="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const safeURL=v=>{try{const u=new URL(String(v));return u.protocol==="https:"?u.href:"#"}catch{return "#"}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Public resume authorization is server-controlled. Keep only a short-lived in-memory
// snapshot, never persist it to storage or the service worker.
const cache=new Map(),pending=new Set(),controllers=new Map();
const RECHECK_MS=15000;
let routeRevision=0,displayedToken=null;
// Route transitions revoke the in-memory snapshot and cancel pending requests,
// including transitions to enrollment routes that bypass RFPUBLIC.route().
function syncRoute(){
 const next=activeToken();
 if(next===displayedToken)return;
 routeRevision++;displayedToken=next;
 for(const controller of controllers.values())controller.abort();
 controllers.clear();pending.clear();cache.clear();
}
const activeToken=()=>{const p=(location.hash||"").replace(/^#\/?/,"").split("?")[0].split("/");const t=String(p[1]||"").toLowerCase();return p[0]==="showcase"&&uuid.test(t)?t:null};
function invalidateActive(){
 const t=activeToken();if(!t||pending.has(t)||document.hidden)return;
 cache.delete(t);window.RFCORE?.render?.();
}
async function load(token){
 const revision=routeRevision;
 const c=new AbortController();
 controllers.set(token,c);pending.add(token);
 try{
  const h=setTimeout(()=>c.abort(),16000);
  let r;try{r=await fetch(END,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"public_showcase",token}),cache:"no-store",signal:c.signal})}finally{clearTimeout(h)}
  const x=await r.json().catch(()=>({error:"پاسخ نامعتبر"}));
  if(revision!==routeRevision||activeToken()!==token)return;
  if(!r.ok||!x.ok)throw Error(x.error||"لینک نامعتبر است");
  cache.set(token,{data:x.profile,checkedAt:Date.now()});
 }catch(e){
  if(revision===routeRevision&&activeToken()===token)
   cache.set(token,{error:c.signal.aborted?"پاسخ سرور طولانی شد؛ دوباره تلاش کنید.":(e.message||"رزومه یافت نشد"),checkedAt:Date.now()});
 }finally{
  if(controllers.get(token)===c){controllers.delete(token);pending.delete(token)}
  if(revision===routeRevision&&activeToken()===token)window.RFCORE?.render?.();
 }
}
function route(parts){
 syncRoute();
 if(parts[0]!=="showcase")return null;
 const t=String(parts[1]||"").toLowerCase();
 if(!uuid.test(t))return '<main class="shell rf-panel-container"><div class="rf-panel"><h1>لینک رزومه معتبر نیست</h1><a class="thin-link" href="#/">بازگشت ←</a></div></main>';
 // A revoked link must be checked again after leaving and returning to the page.
 for(const old of cache.keys())if(old!==t)cache.delete(old);
 let st=cache.get(t);
 if(st&&Date.now()-st.checkedAt>=RECHECK_MS){cache.delete(t);st=null;}
 if(!st&&!pending.has(t)){load(t);return '<main class="shell rf-panel-container"><div class="rf-panel"><div class="rf-rotator"></div><h2>در حال بررسی مجوز انتشار...</h2></div></main>'}
 if(!st)return '<main class="shell rf-panel-container"><div class="rf-panel"><div class="rf-rotator"></div><h2>در حال بررسی مجوز...</h2></div></main>';
 if(st.error)return '<main class="shell rf-panel-container"><div class="rf-panel"><h1>این رزومه در دسترس نیست</h1><div class="portal-alert">'+esc(st.error)+'</div><p>ممکن است مالک لینک را لغو کرده باشد یا زمان اعتبار به پایان رسیده باشد.</p><a class="btn btn-outline" href="#/">بازگشت به آموزشگاه</a></div></main>';
 const d=st.data||{},works=Array.isArray(d.works)?d.works:[];
 return '<main class="shell rf-public-resume"><div class="rf-overline">VERIFIED STUDENT WORK • ROSHANFEKRAN</div><div class="rf-resume-header"><div><h1>'+esc(d.full_name)+'</h1><h2>'+esc(d.headline)+'</h2><p>'+esc(d.bio)+'</p><div class="rf-action-row"><button class="btn btn-primary" type="button" data-rf-public="print">چاپ یا ذخیره PDF</button><a class="btn btn-outline" href="#/">صفحه اصلی آموزشگاه ←</a></div></div>'+(safeURL(d.avatar_url)!=="#"?'<img src="'+esc(safeURL(d.avatar_url))+'" alt="تصویر هنرجو با اجازه انتشار" loading="lazy" referrerpolicy="no-referrer"/>':'<span class="rf-resume-initial">✧</span>')+'</div><section class="rf-resume-section"><span class="rf-overline">PORTFOLIO</span><h2>نمونه‌کارهای تأییدشده</h2><div class="rf-mission-grid">'+(works.length?works.map(w=>'<article class="rf-mission"><div class="rf-mission-top"><span>تأیید آموزشگاه</span><span>'+esc(w.category)+'</span></div><h3>'+esc(w.title)+'</h3><p>'+esc(w.description)+'</p>'+(safeURL(w.project_url)!=="#"?'<a class="thin-link" href="'+esc(safeURL(w.project_url))+'" rel="noopener noreferrer" target="_blank">مشاهده پروژه ↗</a>':"")+'</article>').join(""):'<p class="rf-empty">نمونه‌کار قابل مشاهده‌ای وجود ندارد.</p>')+'</div></section><section class="rf-resume-section"><h2>علایق و هدف</h2><p>'+esc(d.interest_tags||"")+'</p><p>'+esc(d.career_goal||"")+'</p><div class="rf-caption">'+esc(d.notice||"این رزومه آموزشی است و گواهینامه رسمی نیست.")+'</div><div class="rf-caption">اعتبار لینک تا: '+esc(d.expires_at?new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium"}).format(new Date(d.expires_at)):"—")+'</div></section></main>';
}
window.addEventListener("hashchange",syncRoute);
document.getElementById("app").addEventListener("click",e=>{if(e.target.closest("[data-rf-public='print']"))window.print()});
document.addEventListener("visibilitychange",()=>{
 if(document.hidden)cache.clear();
 else invalidateActive();
});
window.addEventListener("focus",()=>{
 const t=activeToken(),st=t&&cache.get(t);
 if(st&&Date.now()-st.checkedAt>2000)invalidateActive();
});
window.setInterval(()=>{
 const t=activeToken(),st=t&&cache.get(t);
 if(st&&Date.now()-st.checkedAt>=RECHECK_MS)invalidateActive();
},5000);
window.RFPUBLIC={route};
})();