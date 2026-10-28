/* Public offline shell only. Private data and authentication responses are never cached. */
const CACHE="rf-academy-public-v40";
const SHELL=[
 "/",
 "/index.html",
 "/manifest.webmanifest",
 "/favicon.svg",
 "/assets/rf-icon-180.png",
 "/assets/rf-icon-192.png",
 "/assets/rf-icon-512.png",
 "/assets/rf_hero_real3d.webp",
 "/assets/rf_ai_real3d.webp",
 "/assets/rf_crypto_real3d.webp",
 "/assets/rf_forex_real3d.webp",
 "/assets/rf_architecture_real3d.webp",
 "/styles.css",
 "/experience.css",
 "/portal.css",
 "/enroll.css",
 "/scene.css",
 "/invites.css",
 "/luxury.css",
 "/motion.css",
 "/homepage.css",
 "/portal-premium.css",
 "/cinematic.css",
 "/academy-ops.css",
  "/daily-admin.css",
 "/family-monitor.css",
 "/atelier27.css",
 "/atelier-noir.css",
 "/reference-cinema.css",
 "/academy-studio-os.css",
 "/academy-companion.css",
 "/academy-agents.css",
 "/immersive-worlds.css",
 "/app.js",
 "/portal.js",
 "/enroll.js",
 "/public-resume.js",
 "/scene.js",
 "/luxury.js",
 "/motion.js",
 "/homepage.js",
 "/cinematic.js",
 "/academy-companion.js",
 "/academy-agents.js",
 "/immersive-worlds.js",
 "/academy-ops.js",
  "/daily-admin.js",
 "/family-monitor.js"
];
const PUBLIC_FILES=new Set(SHELL);

self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(key=>key.startsWith("rf-academy-public-")&&key!==CACHE).map(key=>caches.delete(key))
 )));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 // Same-origin, query-free, explicitly public static resources only.
 // Never cache session-bearing URLs, gateway/API responses, or third-party requests.
 if(url.origin!==self.location.origin||url.search||!PUBLIC_FILES.has(url.pathname))return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{
   if(!response.ok)throw Error("Offline fallback");
   return response;
  }).catch(()=>caches.match("/index.html")));
  return;
 }
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==="basic"){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
  }
  return response;
 }).catch(()=>caches.match(request)));
});


/*
 * Push delivery is opt-in and requires a separately configured VAPID
 * subscription + authorized sender. The public offline cache never stores
 * push payloads, user tokens, or private API responses.
 */
function safePushRoute(value){
 const fallback="/#/updates";
 if(typeof value!=="string"||value.length>400)return fallback;
 try{
  const url=new URL(value,self.location.origin);
  if(url.origin!==self.location.origin)return fallback;
  if(url.pathname!=="/"&&url.pathname!=="/index.html")return fallback;
  if(url.search)return fallback;
  if(!new RegExp("^#/(?:updates|portal|courses|missions)(?:[/?].*)?$").test(url.hash))return fallback;
  return "/"+url.hash;
 }catch{return fallback}
}
self.addEventListener("push",event=>{
 let payload={};
 if(event.data){
  try{payload=event.data.json()}catch{
   try{payload={body:event.data.text()}}catch{payload={}}
  }
 }
 if(!payload||typeof payload!=="object"||Array.isArray(payload))payload={};
 const title=typeof payload.title==="string"&&payload.title.trim()
  ?payload.title.trim().slice(0,100):"روشنفکران | نکته روز";
 const body=typeof payload.body==="string"&&payload.body.trim()
  ?payload.body.trim().slice(0,220):"محتوای آموزشی تازه منتشر شد.";
 const route=safePushRoute(payload.url||"/#/updates");
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:"/assets/rf-icon-192.png",badge:"/assets/rf-icon-192.png",
  tag:typeof payload.tag==="string"?payload.tag.slice(0,60):"rf-daily-learning",
  data:{url:route}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const route=safePushRoute(event.notification?.data?.url);
  const destination=new URL(route,self.location.origin).href;
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of windows){
   try{
    if(new URL(client.url).origin!==self.location.origin)continue;
    await client.navigate(destination);
    await client.focus();
    return;
   }catch{/* Try the next window or open a new one. */}
  }
  await self.clients.openWindow(destination);
 })());
});
