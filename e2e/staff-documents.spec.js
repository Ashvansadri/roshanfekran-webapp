const {test,expect}=require('@playwright/test');
// Real Render UI with mocked Auth/data: no real login, no records changed.
const LIVE='https://roshanfekran-next-academy.onrender.com';
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const student='11111111-1111-4111-8111-111111111111';
const archived='22222222-2222-4222-8222-222222222222';
const doc='33333333-3333-4333-8333-333333333333';
const hidden='44444444-4444-4444-8444-444444444444';
const reply=(route,data)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page,role='registrar',calls=[]){
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
  access_token:'synthetic-doc-access',refresh_token:'synthetic-doc-refresh',expires_at:Date.now()+3600000
 })));
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');calls.push(b);
  if(b.action==='resolve_portal')return reply(route,{kind:'staff',role});
  if(b.action==='public_catalog')return reply(route,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='student_document_url')return reply(route,{ok:true,url:'https://sdsdzktsqpahpdrgmzuo.supabase.co/storage/v1/object/sign/academy-student-documents/a.pdf?token=synthetic'});
  if(b.action==='proxy'){
   if(b.path==='/rest/v1/rpc/academy_review_student_document')
    return reply(route,{ok:true,id:b.body.p_document_id,status:b.body.p_status});
   if(b.path.startsWith('/rest/v1/academy_students?'))return reply(route,[
    {id:student,full_name:'ACTIVE_STUDENT',status:'active',archived_at:null},
    {id:archived,full_name:'ARCHIVED_STUDENT',status:'archived',archived_at:'2026-10-01'}
   ]);
   if(b.path.startsWith('/rest/v1/academy_student_documents?'))return reply(route,[
    {id:doc,student_id:student,title:'ACTIVE_DOCUMENT',status:'pending',file_name:'sample.pdf'},
    {id:hidden,student_id:archived,title:'PRIVATE_ARCHIVED_DOCUMENT',status:'pending',file_name:'secret.pdf'}
   ]);
   return reply(route,[]);
  }
  return reply(route,{ok:true});
 });
}
test('Render staff document desk isolates archived files and uses signed link plus audited RPC',async({browser})=>{
 test.setTimeout(90000);
 const page=await browser.newPage({viewport:{width:1280,height:850}}),calls=[];
 try{
  await setup(page,'registrar',calls);
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.rfov-module-grid [data-rfops-tab="documents"]')).toBeVisible({timeout:25000});
  await page.locator('.rfov-module-grid [data-rfops-tab="documents"]').click();
  const desk=page.locator('.rfops-view-documents');
  await expect(desk).toContainText('ACTIVE_DOCUMENT');
  await expect(desk).not.toContainText('PRIVATE_ARCHIVED_DOCUMENT');
  await expect(desk.locator('[data-rfops-form="document-review"]')).toHaveCount(1);
  await desk.locator('[data-rfops="document-link"]').click();
  await expect(desk.getByRole('link',{name:/بازکردن فایل خصوصی/})).toBeVisible();
  const anchor=desk.getByRole('link',{name:/بازکردن فایل خصوصی/});
  expect(await anchor.getAttribute('rel')).toContain('noopener');
  await desk.locator('details summary').click();
  await desk.locator('select[name="status"]').selectOption('approved');
  await desk.locator('textarea[name="review_note"]').fill('بررسی و تأیید شد');
  page.on('dialog',d=>d.accept());
  await desk.locator('button[type="submit"]').click();
  await expect.poll(()=>calls.filter(x=>x.path==='/rest/v1/rpc/academy_review_student_document').length).toBe(1);
  expect(calls.some(x=>x.method==='PATCH'&&x.path?.includes('academy_student_documents'))).toBe(false);
 }finally{await page.close()}
});
test('Render finance account has no access to student document desk',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}}),calls=[];
 try{
  await setup(page,'finance',calls);
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.rfov-overview')).toBeVisible({timeout:25000});
  await expect(page.locator('[data-rfops-tab="documents"]')).toHaveCount(0);
  expect(calls.some(x=>x.path?.includes('academy_student_documents'))).toBe(false);
 }finally{await page.close()}
});
