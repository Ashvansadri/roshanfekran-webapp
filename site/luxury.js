(function(){
"use strict";
const steps=[
["مرحله ۰۱ / شروع","کشف مسیر مناسب","مشاهده دوره‌های فعال، آشنایی با ابزارها و انتخاب هدف روشن برای یادگیری."],
["مرحله ۰۲ / تجربه","یادگیری با پروژه","تمرین‌های واقعی و مأموریت‌های مرحله‌ای به‌جای یادگیری صرفاً تئوری."],
["مرحله ۰۳ / رشد","بازخورد قابل اتکا","بازبینی مدرس، ارزیابی مهارت‌ها و پیشرفت مستند در پورتال اختصاصی."],
["مرحله ۰۴ / آینده","ارائه مهارت","گالری نمونه‌کار و رزومه تأییدشده؛ انتشار فقط با اجازه صاحب پروفایل."]
];
const root=document.getElementById("app");if(!root)return;
root.addEventListener("click",e=>{
 const button=e.target.closest("[data-rf-journey]");if(!button||!root.contains(button))return;
 const n=Number(button.getAttribute("data-rf-journey"));if(!Number.isInteger(n)||n<0||n>=steps.length)return;
 root.querySelectorAll("[data-rf-journey]").forEach(el=>{const active=el===button;el.classList.toggle("current",active);el.setAttribute("aria-pressed",String(active))});
 const detail=root.querySelector("#rf-journey-detail");if(!detail)return;
 const label=detail.querySelector(".rf-journey-detail-label"),h=detail.querySelector("h3"),p=detail.querySelector("p");
 if(label)label.textContent=steps[n][0];if(h)h.textContent=steps[n][1];if(p)p.textContent=steps[n][2];
});
if(!matchMedia("(prefers-reduced-motion: reduce)").matches){
 root.addEventListener("pointermove",e=>{const target=e.target.closest(".rf-journey-surface");if(!target||e.pointerType!=="mouse")return;
 const rect=target.getBoundingClientRect();const nx=Math.max(-1,Math.min(1,((e.clientX-rect.left)/rect.width-.5)*2));const ny=Math.max(-1,Math.min(1,((e.clientY-rect.top)/rect.height-.5)*2));
 target.style.setProperty("--rf-shift-x",(nx*6).toFixed(2)+"px");target.style.setProperty("--rf-shift-y",(ny*6).toFixed(2)+"px");
 },{passive:true});
}
})();