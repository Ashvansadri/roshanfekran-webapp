const CACHE="rf-academy-public-v1";
const SHELL=["/","/index.html","/styles.css","/experience.css","/portal.css","/app.js","/portal.js","/public-resume.js","/favicon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("rf-academy-")&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const u=new URL(event.request.url);
 // Never cache private API responses, credentials or cross-origin resources.
 if(u.origin!==self.location.origin||u.pathname.startsWith("/_api/"))return;
 if(event.request.mode==="navigate"){
  event.respondWith(fetch(event.request).catch(()=>caches.match("/index.html")));
  return;
 }
 if(SHELL.includes(u.pathname))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
