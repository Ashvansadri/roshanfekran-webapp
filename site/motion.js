/*
 * Roshanfekran motion director.
 * Lenis v1.3.27 + GSAP v3.13.0 + ScrollTrigger.
 * Dynamic hash-routed page, privacy preserving, accessibility-first.
 * If CDNs fail, all content remains visible and native scrolling works.
 */
(function(){
 "use strict";
 const root=document.getElementById("app");
 if(!root)return;
 const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
 const touch=window.matchMedia("(pointer: coarse)");
 const gs=window.gsap;
 const Scroll=window.ScrollTrigger;
 const LenisClass=window.Lenis;
 let smooth=null,observer=null,animations=[],ticker=null,currentElements=[];
 const usable=!!(gs&&Scroll&&typeof gs.registerPlugin==="function");
 if(usable){try{gs.registerPlugin(Scroll)}catch(err){console.warn("[RF motion] ScrollTrigger unavailable",err)}}
 const status={gsap:usable,lenis:!!LenisClass,reduced:reduce.matches,smooth:false};
 window.RFMOTION={status,refresh,scrollTop,stop:stop};
 function stop(){
  if(observer){observer.disconnect();observer=null}
  animations.forEach(a=>{try{a.kill?.()}catch{}});
  animations=[];
  currentElements.forEach(el=>{
   if(el&&el.isConnected){
    el.style.removeProperty("opacity");
    el.style.removeProperty("visibility");
    el.style.removeProperty("transform");
   }
  });
  currentElements=[];
 }
 function scrollTop(){if(smooth)try{smooth.scrollTo(0,{immediate:true,force:true})}catch{}}
 function initSmooth(){
  if(!LenisClass||reduce.matches||touch.matches)return;
  try{
   smooth=new LenisClass({
    duration:1.05,
    smoothWheel:true,
    syncTouch:false,
    touchMultiplier:1,
    wheelMultiplier:0.92,
    autoRaf:!usable,
    anchors:false,
   });
   status.smooth=true;
   if(usable){
    smooth.on("scroll",Scroll.update);
    ticker=function(seconds){smooth.raf(seconds*1000)};
    gs.ticker.add(ticker);
    gs.ticker.lagSmoothing(0);
   }
  }catch(error){status.smooth=false;console.warn("[RF motion] Native scrolling fallback",error)}
 }
 function destroySmooth(){
  if(ticker&&usable){gs.ticker.remove(ticker);ticker=null}
  if(smooth){smooth.destroy();smooth=null}
  status.smooth=false;
 }
 function revealFallback(nodes){
  /* The fallback never hides content: it only applies a short visual glow. */
  if(!("IntersectionObserver" in window))return;
  observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(entry.isIntersecting){
     entry.target.classList.add("rf-motion-inview");
     observer.unobserve(entry.target);
    }
   });
  },{threshold:0.08,rootMargin:"0px 0px -25px 0px"});
  nodes.forEach(node=>observer.observe(node));
 }
 function refresh(){
  stop();
  status.reduced=reduce.matches;
  const isPublic=!root.querySelector(".rf-dashboard,.rf-auth,.rf-login,.rf-form,.rf-panel-container");
  if(reduce.matches||!isPublic)return;
  const hero=root.querySelector(".hero");
  const publicCards=[...root.querySelectorAll(".card-grid .card,.news-card,.feature-panel,.rf-journey-top,.rf-journey-surface")].slice(0,24);
  const isActive=usable&&Scroll&&typeof Scroll.create==="function";
  if(!isActive){
   revealFallback(publicCards);
   return;
  }
  if(hero){
   const heroItems=[...hero.querySelectorAll(".eyebrow,h1,p,.actions,.micro")];
   currentElements.push(...heroItems);
   animations.push(gs.from(heroItems,{
    opacity:0,y:22,duration:0.9,ease:"power2.out",stagger:0.105,
    clearProps:"transform,opacity,visibility",overwrite:"auto"
   }));
   const stage=hero.querySelector(".stage");
   if(stage){
    currentElements.push(stage);
    animations.push(gs.from(stage,{
     opacity:0,scale:0.965,duration:1.3,ease:"power2.out",delay:0.24,
     clearProps:"transform,opacity,visibility",overwrite:"auto"
    }));
   }
  }
  publicCards.forEach((card,index)=>{
   if(hero?.contains(card))return;
   currentElements.push(card);
   animations.push(gs.from(card,{
    opacity:0,y:24,duration:0.85,ease:"power2.out",
    clearProps:"transform,opacity,visibility",overwrite:"auto",
    scrollTrigger:{trigger:card,start:"top 94%",once:true,markers:false},
   }));
  });
  const progress=document.getElementById("rf-scroll-progress");
  if(progress){
   gs.set(progress,{scaleX:0,transformOrigin:"right center"});
   animations.push(gs.to(progress,{
    scaleX:1,ease:"none",duration:1,
    scrollTrigger:{trigger:document.documentElement,start:"top top",end:"bottom bottom",scrub:0.25}
   }));
  }
  try{Scroll.refresh(true)}catch{}
 }
 reduce.addEventListener?.("change",()=>{
  stop();destroySmooth();
  if(!reduce.matches)initSmooth();
  refresh();
 });
 window.addEventListener("pagehide",()=>{stop();destroySmooth()},{once:true});
 // Lenis is intentionally desktop-only; native touch, keyboard and
 // assistive navigation are never intercepted on mobile.
 initSmooth();
 refresh();
})();
