import {readFileSync,existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
import assert from "node:assert/strict";
const root=new URL("../",import.meta.url).pathname;
const site=join(root,"site");
const html=readFileSync(join(site,"index.html"),"utf8");
const scripts=["app.js","portal.js","enroll.js","public-resume.js","scene.js","luxury.js","motion.js","homepage.js","cinematic.js","academy-ops.js","family-monitor.js","sw.js"];
const styles=["styles.css","experience.css","portal.css","enroll.css","scene.css","invites.css","luxury.css","motion.css","homepage.css","portal-premium.css","cinematic.css","academy-ops.css","family-monitor.css"];
for(const file of scripts){
 const filepath=join(site,file);assert(existsSync(filepath),file+" missing");
 const check=spawnSync(process.execPath,["--check",filepath],{encoding:"utf8"});
 assert.equal(check.status,0,file+" syntax error: "+check.stderr);
}
for(const f of styles){
 assert(existsSync(join(site,f)),f+" missing");
 assert(html.includes('href="./'+f+'"'),f+" stylesheet not linked");
}
for(const f of scripts.filter(f=>f!=="sw.js"))assert(html.includes('src="./'+f+'"'),f+" script not linked");
for(const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))
 assert(existsSync(join(site,match[1])),"Broken asset link: "+match[1]);
assert(html.includes('lang="fa" dir="rtl"'),"Persian RTL expected");
assert(html.includes('name="viewport"'),"Mobile viewport expected");
const css=styles.map(f=>readFileSync(join(site,f),"utf8")).join("\n");
assert(css.includes("prefers-reduced-motion"),"Reduced-motion fallback expected");
assert(css.includes("Vazirmatn"),"Persian font stack missing");
const js=scripts.map(f=>readFileSync(join(site,f),"utf8")).join("\n");
assert(!/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk_live_|service_role_key/i.test(js),"Secret key detected in public bundle");
assert(!/localStorage\s*\.\s*setItem\s*\(\s*["']rf_/i.test(js),"Persistent session token storage forbidden");
for(const rpc of ["academy_student_journey_snapshot","academy_parent_journey_snapshot","academy_student_resume_snapshot","academy_submit_mission","academy_set_showcase_share"])
 assert(js.includes(rpc),"Missing existing backend integration: "+rpc);
assert(js.includes("submit_public_registration"),"Registration endpoint missing");
const portal=readFileSync(join(site,"portal.js"),"utf8");
assert(!portal.includes('"?select=*&limit=50"'),"Staff portal must not fetch all personal fields");
for(const projection of ["id,full_name,user_id,archived_at,status","id,full_name,course_id,status","id,title,instructions,published,course_id"])
 assert(portal.includes(projection),"Missing least-privilege staff projection: "+projection);
for(const route of ['"portal"','"parent"','"teacher"','"manage"'])
 assert(portal.includes(route),"Missing protected route alias: "+route);
for(const table of ["academy_enrollments","academy_installments","academy_payments"])
 assert(portal.includes("/rest/v1/"+table+"?select="),"Missing read-only student finance projection: "+table);
assert(portal.includes("financePanel()"),"Student finance view missing");
assert(portal.includes("finance=f.every"),"Finance query failures must fail closed");
assert(/href="#\/access">ورود\s*</.test(html),"Public login button must say ورود");
const manifest=JSON.parse(readFileSync(join(site,"manifest.webmanifest"),"utf8"));
assert.equal(manifest.lang,"fa");assert.equal(manifest.display,"standalone");
for(const size of [192,512]){
 const icon=manifest.icons.find(x=>x.sizes===size+"x"+size&&x.type==="image/png");
 assert(icon,"PWA raster icon missing: "+size);
 if(size===512)assert(icon.purpose.includes("maskable"),"Maskable PWA icon required");
}
for(const size of [180,192,512]){
 const path=join(site,"assets","rf-icon-"+size+".png");
 assert(existsSync(path),"PWA icon missing: "+size);
 const bytes=readFileSync(path);
 assert.equal(bytes.readUInt32BE(0),0x89504e47,"Invalid PNG signature");
 assert.equal(bytes.readUInt32BE(16),size,"Incorrect PNG width");
 assert.equal(bytes.readUInt32BE(20),size,"Incorrect PNG height");
}
assert(html.includes('rel="apple-touch-icon"'),"Apple touch icon missing");
const sw=readFileSync(join(site,"sw.js"),"utf8");
for(const size of [180,192,512])assert(sw.includes("/assets/rf-icon-"+size+".png"),"PWA icon not precached: "+size);
for(const name of ["rf_hero_real3d.webp","rf_ai_real3d.webp","rf_crypto_real3d.webp","rf_forex_real3d.webp","rf_architecture_real3d.webp"])assert(existsSync(join(site,"assets",name)),"Local cinematic asset missing: "+name);
assert(!css.includes("roshanfekran-academy-control.floot.app/_cdn/"),"Cinematic CSS must not depend on legacy Floot CDN");

const motion=readFileSync(join(site,"motion.js"),"utf8");
assert(motion.includes("ScrollTrigger") && motion.includes("Lenis"),"Missing GSAP / Lenis integration");
assert(motion.includes("prefers-reduced-motion"),"Motion must honor user preference");
for(const pkg of ["gsap@3.13.0","lenis@1.3.27"])
 assert(html.includes(pkg),"Pinned animation library missing: "+pkg);
assert(html.includes("motion.css") && html.includes("motion.js"),"Motion assets unlinked");
assert(html.includes("homepage.css") && html.includes("homepage.js"),"New editorial homepage assets unlinked");
assert(html.includes("portal-premium.css"),"Premium internal portal CSS not linked");
assert(js.includes("RFHOMEPAGE"),"Conversion-focused homepage missing");
const ops=readFileSync(join(site,"academy-ops.js"),"utf8");
assert(ops.includes('students:["academy_students","id,full_name,user_id,status"]'),"Staff student query must use minimal display fields");
assert(!/emergency_name|emergency_mobile/.test(ops),"Staff frontend must not fetch unused emergency contact details");
assert(ops.includes('viewer:["courses"]'),"Read-only viewer must not preload student or financial records");
assert(ops.includes('manage()||meRole()==="viewer"'),"Viewer must retain the read-only courses tab");
const isolation=spawnSync(process.execPath,[join(root,"scripts/ops-isolation.test.mjs")],{encoding:"utf8"});
assert.equal(isolation.status,0,"Staff session isolation regression failed: "+isolation.stderr+" "+isolation.stdout);
console.log(isolation.stdout.trim());
const financeQA=spawnSync(process.execPath,[join(root,"scripts/ops-finance.test.mjs")],{encoding:"utf8"});
assert.equal(financeQA.status,0,"Finance/viewer privacy regression failed: "+financeQA.stderr+" "+financeQA.stdout);
console.log(financeQA.stdout.trim());
const teacherQA=spawnSync(process.execPath,[join(root,"scripts/ops-teacher.test.mjs")],{encoding:"utf8"});
assert.equal(teacherQA.status,0,"Teacher RPC/RLS regression failed: "+teacherQA.stderr+" "+teacherQA.stdout);
console.log(teacherQA.stdout.trim());
const contractsQA=spawnSync(process.execPath,[join(root,"scripts/ops-contracts.test.mjs")],{encoding:"utf8"});
assert.equal(contractsQA.status,0,"Contract role/privacy regression failed: "+contractsQA.stderr+" "+contractsQA.stdout);
console.log(contractsQA.stdout.trim());
const writesQA=spawnSync(process.execPath,[join(root,"scripts/ops-write-confirmation.test.mjs")],{encoding:"utf8"});
assert.equal(writesQA.status,0,"Guardian/assignment write confirmation regression failed: "+writesQA.stderr+" "+writesQA.stdout);
console.log(writesQA.stdout.trim());
assert(portal.includes('placeholder="رمز حساب فعال شما"'),"Existing-account login must not claim an 8-character minimum");
const gatewayArchiveQA=spawnSync(process.execPath,[join(root,"scripts/gateway-archive.test.mjs")],{encoding:"utf8"});
assert.equal(gatewayArchiveQA.status,0,"Gateway archived-student regression failed: "+gatewayArchiveQA.stderr+" "+gatewayArchiveQA.stdout);
console.log(gatewayArchiveQA.stdout.trim());
console.log("PASS: 6 scripts, 6 CSS assets, referenced files, Persian typography, secure role-aware calls and PWA metadata.");
