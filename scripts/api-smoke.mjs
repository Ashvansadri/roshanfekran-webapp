import assert from "node:assert/strict";
const URL="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
async function request(action,additional={},headers={}){
 const r=await fetch(URL,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({action,...additional}),signal:AbortSignal.timeout(17000)});
 const d=await r.json();
 return {r,d};
}
async function read(action,additional={}){
 let last;
 for(let n=0;n<2;n++){
  try{
   const {r,d}=await request(action,additional);
   assert.equal(r.status,200,action+" HTTP status");
   assert.equal(d.ok,true,action+" response");
   return d;
  }catch(e){last=e;if(n===0)await new Promise(ok=>setTimeout(ok,950))}
 }
 throw Error(action+" read-only public API test failed: "+last?.message);
}
async function deny(label,action,additional,expectedStatus,headers={}){
 let last;
 for(let n=0;n<2;n++){
  try{
   const {r,d}=await request(action,additional,headers);
   assert.equal(r.status,expectedStatus,label+" must reject with HTTP "+expectedStatus);
   assert(typeof (d?.error||d?.message||d?.error_description)==="string",label+" must return an error (gateway or PostgREST format)");
   assert.equal(d.ok,undefined,label+" must not report success");
   for(const field of ["access_token","refresh_token","students","guardians","payments","enrollments","profile"]){
    assert.equal(d[field],undefined,label+" must not disclose "+field);
   }
   return;
  }catch(e){last=e;if(n===0)await new Promise(ok=>setTimeout(ok,950))}
 }
 throw Error(label+" negative authorization check failed: "+last?.message);
}
const catalog=await read("public_catalog");
assert(Array.isArray(catalog.courses),"courses must be an array");
assert(catalog.courses.every(c=>typeof c.title==="string"),"catalog titles must be text");
const news=await read("public_news");
assert(Array.isArray(news.ai),"news ai category");
const pushConfig=await read("push_config");
assert.equal(typeof pushConfig.available,"boolean","Push availability must be explicit");
if(pushConfig.available)assert(/^[A-Za-z0-9_-]{80,100}$/.test(pushConfig.public_key),"VAPID public key format");
else assert.equal(pushConfig.public_key,null,"Unavailable Push must not invent a key");
assert.equal(pushConfig.private_key,undefined,"Never expose a VAPID signing key");
const daily=await read("daily_public");
assert(daily.archive===undefined||Array.isArray(daily.archive),"daily archive shape");
const link=catalog.courses.find(c=>typeof c.slug==="string" && /^[a-z0-9-]{3,60}$/i.test(c.slug));
if(link){
 const data=await read("public_registration_info",{slug:link.slug});
 assert.equal(data.course?.id,link.id,"course registration links must refer to the correct course");
 assert(data.link && typeof data.link.slug==="string","valid public course registration info");
}
// Real negative tests against the deployed gateway; these never authenticate or mutate data.
// A failed authorization must not be mistaken for a passing public endpoint test.
await deny("anonymous portal resolution","resolve_portal",{},401);
await deny("anonymous Push status","push_status",{},401);
await deny("anonymous Push registration","push_save",{subscription:{endpoint:"https://example.test/push",keys:{p256dh:"testtesttest",auth:"testtest"}}},401);
await deny("anonymous Push removal","push_delete",{identity:"https://example.test/push"},401);
await deny("anonymous private student snapshot","proxy",{path:"/rest/v1/rpc/academy_student_journey_snapshot",method:"POST",body:{}},401);
await deny("anonymous private financial table","proxy",{path:"/rest/v1/academy_payments?select=id,amount&limit=1",method:"GET"},401);
await deny("forbidden proxy route","proxy",{path:"/auth/v1/admin/users",method:"GET"},403,{"authorization":"Bearer synthetic-test-only-not-a-session"});
// Credentialless live auth regression: synthetic strings must never grant access.
// No real account, password, SMS, or user data is used.
await deny("synthetic bearer portal resolution","resolve_portal",{},401,{"authorization":"Bearer synthetic-test-only-not-a-session"});
await deny("synthetic bearer private finance","proxy",{path:"/rest/v1/academy_payments?select=id,amount&limit=1",method:"GET"},401,{"authorization":"Bearer synthetic-test-only-not-a-session"});
const expired=await request("proxy",{path:"/auth/v1/token?grant_type=refresh_token",method:"POST",body:{refresh_token:"synthetic-invalid-refresh-token"}});
assert([400,401].includes(expired.r.status),"Synthetic refresh must be rejected as invalid credentials");
assert.equal(expired.d?.access_token,undefined,"Invalid refresh must never return an access token");
assert.equal(expired.d?.refresh_token,undefined,"Invalid refresh must never return a refresh token");
await deny("invalid public resume token","public_showcase",{token:"00000000-0000-4000-8000-000000000000"},404);
console.log("PASS: live public catalog ("+catalog.courses.length+" course(s)), news, daily content and registration info; eleven real anonymous/invalid-access denial checks; no writes.");
