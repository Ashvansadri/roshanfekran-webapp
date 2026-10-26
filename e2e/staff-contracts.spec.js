const {test,expect}=require('@playwright/test');
// Real Render frontend, synthetic role and contract data. No production account or file is accessed.
const LIVE='https://roshanfekran-next-academy.onrender.com';
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const active='11111111-1111-4111-8111-111111111111';
const archived='22222222-2222-4222-8222-222222222222';
const activeContract='33333333-3333-4333-8333-333333333333';
const archivedContract='44444444-4444-4444-8444-444444444444';
const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page,mode='ok',role='registrar',calls=[]){
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
  access_token:'synthetic-contract-access',refresh_token:'synthetic-contract-refresh',
  expires_at:Date.now()+3600000
 })));
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');calls.push(b);
  if(b.action==='resolve_portal')return reply(route,{kind:'staff',role});
  if(b.action==='public_catalog')return reply(route,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='proxy'){
   if(b.path.startsWith('/rest/v1/academy_students?')){
    if(mode==='students-denied')return reply(route,{message:'Forbidden'},403);
    return reply(route,[
     {id:active,full_name:'ACTIVE_STUDENT',status:'active',archived_at:null},
     {id:archived,full_name:'ARCHIVED_STUDENT',status:'archived',archived_at:'2026-10-01'}
    ]);
   }
   if(b.path.startsWith('/rest/v1/academy_student_contracts?')){
    if(mode==='contracts-denied')return reply(route,{message:'Forbidden'},403);
    return reply(route,[
     {id:activeContract,student_id:active,course_id:'55555555-5555-4555-8555-555555555555',contract_no:'ACTIVE_CONTRACT',status:'draft'},
     {id:archivedContract,student_id:archived,course_id:'55555555-5555-4555-8555-555555555555',contract_no:'ARCHIVED_CONTRACT_SECRET',status:'signed'}
    ]);
   }
   return reply(route,[]);
  }
  return reply(route,{ok:true});
 });
}
async function openContracts(page){
 await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="contracts"]')).toBeVisible({timeout:25000});
 await page.locator('.rfov-module-grid [data-rfops-tab="contracts"]').click();
 await expect(page.locator('.rfops-view-contracts')).toBeVisible();
 return page.locator('.rfops-view-contracts');
}
test('Render contract desk hides archived student contracts despite an overbroad mock projection',async({browser})=>{
 test.setTimeout(90000);
 const page=await browser.newPage({viewport:{width:1280,height:850}}),calls=[];
 try{
  await setup(page,'ok','registrar',calls);
  const desk=await openContracts(page);
  await expect(desk).toContainText('ACTIVE_CONTRACT');
  await expect(desk).not.toContainText('ARCHIVED_CONTRACT_SECRET');
  await expect(desk.locator('[data-rfops="contract-link"]')).toHaveCount(1);
  expect(calls.some(x=>x.action==='contract_file_url')).toBe(false);
 }finally{await page.close()}
});
for(const mode of ['students-denied','contracts-denied']){
 test('Render contract desk fails closed on '+mode,async({browser})=>{
  test.setTimeout(90000);
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  try{
   await setup(page,mode);
   const desk=await openContracts(page);
   await expect(desk).toContainText('برای حفظ محرمانگی');
   await expect(desk).not.toContainText('ACTIVE_CONTRACT');
   await expect(desk).not.toContainText('ARCHIVED_CONTRACT_SECRET');
   await expect(desk.locator('[data-rfops="contract-link"]')).toHaveCount(0);
  }finally{await page.close()}
 });
}
