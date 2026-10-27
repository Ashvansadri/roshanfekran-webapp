/* Guided assignment template builder. Local draft only; instructor reviews and publishes. */
(function(){
"use strict";
function buildDraft({courseTitle,skill,level}){
 const subject=String(skill||"").trim().slice(0,100),course=String(courseTitle||"").trim().slice(0,120);
 if(subject.length<3||course.length<3)throw Error("عنوان دوره و مهارت را مشخص کنید.");
 const difficulty={beginner:"مقدماتی",intermediate:"متوسط",advanced:"پیشرفته"}[level];if(!difficulty)throw Error("سطح تمرین معتبر نیست.");
 const work={beginner:"یک نمونه ساده و قابل اجرا بساز",intermediate:"دو راه‌حل را پیاده‌سازی و مقایسه کن",advanced:"یک نمونه کامل بساز، خطاهای احتمالی را آزمون و نتیجه را تحلیل کن"}[level];
 return {title:"پروژه "+difficulty+": "+subject,instructions:"دوره: "+course+"\nهدف: تمرین عملی مهارت «"+subject+"» در سطح "+difficulty+".\n۱. مسئله یا کاربرد واقعی این مهارت را در ۳ جمله تعریف کن.\n۲. "+work+".\n۳. مراحل کارت را همراه با تصویر، فایل یا لینک قابل بررسی مستند کن.\n۴. نتیجه و دست‌کم یک ایراد یا نکته بهبود را توضیح بده.\nخروجی تحویل: فایل یا لینک پروژه + شرح کوتاه مراحل + نتیجه.\nمعیار ارزیابی: درستی اجرا (۴۰٪)، توضیح روش (۳۰٪)، کیفیت تحویل (۲۰٪)، بررسی خطا (۱۰٪).\nاگر جایی را بلد نیستی، سؤال مشخصی در توضیح تحویل بنویس تا مدرس راهنمایی کند."};
}
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-rf-draft-assignment]");if(!button)return;
 const form=button.closest("#rfops-assignment");if(!form)return;event.preventDefault();
 const feedback=form.querySelector(".rf-agent-feedback");
 try{
  const selected=form.querySelector('[name="course_id"]')?.selectedOptions[0],course=selected?.textContent||"";
  const values=buildDraft({courseTitle:course,skill:form.elements.draft_skill.value,level:form.elements.draft_level.value});
  form.elements.title.value=values.title;form.elements.instructions.value=values.instructions;
  feedback.textContent="پیش‌نویس آماده شد. متن را بازبینی کن، مهلت را انتخاب کن و فقط پس از تأیید، تکلیف را منتشر کن.";
  form.elements.title.focus();
 }catch(e){feedback.textContent=e.message||"ایجاد پیش‌نویس ممکن نشد.";}
});
window.RFASSIGNMENT={buildDraft};
})();
