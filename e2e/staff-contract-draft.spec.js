const {test,expect}=require('@playwright/test');
// Staging UI verification with a synthetic account and intercepted gateway.
// No production account, contract or database record is modified.
const LIVE='https://roshanfekran-next-academy.onrender.com';
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const student='11111111-1111-4111-8111-111111111111';
const course='22222222-2222-4222-8222-222222222222';
const draft='33333333-3333-4333-8333-333333333333';
test('Render staff creates a draft only through audited RPC with explicit confirmation',async({browser})=>{
 test.setTimeout(90000);
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const calls=[];
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
  access_token:'synthetic-contract-access',refresh_token:'synthetic-contract-refresh',expires_at:Date.now()+3600000
 })));
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  calls.push(b);
  const ok=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(b.action==='resolve_portal')return ok({kind:'staff',role:'registrar'});
  if(b.action==='public_catalog')return ok({ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return ok({ok:true,ai:[],markets:[],world:[]});
  if(b.action==='proxy'){
   if(b.path==='/rest/v1/rpc/academy_create_student_contract_draft')return ok({
    ok:true,id:draft,status:'draft',student_id:b.body.p_student_id,course_id:b.body.p_course_id
   });
   if(b.path.startsWith('/rest/v1/academy_students?'))return ok([{id:student,full_name:'هنرجوی آزمایشی',status:'active',archived_at:null}]);
   if(b.path.startsWith('/rest/v1/academy_courses?'))return ok([{id:course,title:'دوره آزمایشی',status:'active'}]);
   return ok([]);
  }
  return ok({ok:true});
 });
 page.on('dialog',dialog=>dialog.accept());
 try{
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.rfov-module-grid [data-rfops-tab="contracts"]')).toBeVisible({timeout:25000});
  await page.locator('.rfov-module-grid [data-rfops-tab="contracts"]').click();
  const desk=page.locator('.rfops-view-contracts');
  await expect(desk).toBeVisible();
  await desk.locator('summary').filter({hasText:'ثبت پیش‌نویس قرارداد'}).click();
  const form=desk.locator('#rfops-contract-draft');
  await expect(form).toBeVisible();
  await form.locator('[name="student_id"]').selectOption(student);
  await form.locator('[name="course_id"]').selectOption(course);
  await form.locator('[name="contract_no"]').fill('RF-2026-TEST');
  await form.locator('[name="start_date"]').fill('2026-11-01');
  await form.locator('[name="end_date"]').fill('2026-12-01');
  await form.getByRole('button',{name:'ثبت پیش‌نویس امن'}).click();
  await expect(desk).toContainText('ثبت حسابرسی سرور',{timeout:10000});
  const writes=calls.filter(x=>x.action==='proxy'&&x.path==='/rest/v1/rpc/academy_create_student_contract_draft');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({
   p_student_id:student,p_course_id:course,p_contract_no:'RF-2026-TEST',p_start_date:'2026-11-01',p_end_date:'2026-12-01'
  });
  expect(calls.some(x=>x.action==='proxy'&&x.method==='POST'&&x.path==='/rest/v1/academy_student_contracts')).toBe(false);
 }finally{await page.close()}
});
