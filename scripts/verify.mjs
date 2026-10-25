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
assert(ops.includes('students:["academy_students","id,full_name,user_id,status,archived_at"]'),"Staff student query must include archive status and minimal display fields");
assert(ops.includes('row("students").filter(s=>s.status!=="archived"&&s.archived_at==null)'),"Family linking must hide archived students");
assert(portal.includes('const eligibleStudents=students.filter(x=>x.status!=="archived"&&x.archived_at==null)'),"Portal invites must exclude archived students");
assert(!/emergency_name|emergency_mobile/.test(ops),"Staff frontend must not fetch unused emergency contact details");
assert(ops.includes('viewer:["courses"]'),"Read-only viewer must not preload student or financial records");
assert(ops.includes('ledgerPayments:["academy_payments","id,enrollment_id,installment_id,amount,paid_at,status"]'),"Finance ledger projection missing or overly broad");
assert(ops.includes('enrollmentManager()||meRole()==="viewer"'),"Viewer must retain read-only courses and registrar must have course tab");
const isolation=spawnSync(process.execPath,[join(root,"scripts/ops-isolation.test.mjs")],{encoding:"utf8"});
assert.equal(isolation.status,0,"Staff session isolation regression failed: "+isolation.stderr+" "+isolation.stdout);
console.log(isolation.stdout.trim());
const riskQA=spawnSync(process.execPath,[join(root,"scripts/ops-risk.test.mjs")],{encoding:"utf8"});
assert.equal(riskQA.status,0,"Student risk role/privacy regression failed: "+riskQA.stderr+" "+riskQA.stdout);
console.log(riskQA.stdout.trim());
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
const courseQA=spawnSync(process.execPath,[join(root,"scripts/ops-course.test.mjs")],{encoding:"utf8"});
assert.equal(courseQA.status,0,"Course operations role/write regression failed: "+courseQA.stderr+" "+courseQA.stdout);
console.log(courseQA.stdout.trim());
const classQA=spawnSync(process.execPath,[join(root,"scripts/ops-class.test.mjs")],{encoding:"utf8"});
assert.equal(classQA.status,0,"Class scheduling role/validation regression failed: "+classQA.stderr+" "+classQA.stdout);
console.log(classQA.stdout.trim());
const attendanceQA=spawnSync(process.execPath,[join(root,"scripts/ops-attendance.test.mjs")],{encoding:"utf8"});
assert.equal(attendanceQA.status,0,"Attendance role/write confirmation regression failed: "+attendanceQA.stderr+" "+attendanceQA.stdout);
console.log(attendanceQA.stdout.trim());
const attendanceExportQA=spawnSync(process.execPath,[join(root,"scripts/ops-attendance-export.test.mjs")],{encoding:"utf8"});
assert.equal(attendanceExportQA.status,0,"Attendance export privacy/CSV regression failed: "+attendanceExportQA.stderr+" "+attendanceExportQA.stdout);
console.log(attendanceExportQA.stdout.trim());
const staffGuardsQA=spawnSync(process.execPath,[join(root,"scripts/staff-guard-migration.test.mjs")],{encoding:"utf8"});
assert.equal(staffGuardsQA.status,0,"Staff/finance archive guard regression failed: "+staffGuardsQA.stderr+" "+staffGuardsQA.stdout);
console.log(staffGuardsQA.stdout.trim());
const assignmentAuthQA=spawnSync(process.execPath,[join(root,"scripts/assignment-download-auth.test.mjs")],{encoding:"utf8"});
assert.equal(assignmentAuthQA.status,0,"Private assignment download authorization regression failed: "+assignmentAuthQA.stderr+" "+assignmentAuthQA.stdout);
console.log(assignmentAuthQA.stdout.trim());
const paymentAmountQA=spawnSync(process.execPath,[join(root,"scripts/payment-amount-integrity.test.mjs")],{encoding:"utf8"});
assert.equal(paymentAmountQA.status,0,"Payment amount integrity migration regression failed: "+paymentAmountQA.stderr+" "+paymentAmountQA.stdout);
console.log(paymentAmountQA.stdout.trim());
const enrollmentIntegrityQA=spawnSync(process.execPath,[join(root,"scripts/enrollment-financial-integrity.test.mjs")],{encoding:"utf8"});
assert.equal(enrollmentIntegrityQA.status,0,"Enrollment financial integrity regression failed: "+enrollmentIntegrityQA.stderr+" "+enrollmentIntegrityQA.stdout);
console.log(enrollmentIntegrityQA.stdout.trim());
console.log("PASS: frontend, private projections, archive role guards and PWA metadata.");
