const {test,expect}=require('@playwright/test');

const endpoint='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const token='11111111-1111-4111-8111-111111111111';
const baseProfile={
 full_name:'هنرجوی آزمایشی',headline:'پروژه‌های تأییدشده',bio:'پروفایل فقط برای آزمون',
 works:[],interest_tags:'هوش مصنوعی',career_goal:'توسعه مهارت',notice:'رزومه آموزشی',
 expires_at:'2026-12-01T00:00:00Z'
};

test('revoked public resume cannot be printed from a cached preview',async({page})=>{
 let requests=0;
 await page.route(endpoint,async route=>{
  const data=JSON.parse(route.request().postData()||'{}');
  if(data.action==='public_showcase'){
   requests++;
   const authorized=requests===1;
   await route.fulfill({status:authorized?200:403,contentType:'application/json',
    body:JSON.stringify(authorized?{ok:true,profile:baseProfile}:{ok:false,error:'Consent revoked'})});
   return;
  }
  await route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.addInitScript(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++}});
 await page.goto('/#/showcase/'+token,{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'هنرجوی آزمایشی'})).toBeVisible();
 await page.locator('[data-rf-public="print"]').click();
 await expect(page.getByRole('heading',{name:'این رزومه در دسترس نیست'})).toBeVisible();
 await expect(page.locator('#app')).toContainText('چاپ متوقف شد');
 expect(requests).toBe(2);
 expect(await page.evaluate(()=>window.__printCalls)).toBe(0);
 await expect(page.locator('#app')).not.toContainText('هنرجوی آزمایشی');
});

test('public resume print uses newly authorized data, never the stale preview',async({page})=>{
 let requests=0;
 await page.route(endpoint,async route=>{
  const data=JSON.parse(route.request().postData()||'{}');
  if(data.action==='public_showcase'){
   requests++;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,profile:{...baseProfile,full_name:requests===1?'نسخه قدیمی آزمایشی':'نسخه تازه آزمایشی'}
   })});
   return;
  }
  await route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.addInitScript(()=>{
  window.__printSnapshot='';
  window.print=()=>{window.__printSnapshot=document.querySelector('#app')?.innerText||''};
 });
 await page.goto('/#/showcase/'+token,{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'نسخه قدیمی آزمایشی'})).toBeVisible();
 await page.locator('[data-rf-public="print"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__printSnapshot)).toContain('نسخه تازه آزمایشی');
 expect(requests).toBe(2);
 expect(await page.evaluate(()=>window.__printSnapshot.includes('نسخه قدیمی آزمایشی'))).toBe(false);
});
