const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const respond=(route,data,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)});
async function setup(page,role='registrar'){
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
  access_token:'synthetic-staff-token',refresh_token:'synthetic-refresh-token',expires_at:Date.now()+3600000
 })));
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='resolve_portal')return respond(route,{kind:'staff',role});
  if(b.action==='public_catalog')return respond(route,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return respond(route,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='proxy'){
   const p=String(b.path||'');
   if(p==='/rest/v1/rpc/academy_reply_service_request')return respond(route,{ok:true,id:b.body.p_request_id,status:b.body.p_status,priority:b.body.p_priority});
   if(p.startsWith('/rest/v1/academy_students?'))return respond(route,[
    {id:'33333333-3333-4333-8333-333333333333',full_name:'هنرجوی فعال',status:'active',archived_at:null},
    {id:'44444444-4444-4444-8444-444444444444',full_name:'هنرجوی آرشیوشده',status:'archived',archived_at:'2026-10-01'}
   ]);
   if(p.startsWith('/rest/v1/academy_student_requests?'))return respond(route,[
    {id:'11111111-1111-4111-8111-111111111111',student_id:'33333333-3333-4333-8333-333333333333',category:'certificate',subject:'درخواست گواهی',body:'متن درخواست مجاز',status:'open',created_at:'2026-10-25T10:00:00Z'},
    {id:'22222222-2222-4222-8222-222222222222',student_id:'44444444-4444-4444-8444-444444444444',category:'financial',subject:'درخواست آرشیوی',body:'SECRET_ARCHIVED',status:'open'}
   ]);
   return respond(route,[]);
  }
  return respond(route,{ok:true});
 });
}
test('registrar opens the independent student service desk and sees only active student requests',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 await setup(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="serviceDesk"]')).toBeVisible({timeout:20000});
 await page.locator('.rfov-module-grid [data-rfops-tab="serviceDesk"]').click();
 await expect(page.locator('.rfops-view-serviceDesk')).toBeVisible();
 await expect(page.locator('.rfops-view-serviceDesk')).toContainText('درخواست گواهی');
 await expect(page.locator('.rfops-view-serviceDesk')).toContainText('متن درخواست مجاز');
 await expect(page.locator('.rfops-view-serviceDesk')).not.toContainText('SECRET_ARCHIVED');
 await expect(page.locator('.rfops-view-serviceDesk')).not.toContainText('درخواست آرشیوی');
 await expect(page.locator('.rfops-view-serviceDesk')).toContainText('ثبت رویداد سمت سرور');
 await expect(page.locator('.rfops-view-serviceDesk [data-rfops-form="service-reply"]')).toHaveCount(1);
 await page.close();
});
test('finance account cannot open the student services inbox',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 await setup(page,'finance');
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfov-overview')).toBeVisible({timeout:20000});
 await expect(page.locator('[data-rfops-tab="serviceDesk"]')).toHaveCount(0);
 await expect(page.locator('#rfops-main')).not.toContainText('متن درخواست مجاز');
 await page.close();
});

test('staff reply is sent only to audited RPC after confirmation',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:820}});
 await setup(page,'registrar');
 const calls=[];
 page.on('request',req=>{
  if(req.url()===GATEWAY&&req.method()==='POST'){
   try{const b=req.postDataJSON();if(b.path==='/rest/v1/rpc/academy_reply_service_request')calls.push(b)}catch{}
  }
 });
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await page.locator('.rfov-module-grid [data-rfops-tab="serviceDesk"]').click();
 const editor=page.locator('.rfops-service-editor');
 await expect(editor).toHaveCount(1);
 await editor.locator('summary').click();
 await editor.locator('select[name="status"]').selectOption('resolved');
 await editor.locator('select[name="priority"]').selectOption('high');
 await editor.locator('textarea[name="staff_note"]').fill('درخواست بررسی و پاسخ داده شد');
 await editor.locator('button[type="submit"]').click();
 await expect.poll(()=>calls.length).toBe(1);
 expect(calls[0].body).toEqual({
  p_request_id:'11111111-1111-4111-8111-111111111111',
  p_status:'resolved',p_priority:'high',p_staff_note:'درخواست بررسی و پاسخ داده شد'
 });
 await expect(page.locator('#rfops-main')).toContainText('با تأیید سرور');
 await page.close();
});
