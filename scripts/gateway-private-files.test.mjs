import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../supabase/functions/academy-gateway/index.ts",import.meta.url),"utf8");
const helper=source.match(/function validPaymentReceiptKey\(key:string\)\{[\s\S]*?\n\}/)?.[0];
assert(helper,"Canonical receipt key validator missing");
const validate=runInNewContext(helper.replace("(key:string)","(key)")+";validPaymentReceiptKey");
const student="11111111-1111-4111-8111-111111111111",file="22222222-2222-4222-8222-222222222222";
for(const ext of ["pdf","jpg","webp","png"])assert(validate(student+"/"+file+"."+ext));
for(const path of [student+"/../"+file+".pdf",student+"/%2e%2e/"+file+".pdf",student+"/"+file+".svg",student+"/"+file+".pdf?x=1",student+"/"+file+".pdf/../"+file+".pdf",student+"/other/extra.pdf",student+"//"+file+".pdf",student+"/"+file+".pdf#fragment","https://example.com/"+file+".pdf"])assert(!validate(path),"Unsafe path accepted: "+path);
const receipt=source.split("if(b.action==='payment_receipt_url'){")[1]?.split("if(b.action==='self_registration_info'){")[0];
assert(receipt?.includes("validPaymentReceiptKey(key)"));
assert(receipt.includes("key.split('/')[0]!==st.id"));
assert(!receipt.includes("key.startsWith(st.id+'/')"));
assert(!source.includes("if(b.action==='student_assignment_upload'||b.action==='assignment_file_upload')"));
const legacy=source.split("if(b.action==='student_assignment_upload'){")[1]?.split("if(b.action==='student_document_upload'){")[0];
assert(legacy?.includes("/rest/v1/rpc/academy_submit_assignment_with_file"));
assert(legacy.includes("},token)"));
assert(legacy.includes("await uploadObject('academy-student-documents'"));
assert(legacy.includes("'/storage/v1/object/academy-student-documents/'+key,'DELETE'"));
assert(!/svc\('\/rest\/v1\/academy_assignment_submissions/.test(legacy));
console.log("PASS: receipt path traversal and legacy assignment RLS");


// Contract access must not rely on broad legacy staff RLS alone. This guard
// executes before any object upload or signed download and fails closed.
const contractUpload=source.split("if(b.action==='student_contract_upload'){")[1]?.split("if(b.action==='contract_file_url'){")[0];
const contractRead=source.split("if(b.action==='contract_file_url'){")[1]?.split("if(b.action==='admin_reset_password'){")[0];
assert(contractUpload?.includes("await activeContractStudent(token,student_id)"));
assert(contractUpload.indexOf("await activeContractStudent")<contractUpload.indexOf("await uploadObject"),"Student must be checked before uploading bytes");
assert(contractRead?.includes("await activeContractStudent(token,String(rows[0].student_id||''))"));
assert(contractRead.indexOf("await activeContractStudent")<contractRead.indexOf("await signedObject"),"Student must be checked before signing private URL");
assert(contractRead.includes("id,student_id,file_path,file_name,mime_type"),"Read projection must include the owner student ID");
const guardSource=source.match(/async function activeContractStudent\(token:string,studentId:string\)\{[\s\S]*?\n\}/)?.[0];
assert(guardSource,"Active contract student guard missing");
function guardFor(rows){
 const ctx={
  jo:async x=>x,
  supa:async(path,method,_body,token)=>{
   assert.equal(method,"GET");assert.equal(token,"synthetic-authorized-staff-token");
   assert(path.includes("status=eq.active")&&path.includes("archived_at=is.null"),"DB query must filter active records");
   return rows;
  },
  gatewayHttpError:(status,message)=>Object.assign(new Error(message),{status}),
  encodeURIComponent
 };
 return runInNewContext(guardSource.replace("(token:string,studentId:string)","(token,studentId)")+";activeContractStudent",ctx);
}
const validStudent={id:student,status:"active",archived_at:null};
assert.equal((await guardFor([validStudent])("synthetic-authorized-staff-token",student)).id,student);
for(const invalidRows of [
 [],[{...validStudent,status:"archived"}],[{...validStudent,archived_at:"2026-10-01"}],
 [{...validStudent,id:file}],[validStudent,validStudent]
]){
 await assert.rejects(guardFor(invalidRows)("synthetic-authorized-staff-token",student),e=>e.status===403);
}
await assert.rejects(guardFor([validStudent])("synthetic-authorized-staff-token","../"),e=>e.status===400);
console.log("PASS: archived/missing/mismatched student contracts cannot be uploaded or signed");
