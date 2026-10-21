(function(){
"use strict";
const END="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const num=v=>new Intl.NumberFormat("fa-IR").format(Number(v||0));
const money=v=>num(v)+" تومان";
const valid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const cache=new Map(),pending=new Set(),result=new Map();
async function gateway(action,body={},timeout=18000){
 const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),timeout);
 try{const r=await fetch(END,{method:"POST",headers:{"Content-Type":"application/json"},signal:ac.signal,body:JSON.stringify({action,...body})});
 const j=await r.json().catch(()=>({error:"پاسخ نامعتبر"}));if(!r.ok||j.error)throw Error(j.error||"ثبت درخواست ناموفق بود");return j
 }finally{clearTimeout(tm)}
}
function render(){window.RFCORE?.render?.()}
async function load(slug){pending.add(slug);
 try{cache.set(slug,{data:await gateway("public_registration_info",{slug})})}
 catch(e){cache.set(slug,{error:e.message||"مشخصات دوره در دسترس نیست"})}
 finally{pending.delete(slug);render()}}
async function toBase64(file){return new Promise((res,rej)=>{const reader=new FileReader();reader.onerror=()=>rej(Error("فایل قابل خواندن نیست"));reader.onload=()=>res(String(reader.result||"").split(",")[1]||"");reader.readAsDataURL(file)})}
function route(parts){
 if(parts[0]!=="enroll")return null;
 const slug=decodeURIComponent(parts[1]||"");if(slug.length<3||slug.length>60||!valid.test(slug))return '<main class="shell section"><div class="portal-alert">لینک ثبت‌نام معتبر نیست.</div></main>';
 if(!cache.has(slug)&&!pending.has(slug)){load(slug)}
 if(!cache.has(slug))return '<main class="shell section"><div class="skeleton"></div></main>';
 const d=cache.get(slug);
 if(d.error)return '<main class="shell section"><div class="portal-alert">'+esc(d.error)+'</div><a href="#/courses" class="btn btn-outline">بازگشت</a></main>';
 const c=d.data?.course||{},s=d.data?.settings||{},l=d.data?.link||{},p=d.data?.pricing||{};
 const finished=result.get(slug);
 if(finished)return '<main class="shell rf-enroll-success"><div class="rf-panel"><div class="rf-auth-symbol">✓</div><div class="rf-overline">REGISTRATION SUBMITTED</div><h1>درخواست ثبت‌نام ارسال شد</h1><p>درخواست شما در سامانه روشنفکران ثبت شده و در انتظار بررسی مدیریت است. ثبت درخواست به معنی تأیید نهایی یا دریافت گواهی نیست.</p><div class="rf-success-code">کد رهگیری: <b>'+esc(finished.tracking_code||"در سامانه ثبت شد")+'</b></div><a href="#/courses" class="btn btn-primary">مشاهده سایر دوره‌ها</a></div></main>';
 const full=Number(p.full_amount||c.base_fee||0),total=Number(p.installment_total||0);
 return '<main class="shell rf-enroll"><section class="page-hero"><div class="rf-overline">ENROLLMENT / ROSHANFEKRAN</div><h1>پیش‌ثبت‌نام <span class="gradient-text">دوره</span></h1><p>'+esc(c.title||"دوره روشنفکران")+' · درخواست شما پس از بررسی و تأیید مدیریت نهایی می‌شود.</p></section>'+
 '<section class="rf-enroll-grid"><div class="rf-panel"><h2>اطلاعات متقاضی</h2><p>فقط اطلاعات لازم برای پیگیری ثبت‌نام را وارد کنید. این فرم به سامانه اصلی روشنفکران متصل است.</p><form class="rf-form" id="rf-enroll-submit"><input type="hidden" name="slug" value="'+esc(slug)+'"/>'+
 '<div class="rf-enroll-pair"><label class="portal-field"><span>نام و نام خانوادگی *</span><input name="full_name" minlength="3" maxlength="140" required/></label><label class="portal-field"><span>شماره همراه *</span><input name="mobile" type="tel" inputmode="numeric" pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" required dir="ltr"/></label></div>'+
 '<div class="rf-enroll-pair"><label class="portal-field"><span>کد ملی (در صورت نیاز)</span><input name="national_id" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" dir="ltr"/></label><label class="portal-field"><span>شهر</span><input name="city" maxlength="100"/></label></div>'+
 '<label class="portal-field"><span>ایمیل برای مکاتبه</span><input name="email" type="email" dir="ltr" placeholder="name@example.com"/></label>'+
 '<label class="portal-field"><span>روش ارائه رسید بیعانه (اگر برای این دوره ضروری باشد)</span><select name="payment_method"><option value="card_transfer">کارت به کارت</option><option value="bank_transfer">انتقال بانکی</option><option value="cash">پرداخت نقدی در آموزشگاه</option><option value="pos">کارت‌خوان آموزشگاه</option></select></label>'+
 '<label class="portal-field"><span>تصویر یا PDF رسید پرداخت (در صورت درخواست آموزشگاه، تا ۴ مگابایت)</span><input type="file" name="receipt" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"/></label>'+
 '<label class="portal-field"><span>شماره پیگیری تراکنش</span><input name="reference_no" maxlength="100"/></label><label class="portal-field"><span>توضیح یا درخواست شما</span><textarea name="note" rows="3" maxlength="800"></textarea></label>'+
 '<label class="rf-check"><input type="checkbox" name="privacy" required/> رضایت دارم اطلاعات فرم صرفاً برای پیگیری ثبت‌نام توسط آموزشگاه پردازش شود.</label>'+
 '<div id="rf-enroll-error" aria-live="assertive"></div><button type="submit" class="btn btn-primary">ثبت درخواست و دریافت کد پیگیری ←</button></form></div>'+
 '<aside class="rf-panel rf-enroll-aside"><span class="rf-overline">COURSE DETAILS</span><h3>'+esc(c.title||"دوره آموزشی")+'</h3><p>کد دوره: '+esc(c.code||"—")+'</p><div class="rf-meters"><span>شهریه نقدی</span><b>'+money(full)+'</b></div>'+
 (l.installment_enabled?'<div class="rf-meters"><span>جمع شهریه اقساطی</span><b>'+money(total)+'</b></div><div class="rf-meters"><span>حداکثر تعداد اقساط</span><b>'+num(l.installment_max_count||3)+'</b></div><p class="rf-caption">تقسیط باید جداگانه توسط آموزشگاه تأیید شود؛ این فرم درخواست عمومی است و درگاه آنلاین محسوب نمی‌شود.</p>':'')+
 '<div class="rf-meters"><span>ظرفیت باقی‌مانده</span><b>'+(c.seats_left==null?"استعلام":num(c.seats_left))+'</b></div>'+
 '<p class="rf-caption">در صورت نیاز به واریز بیعانه، ابتدا شرایط را از آموزشگاه استعلام و رسید واقعی را بارگذاری کنید؛ رسید صرفاً پس از بررسی مدیریت تأیید می‌شود.</p>'+
 (s.bank_card?'<div class="rf-bank"><small>کارت اعلام‌شده آموزشگاه</small><b dir="ltr">'+esc(s.bank_card)+'</b><span>'+esc(s.bank_holder||"")+'</span></div>':'')+
 (s.payment_instructions?'<p class="rf-caption">'+esc(s.payment_instructions)+'</p>':"")+
 '<a href="tel:09164880996" class="btn btn-outline">پشتیبانی ثبت‌نام ↗</a></aside></section></main>';
}
document.getElementById("app").addEventListener("submit",async e=>{
 const form=e.target;if(form.id!=="rf-enroll-submit")return;
 e.preventDefault();const btn=form.querySelector("button[type=submit]"),err=document.getElementById("rf-enroll-error");if(btn.disabled)return;
 btn.disabled=true;btn.textContent="در حال ارسال امن...";
 try{
  const d=new FormData(form),slug=String(d.get("slug")||"");const name=String(d.get("full_name")||"").trim();
  const mobile=String(d.get("mobile")||"").replace(/\D/g,"");if(name.length<3||!/09\d{9}/.test(mobile)||!d.has("privacy"))throw Error("مشخصات و رضایت داده‌ها را کامل کنید.");
  const data={slug,full_name:name,mobile,national_id:d.get("national_id")||"",email:d.get("email")||"",city:d.get("city")||"",note:d.get("note")||"",payment_method:d.get("payment_method")||"card_transfer",reference_no:d.get("reference_no")||""};
  const file=d.get("receipt");
  if(file instanceof File&&file.size>0){if(file.size>4194304||!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type))throw Error("فرمت یا اندازه رسید معتبر نیست.");data.receipt_mime=file.type;data.receipt_base64=await toBase64(file)}
  const output=await gateway("submit_public_registration",data,35000);
  result.set(slug,output);render();window.scrollTo({top:0,behavior:"auto"});
 }catch(ex){err.innerHTML='<div class="portal-alert">'+esc(ex.message||"ارسال ناموفق")+'</div>'}
 finally{btn.disabled=false;btn.textContent="ثبت درخواست و دریافت کد پیگیری ←"}
});
window.RFENROLL={route};
})();