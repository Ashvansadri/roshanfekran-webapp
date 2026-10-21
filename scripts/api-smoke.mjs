import assert from "node:assert/strict";
const URL="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
async function read(action,additional={}){
 let last;
 for(let n=0;n<2;n++){
  try{
   const r=await fetch(URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...additional}),signal:AbortSignal.timeout(17000)});
   const d=await r.json();
   assert.equal(r.status,200,action+" HTTP status");
   assert.equal(d.ok,true,action+" response");
   return d;
  }catch(e){last=e;if(n===0)await new Promise(ok=>setTimeout(ok,950))}
 }
 throw Error(action+" read-only public API test failed: "+last?.message);
}
const catalog=await read("public_catalog");
assert(Array.isArray(catalog.courses),"courses must be an array");
assert(catalog.courses.every(c=>typeof c.title==="string"),"catalog titles must be text");
const news=await read("public_news");
assert(Array.isArray(news.ai),"news ai category");
const daily=await read("daily_public");
assert(daily.archive===undefined||Array.isArray(daily.archive),"daily archive shape");
const link=catalog.courses.find(c=>typeof c.slug==="string" && /^[a-z0-9-]{3,60}$/i.test(c.slug));
if(link){
 const data=await read("public_registration_info",{slug:link.slug});
 assert.equal(data.course?.id,link.id,"course registration links must refer to the correct course");
 assert(data.link && typeof data.link.slug==="string","valid public course registration info");
}
console.log("PASS: live public catalog ("+catalog.courses.length+" course(s)), news, daily content and public registration info, with no writes.");
