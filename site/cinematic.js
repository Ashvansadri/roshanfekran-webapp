/* Future art direction interaction: restrained parallax on true CGI assets */
(function(){
"use strict";
const root=document.getElementById("app");if(!root)return;
const reduce=matchMedia("(prefers-reduced-motion: reduce)"),coarse=matchMedia("(pointer: coarse)");
if(reduce.matches||coarse.matches)return;
let pending=false,last;
root.addEventListener("pointermove",e=>{
 const target=e.target.closest(".rf26-stage");if(!target)return;
 last={target,x:e.clientX,y:e.clientY};
 if(pending)return;pending=true;
 requestAnimationFrame(()=>{
  pending=false;if(!last||!last.target.isConnected)return;
  const r=last.target.getBoundingClientRect();
  const x=(last.x-r.left)/r.width-.5,y=(last.y-r.top)/r.height-.5;
  last.target.style.setProperty("--rf-cinema-x",(x*6).toFixed(2)+"px");
  last.target.style.setProperty("--rf-cinema-y",(y*5).toFixed(2)+"px");
 });
},{passive:true});
})();