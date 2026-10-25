import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../supabase/functions/academy-gateway/index.ts",import.meta.url),"utf8");
assert(source.includes("if(b.action==='push_config')"),"VAPID public config missing");
assert(source.includes("if(b.action==='push_status')"),"Scoped status action missing");
const save=source.slice(source.indexOf("if(b.action==='push_save')"),source.indexOf("if(b.action==='push_delete')"));
assert(save.includes("user_id=eq."),"Update must be owner scoped");
assert(save.includes("'resolution=ignore-duplicates,return=representation'"),"Conflicts must not reassign endpoints");
assert(!save.includes("resolution=merge-duplicates"),"Unsafe global upsert");
assert(save.includes("validWebPushEndpoint(identity)"),"Web Push trusted endpoint validation required");
assert(save.includes("validWebPushKeys(keys)"),"Web Push key length validation required");
assert(!save.includes("record:Array.isArray"),"Never return subscription secret material");

const extract=name=>{
 const m=source.match(new RegExp("function "+name+"\\([^)]*\\)\\{[\\s\\S]*?\\n\\}"));
 assert(m,"Missing "+name+" implementation");
 return m[0].replaceAll(":string","").replaceAll(":any","");
};
const validEndpoint=vm.runInNewContext(extract("validWebPushEndpoint")+"; validWebPushEndpoint",{URL});
const validKeys=vm.runInNewContext(extract("validWebPushKeys")+"; validWebPushKeys",{atob});
for(const url of [
 "https://fcm.googleapis.com/fcm/send/abc",
 "https://updates.push.services.mozilla.com/wpush/v2/abc",
 "https://web.push.apple.com/QAA",
 "https://wns2-db3p.notify.windows.com/w/?token=123"
])assert(validEndpoint(url),"Legitimate browser push endpoint rejected: "+url);
for(const url of [
 "https://localhost/secret","https://127.0.0.1/secret",
 "https://169.254.169.254/latest/meta-data","https://evil.example/collect",
 "http://fcm.googleapis.com/fcm/send/abc",
 "https://fcm.googleapis.com:444/fcm/send/abc",
 "https://user:password@fcm.googleapis.com/fcm/send/abc",
 "https://fcm.googleapis.com/fcm/send/abc#frag",
 "https://fcm.googleapis.com.evil.example/fcm/send/abc"
])assert(!validEndpoint(url),"Unsafe browser push endpoint accepted: "+url);
const encoded=n=>Buffer.alloc(n,1).toString("base64url");
assert(validKeys({p256dh:encoded(65),auth:encoded(16)}),"Valid Web Push keys rejected");
assert(!validKeys({p256dh:encoded(16),auth:encoded(16)}),"Truncated P-256 key accepted");
assert(!validKeys({p256dh:encoded(65),auth:encoded(2)}),"Truncated auth secret accepted");
assert(!validKeys({p256dh:encoded(65),auth:"not!base64"}),"Malformed auth secret accepted");
assert(save.includes("subscription:platform==='web'?{endpoint:identity,keys:"),"Web Push payload must be reduced to required fields");

console.log("PASS: student-scoped Push ownership, trusted endpoints, key sizes and VAPID readiness");
