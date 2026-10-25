/* Daily-learning manager studio. Only authenticated owner/manager can call server actions. */
(function(){
"use strict";
const root=document.getElementById("app"),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||""));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
let role=null,request=null,state=null,error="",notice="",editing="",busy=false,epoch=0;
const authorized=()=>role?.kind==="staff"&&["owner","manager"].includes(String(role.role||""));
const refresh=()=>window.RFCORE?.render?.();
function reset(){epoch++;role=null;request=null;state=null;error="";notice="";editing="";busy=false;}
async function load(r,api){
 const generation=++epoch;role=r;request=api;state=null;error="";
 if(!authorized())return;
 try{
  const d=await api("daily_admin_list",{},true);
  if(generation!==epoch)return;
  if(!d?.ok||!Array.isArray(d.items)||!Array.isArray(d.courses))throw Error("پاسخ مدیریت نکته روز معتبر نیست.");
  state={items:d.items.filter(x=>uuid(x.id)),courses:d.courses.filter(x=>uuid(x.id)),subscribers:Math.max(0,Number(d.push_subscribers||0))};
 }catch(e){if(generation===epoch){state=null;error=String(e?.message||"دریافت نکته‌های روز ممکن نیست.");}}
}
function render(r){
 if(r?.kind!=="staff"||!["owner","manager"].includes(String(r.role||"")))return "";
 if(!state)return '<section class="rf-panel rfdaily"><h2>استودیوی نکته روز</h2><div role="alert" class="rfops-warn">اطلاعات دریافت نشد؛ انتشار غیرفعال است. '+esc(error||"تازه‌سازی کنید.")+'</div></section>';
 const items=state.items,v=items.find(x=>x.id===editing&&x.status!=="archived")||{publish_date:today(),title:"",body:"",category:"general",action_title:"",action_prompt:"",audience:"all",course_id:"",status:"draft",push_enabled:false,push_title:"",push_body:"",media_url:""};
 const option=(a,b)=>String(a)===String(b)?" selected":"";
 const courses=state.courses.map(c=>'<option value="'+esc(c.id)+'"'+option(c.id,v.course_id)+'>'+esc(c.title)+'</option>').join("");
 const cards=items.map(x=>'<article class="rfdaily-card"><div><strong>'+esc(x.title)+'</strong><span data-status="'+esc(x.status)+'">'+esc({draft:"پیش‌نویس",published:"منتشرشده",archived:"بایگانی"}[x.status]||x.status)+'</span></div><small>'+esc(x.publish_date)+' · '+(x.audience==="course"?esc(state.courses.find(c=>c.id===x.course_id)?.title||"دوره"):"همه هنرجویان")+'</small><p>'+esc(String(x.body||"").slice(0,170))+'</p>'+
 (x.status!=="archived"?'<div class="rfdaily-actions"><button type="button" data-rfdaily="edit" data-id="'+esc(x.id)+'">ویرایش</button><button type="button" data-rfdaily="archive" data-id="'+esc(x.id)+'">بایگانی</button></div>':"")+'</article>').join("");
 return '<section class="rf-panel rfdaily"><div class="rfdaily-head"><span class="rf-overline">DAILY LEARNING STUDIO</span><h2>انتشار نکته روز و تمرین</h2><p>ابتدا پیش‌نویس بسازید و بعد منتشر کنید. انتشار به‌تنهایی هیچ اعلان Push ارسال نمی‌کند.</p></div>'+
 (error?'<div class="rfops-warn" role="alert">'+esc(error)+'</div>':"")+(notice?'<div class="rfops-ok" role="status">'+esc(notice)+'</div>':"")+
 '<div class="rfdaily-metrics"><div><strong>'+items.filter(x=>x.status==="published").length+'</strong><span>منتشرشده</span></div><div><strong>'+items.filter(x=>x.status==="draft").length+'</strong><span>پیش‌نویس</span></div><div><strong>'+state.subscribers+'</strong><span>اشتراک Push فعال</span></div></div>'+
 '<div class="rfdaily-editor"><h3>'+(editing?"ویرایش محتوا":"ساخت محتوای جدید")+'</h3>'+(editing?'<button type="button" data-rfdaily="cancel">لغو ویرایش</button>':"")+
 '<form id="rfdaily-form" class="rfops-form">'+
 '<label>تاریخ انتشار (میلادی)<input type="date" name="publish_date" required value="'+esc(v.publish_date)+'"/></label>'+
 '<label>عنوان<input name="title" required minlength="3" maxlength="160" value="'+esc(v.title)+'"/></label>'+
 '<label>موضوع<select name="category">'+["general","ai","crypto","forex"].map((k,i)=>'<option value="'+k+'"'+option(k,v.category)+'>'+["عمومی","هوش مصنوعی","ارز دیجیتال","فارکس"][i]+'</option>').join("")+'</select></label>'+
 '<label class="rfops-wide">متن آموزشی<textarea name="body" required minlength="10" maxlength="5000" rows="5">'+esc(v.body)+'</textarea></label>'+
 '<label>عنوان تمرین<input name="action_title" maxlength="120" value="'+esc(v.action_title||"")+'"/></label>'+
 '<label class="rfops-wide">شرح تمرین<textarea name="action_prompt" maxlength="2000" rows="3">'+esc(v.action_prompt||"")+'</textarea></label>'+
 '<label>مخاطب<select name="audience"><option value="all"'+option("all",v.audience)+'>همه هنرجویان</option><option value="course"'+option("course",v.audience)+'>یک دوره</option></select></label>'+
 '<label>دوره<select name="course_id"><option value="">— انتخاب —</option>'+courses+'</select></label>'+
 '<label>وضعیت<select name="status"><option value="draft"'+option("draft",v.status)+'>پیش‌نویس</option><option value="published"'+option("published",v.status)+'>منتشرشده</option></select></label>'+
 '<label class="rfops-wide">تصویر HTTPS (اختیاری)<input type="url" dir="ltr" name="media_url" maxlength="1000" value="'+esc(v.media_url||"")+'"/></label>'+
 '<label class="rfops-consent"><input type="checkbox" name="push_enabled"'+(v.push_enabled?" checked":"")+'/> مجوز ارسال Push برای این محتوا؛ ارسال واقعی جداگانه است.</label>'+
 '<label>عنوان اعلان<input name="push_title" maxlength="120" value="'+esc(v.push_title||"")+'"/></label>'+
 '<label class="rfops-wide">متن اعلان<textarea name="push_body" maxlength="240" rows="2">'+esc(v.push_body||"")+'</textarea></label>'+
 '<button class="btn btn-primary" type="submit"'+(busy?" disabled":"")+'>'+(editing?"ذخیره تغییرات":"ثبت محتوا")+'</button></form></div>'+
 '<h3>فهرست محتوا</h3><div class="rfdaily-grid">'+(cards||'<div class="rf-empty">محتوایی ثبت نشده است.</div>')+'</div></section>';
}
async function act(action,button){
 if(busy||!authorized()||!state)return;
 const id=String(button.dataset.id||"");error="";notice="";
 if(action==="cancel"){editing="";refresh();return;}
 if(action==="edit"){if(!state.items.some(x=>x.id===id&&x.status!=="archived")){error="محتوا قابل ویرایش نیست.";refresh();return;}editing=id;refresh();return;}
 if(action!=="archive"||!uuid(id)||!state.items.some(x=>x.id===id&&x.status!=="archived"))return;
 if(!confirm("این محتوا بایگانی شود؟ سوابق تکمیل هنرجویان حذف نمی‌شوند."))return;
 busy=true;const generation=epoch;
 try{
  const result=await request("daily_admin_archive",{id},true);
  if(generation!==epoch)return;
  if(!result?.ok||result.record?.id!==id||result.record?.status!=="archived")throw Error("بایگانی توسط سرور تأیید نشد.");
  await load(role,request);editing="";notice="محتوا بایگانی شد.";
 }catch(e){if(generation===epoch)error=String(e?.message||"خطای بایگانی");}
 finally{if(authorized()){busy=false;refresh();}}
}
async function submit(form){
 if(busy||!authorized()||!state)return;
 const d=new FormData(form),get=k=>String(d.get(k)||"").trim();
 const publish_date=get("publish_date"),title=get("title"),body=get("body"),category=get("category"),audience=get("audience"),course_id=get("course_id"),status=get("status"),media_url=get("media_url");
 const action_title=get("action_title"),action_prompt=get("action_prompt"),push_title=get("push_title"),push_body=get("push_body");
 error="";notice="";
 try{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(publish_date)||!Number.isFinite(Date.parse(publish_date))||new Date(publish_date+"T00:00:00Z").toISOString().slice(0,10)!==publish_date)throw Error("تاریخ نامعتبر است.");
  if(title.length<3||title.length>160||body.length<10||body.length>5000||action_title.length>120||action_prompt.length>2000||push_title.length>120||push_body.length>240||!["general","ai","crypto","forex"].includes(category)||!["all","course"].includes(audience)||!["draft","published"].includes(status))throw Error("اطلاعات محتوا معتبر نیست.");
  if(audience==="course"&&!state.courses.some(x=>x.id===course_id))throw Error("دوره معتبر انتخاب کنید.");
  if(media_url){let u;try{u=new URL(media_url)}catch{throw Error("نشانی تصویر معتبر نیست.");}if(u.protocol!=="https:"||u.username||u.password||media_url.length>1000)throw Error("نشانی تصویر باید HTTPS باشد.");}
  const id=editing;
  if(id&&!state.items.some(x=>x.id===id&&x.status!=="archived"))throw Error("محتوا قابل ویرایش نیست.");
  if(!confirm(status==="published"?"محتوا منتشر شود؟ ارسال Push از این صفحه انجام نمی‌شود.":"پیش‌نویس ذخیره شود؟"))return;
  busy=true;const generation=epoch;
  const saved=await request("daily_admin_save",{...(id?{id}:{}),publish_date,title,body,category,audience,course_id:audience==="course"?course_id:null,status,media_url,action_title,action_prompt,push_title,push_body,push_enabled:d.has("push_enabled")},true);
  if(generation!==epoch)return;
  if(!saved?.ok||!uuid(saved.record?.id)||saved.record?.title!==title||saved.record?.status!==status||(id&&saved.record.id!==id))throw Error("ثبت توسط سرور تأیید نشد.");
  await load(role,request);editing="";notice=status==="published"?"محتوا منتشر شد.":"پیش‌نویس ذخیره شد.";
 }catch(e){error=String(e?.message||"ذخیره ناموفق بود.");}
 finally{if(authorized()){busy=false;refresh();}}
}
root?.addEventListener("click",event=>{const b=event.target.closest("[data-rfdaily]");if(!b||!root.contains(b))return;event.preventDefault();act(b.dataset.rfdaily,b);});
root?.addEventListener("submit",event=>{if(event.target?.id!=="rfdaily-form")return;event.preventDefault();submit(event.target);});
window.RFDAILY={load,render,reset};
})();