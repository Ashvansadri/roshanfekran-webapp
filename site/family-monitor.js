/* Family + student accountability views; data from authenticated Supabase RPC and RLS only. */
(function(){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa=n=>new Intl.NumberFormat("fa-IR").format(Number(n||0));
const date=s=>{if(!s)return "بدون سررسید";const d=new Date(s);return isNaN(+d)?"—":new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"long",day:"numeric"}).format(d)};
const complete=v=>["submitted","late","graded","reviewed","approved"].includes(String(v||"").toLowerCase());
const title=s=>"<strong>"+esc(s||"تکلیف آموزشی")+"</strong>";
function parent(data){
 const children=Array.isArray(data?.students)?data.students.filter(s=>s?.permissions?.academic):[];
 const today=Date.now();
 const overdue=children.flatMap(c=>(Array.isArray(c.assignments)?c.assignments:[]).filter(a=>!complete(a.submission_status)&&a.due_at&&new Date(a.due_at).getTime()<today));
 const notifications=[...new Map(children.flatMap(c=>Array.isArray(c.notifications)?c.notifications:[]).map(n=>[n.id,n])).values()];
 const cards=children.map(c=>{
  const tasks=Array.isArray(c.assignments)?c.assignments:[],done=tasks.filter(x=>complete(x.submission_status));
  const late=tasks.filter(x=>!complete(x.submission_status)&&x.due_at&&new Date(x.due_at).getTime()<today);
  const pct=tasks.length?Math.round(done.length/tasks.length*100):0;
  return '<article class="rf-family-child"><div class="rf-family-child-head"><h3>'+esc(c?.student?.full_name||"هنرجو")+'</h3><span>'+fa(done.length)+' / '+fa(tasks.length)+' تکلیف تحویل‌شده</span></div>'+
  '<div class="rf-family-progress"><i style="width:'+pct+'%"></i></div>'+
  (late.length?'<p class="rf-family-late">'+fa(late.length)+' تکلیف با مهلت گذشته و بدون تحویل ثبت‌شده</p>':'<p class="rf-family-good">تکلیف عقب‌افتاده‌ای در داده‌های فعلی یافت نشد.</p>')+
  '<div class="rf-family-task-list">'+tasks.slice(0,20).map(a=>{
   const done=complete(a.submission_status),missed=!done&&a.due_at&&new Date(a.due_at).getTime()<today;
   return '<div class="rf-family-task"><span>'+title(a.title)+'</span><small>'+date(a.due_at)+'</small><b class="'+(done?"done":missed?"late":"pending")+'">'+(done?"تحویل‌شده":missed?"عقب‌افتاده":"در انتظار")+'</b></div>';
  }).join("")+'</div></article>';
 }).join("");
 return '<section class="rf-panel rf-family-monitor"><div class="rf-panel-title"><span>◎</span><h3>نظارت خانواده بر یادگیری</h3></div>'+
 '<p>تکلیف‌های منتشرشده و تحویل‌های واقعی در این بخش نمایش داده می‌شود. نبود اتصال یا خطای دریافت اطلاعات به‌معنای انجام‌ندادن تکلیف نیست.</p>'+
 '<div class="rf-family-snapshot"><div><strong>'+fa(children.length)+'</strong><span>هنرجوی متصل</span></div><div><strong>'+fa(overdue.length)+'</strong><span>تکلیف عقب‌افتاده</span></div><div><strong>'+fa(notifications.filter(n=>!n.read_at).length)+'</strong><span>اعلان جدید</span></div></div>'+
 (cards||'<div class="rf-empty">برای مشاهده سوابق، ابتدا مدیر رابطه سرپرستی را فعال کند و سرپرست هویت خود را تأیید کند.</div>')+
 '<h3>صندوق اعلان و پیگیری</h3><div class="rf-family-notice-list">'+
 (notifications.length?notifications.slice(0,20).map(n=>'<article><strong>'+esc(n.title||"اطلاع آموزشگاه")+'</strong><p>'+esc(n.body||"")+'</p><small>'+date(n.due_at)+'</small></article>').join(""):'<p>اعلان جدیدی ثبت نشده است. پس از پایان مهلت تکلیف انجام‌نشده، اعلان داخلی برای خانواده دارای مجوز ایجاد می‌شود.</p>')+
 '</div><p class="rf-caption">اعلان‌ها در سامانه ثبت می‌شوند. ارسال روی گوشی فقط بعد از فعال‌سازی اختیاری Push روی دستگاه سرپرست ممکن است؛ در حال حاضر پیامک خودکار فعال نیست.</p></section>';
}
function student(assignments,submissions,notifications){
 const list=Array.isArray(assignments)?assignments:[],subs=Array.isArray(submissions)?submissions:[],alerts=Array.isArray(notifications)?notifications:[];
 const byId=new Map(subs.map(s=>[String(s.assignment_id),s])),now=Date.now();
 const late=list.filter(a=>!complete(byId.get(String(a.id))?.status)&&a.due_at&&new Date(a.due_at).getTime()<now);
 return '<section class="rf-panel rf-family-monitor"><div class="rf-panel-title"><span>✓</span><h3>تکلیف‌ها و مسئولیت‌های من</h3></div>'+
 '<div class="rf-family-snapshot"><div><strong>'+fa(list.length)+'</strong><span>تکلیف منتشرشده</span></div><div><strong>'+fa(late.length)+'</strong><span>تکلیف عقب‌افتاده</span></div><div><strong>'+fa(alerts.filter(n=>!n.read_at).length)+'</strong><span>اعلان خوانده‌نشده</span></div></div>'+
 (list.length?'<div class="rf-student-task-grid">'+list.slice(0,30).map(a=>{
   const entry=byId.get(String(a.id)),done=complete(entry?.status),overdue=!done&&a.due_at&&new Date(a.due_at).getTime()<now;
   return '<article class="rf-student-assignment"><div class="rf-family-child-head">'+title(a.title)+'<span class="'+(done?"done":overdue?"late":"pending")+'">'+(done?"تحویل‌شده":overdue?"مهلت گذشته":"منتظر تحویل")+'</span></div><p>'+esc(a.instructions||"")+'</p><small>سررسید: '+date(a.due_at)+'</small>'+
   (!done?'<form class="rf-form rf-task-submit" id="rf-student-task"><input type="hidden" name="assignment_id" value="'+esc(a.id)+'"/><label class="portal-field"><span>توضیح مراحل انجام کار</span><textarea name="submission_text" required minlength="10" rows="3"></textarea></label><label class="portal-field"><span>لینک پروژه (اختیاری)</span><input name="submission_url" type="url" placeholder="https://..."/></label><button type="submit" class="btn btn-primary">ثبت تحویل تکلیف</button></form>':"")+'</article>';
 }).join("")+'</div>':'<div class="rf-empty">هنوز تکلیف منتشرشده‌ای در دوره‌های شما دیده نمی‌شود.</div>')+
 '<h3>مرکز اعلان‌های من</h3><div class="rf-family-notice-list">'+
 (alerts.length?alerts.slice(0,15).map(n=>'<article class="rf-family-notice"><div><strong>'+esc(n.title||"اعلان")+'</strong><p>'+esc(n.body||"")+'</p></div>'+(n.read_at?"":'<button type="button" data-rf="notification-read" data-id="'+esc(n.id)+'">خواندم</button>')+'</article>').join(""):'<p>هنوز اعلان جدیدی ندارید.</p>')+
 '</div></section>';
}
window.RFFAMILY={parent,student};
})();