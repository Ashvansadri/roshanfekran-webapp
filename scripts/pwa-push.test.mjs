import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../site/sw.js",import.meta.url),"utf8");
const listeners={};
const shown=[];
const visited=[];
const opened=[];
const self={
 location:{origin:"https://roshanfekran-next-academy.onrender.com"},
 addEventListener(name,callback){listeners[name]=callback},
 registration:{async showNotification(title,options){shown.push({title,options})}},
 clients:{
  async matchAll(){return [{url:"https://roshanfekran-next-academy.onrender.com/#/courses",async navigate(url){visited.push(url)},async focus(){visited.push("focused")}}]},
  async openWindow(url){opened.push(url)}
 }
};
vm.runInNewContext(source,{self,URL,Set,Promise,console});

async function push(data){
 let completion;
 listeners.push({data,waitUntil(p){completion=p}});
 await completion;
 return shown.at(-1);
}
async function click(notification){
 let completion;
 listeners.notificationclick({notification:{...notification,close(){visited.push("closed")}},waitUntil(p){completion=p}});
 await completion;
}
assert.ok(listeners.push,"Push listener must be registered");
assert.ok(listeners.notificationclick,"Click listener must be registered");

const valid=await push({json(){return {title:"  نکته روز  ",body:"تمرین امروز",url:"/#/portal",tag:"lesson"}}});
assert.equal(valid.title,"نکته روز");
assert.equal(valid.options.body,"تمرین امروز");
assert.equal(valid.options.data.url,"/#/portal");
assert.equal(valid.options.icon,"/assets/rf-icon-192.png");

const malicious=await push({json(){return {title:"External",url:"https://evil.example/phish"}}});
assert.equal(malicious.options.data.url,"/#/updates","Cross-origin URLs must not be opened");
const traversal=await push({json(){return {url:"/admin#/portal"}}});
assert.equal(traversal.options.data.url,"/#/updates","Unexpected paths must be rejected");
const query=await push({json(){return {url:"/?token=secret#/portal"}}});
assert.equal(query.options.data.url,"/#/updates","Query parameters must be rejected");
const fallback=await push({json(){throw Error("not json")},text(){return "Plain-text message"}});
assert.equal(fallback.options.body,"Plain-text message");
await click(valid.options);
assert.ok(visited.includes("https://roshanfekran-next-academy.onrender.com/#/portal"));
assert.ok(visited.includes("focused"));
assert.equal(opened.length,0);
await click({data:{url:"https://evil.example/"}});
assert.ok(visited.includes("https://roshanfekran-next-academy.onrender.com/#/updates"));
assert.ok(!visited.some(x=>String(x).includes("evil.example")));
console.log("PASS: push payload, fallback, origin checks and notification click navigation");
