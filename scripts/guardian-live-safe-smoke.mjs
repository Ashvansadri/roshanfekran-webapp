import assert from "node:assert/strict";
const url="https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway";
async function req(action,body={}){
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(19000)});
 const json=await response.json().catch(()=>({}));
 return {status:response.status,json};
}
const s=await req("push_config");
assert.equal(s.status,200,"push_config status");
assert.equal(s.json.ok,true,"push_config response");
assert.equal(typeof s.json.available,"boolean","Push capability must be explicit");
const unknown=await req("guardian_phone_request",{phone:"09000000000"});
assert.equal(unknown.status,200,"Unknown guardian phone requests must get uniform response without sending SMS");
assert.equal(unknown.json.ok,true);
assert.equal(unknown.json.requested,true);
const noToken=await req("proxy",{path:"/rest/v1/rpc/academy_guardian_phone_claim",method:"POST",body:{}});
assert([401,403].includes(noToken.status),"Unauthenticated guardian claim must fail closed");
console.log("PASS: production gateway v49+ public Push capability, safe non-invited phone handling, and unauthenticated guardian claim denial.");
console.log("VAPID_PUBLIC_KEY_CONFIGURED="+String(s.json.available));
