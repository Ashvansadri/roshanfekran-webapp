import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../supabase/functions/academy-gateway/index.ts",import.meta.url),"utf8");
const marker="  if(b.action==='assignment_file_url'){";
const start=source.indexOf(marker),end=source.indexOf("  if(b.action==='payment_receipt_upload'){",start);
assert(start>=0&&end>start,"Missing unified assignment file action");
assert.equal(source.indexOf(marker,start+marker.length),-1,"Duplicate unreachable action is forbidden");
const block=source.slice(start,end);
const ids={submission:"11111111-1111-4111-8111-111111111111",student:"22222222-2222-4222-8222-222222222222",assignment:"33333333-3333-4333-8333-333333333333",course:"44444444-4444-4444-8444-444444444444",file:"55555555-5555-4555-8555-555555555555",teacher:"66666666-6666-4666-8666-666666666666",other:"77777777-7777-4777-8777-777777777777"};
const oldPath=ids.student+"/"+ids.assignment+"/"+ids.file+".pdf";
const newPath=ids.student+"/assignments/"+ids.assignment+"/"+ids.file+".pdf";
const cases=[
 ["teacher assigned legacy","teacher",ids.teacher,ids.teacher,"active",null,oldPath,true,"academy-assignment-submissions"],
 ["teacher assigned modern","teacher",ids.teacher,ids.teacher,"active",null,newPath,true,"academy-student-documents"],
 ["teacher other course","teacher",ids.teacher,ids.other,"active",null,newPath,false],
 ["teacher archived course","teacher",ids.teacher,ids.teacher,"archived",null,newPath,false],
 ["teacher dated archive","teacher",ids.teacher,ids.teacher,"active","2026-10-01",newPath,false],
 ["student own",null,ids.student,ids.teacher,"active",null,newPath,true,"academy-student-documents"],
 ["student other",null,ids.other,ids.teacher,"active",null,newPath,false],
 ["finance denied","finance",ids.other,ids.teacher,"active",null,newPath,false],
 ["manager allowed","manager",ids.other,ids.teacher,"active",null,newPath,true,"academy-student-documents"],
 ["owner allowed","owner",ids.other,ids.teacher,"active",null,oldPath,true,"academy-assignment-submissions"],
 ["invalid file prefix","owner",ids.other,ids.teacher,"active",null,"elsewhere/"+ids.file+".pdf",false]
];
for(const [name,role,userId,assignedId,status,archivedAt,filePath,allowed,expectedBucket] of cases){
 let signed=0,bucketUsed="",queries=[];
 const svc=async path=>{queries.push(path);return {path}};
 const jo=async({path})=>{
  if(path.includes("/academy_assignment_submissions?"))return [{id:ids.submission,assignment_id:ids.assignment,student_id:ids.student,file_path:filePath,file_name:"work.pdf",mime_type:"application/pdf"}];
  if(path.includes("/academy_assignments?"))return [{id:ids.assignment,course_id:ids.course}];
  if(path.includes("/academy_courses?"))return assignedId===userId&&status!=="archived"&&!archivedAt?[{id:ids.course,teacher_user_id:assignedId,status,archived_at:null}]:[];
  throw Error("Unexpected query "+path);
 };
 const run=new Function("bt","currentUser","currentRole","svc","jo","studentByUser","signedObject","jr","return async function run(b,req){"+block+"throw Error('no action');}")(req=>"synthetic-token",async()=>({id:userId}),async()=>role,svc,jo,async()=>userId===ids.student?{id:ids.student}:null,async(bucket,path)=>{signed++;bucketUsed=bucket;return "https://example.invalid/"+bucket+"/"+path},x=>x);
 const invoke=()=>run({action:"assignment_file_url",submission_id:ids.submission},{});
 if(allowed){const res=await invoke();assert.equal(res.ok,true,name);assert.equal(signed,1,name);assert.equal(bucketUsed,expectedBucket,name)}
 else{await assert.rejects(invoke(),/Not authorized|مسیر فایل معتبر نیست/,name);assert.equal(signed,0,name)}
 if(role==="teacher")assert(queries.some(p=>p.includes("teacher_user_id=eq."+userId)&&p.includes("archived_at=is.null")),name+" must verify exact active course");
}
console.log("PASS: 11 private assignment download scenarios, teacher isolation, owner/student permissions and both storage buckets.");
