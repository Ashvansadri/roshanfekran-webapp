const {test,expect}=require('@playwright/test');
const mockCatalog={
 ok:true,
 courses:[{id:'course-1009',title:'هوش مصنوعی کاربردی',code:'course-1009',slug:'course-1009',teacher_name:'مدرس دوره',base_fee:1500000,start_date:'2026-11-20',session_count:12,installment_enabled:true,installment_markup_percent:5,installment_max_count:3,installment_total:1575000}],
 settings:{academy_name:'آموزشگاه روشنفکران',phone:'09164880996'}
};
async function apiMock(page){
 await page.route('https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway',route=>{
  const request=route.request();
  let payload={};try{payload=JSON.parse(request.postData()||'{}')}catch{}
  let result={error:'AUTH_REQUIRED'};
  let code=401;
  if(payload.action==='public_catalog'){result=mockCatalog;code=200}
  else if(payload.action==='public_news'){result={ok:true,ai:[],markets:[],world:[]};code=200}
  else if(payload.action==='daily_public'){result={ok:true,today:null,latest:null};code=200}
  else if(payload.action==='public_registration_info'){result={ok:true,course:{id:'course-1009',code:'course-1009',title:'هوش مصنوعی کاربردی',base_fee:1500000,capacity:20,seats_left:9,session_count:12},pricing:{full_amount:1500000,installment_total:1575000},link:{slug:'course-1009',installment_enabled:true,installment_max_count:3},settings:{}};code=200}
  else if(payload.action==='public_showcase'){result={error:'لینک نامعتبر یا لغو شده'};code=404}
  return route.fulfill({status:code,contentType:'application/json; charset=utf-8',body:JSON.stringify(result)});
 });
}
test('desktop premium home is legible, safe and navigable',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:/آینده را فقط/})).toBeVisible();
 await expect(page.locator('#rf-journey-heading')).toBeVisible();
 await expect(page.locator('.rf-journey-step')).toHaveCount(4);
 await page.locator('[data-rf-journey="2"]').click();
 await expect(page.locator('[data-rf-journey="2"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#rf-journey-detail h3')).toContainText('بازخورد');
 await expect(page.getByText('هوش مصنوعی کاربردی',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('desktop-home.png'),fullPage:true});
 expect(errors).toEqual([]);
 const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
 expect(noOverflow).toBe(true);
 await page.close();
});
test('mobile navigation is usable without horizontal overflow',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,deviceScaleFactor:1});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.hero h1')).toBeVisible();
 const menu=page.locator('#mobileMenu');
 await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#mainNav')).toBeVisible();
 await page.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');
 await page.screenshot({path:testInfo.outputPath('mobile-home.png'),fullPage:true});
 const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
 expect(noOverflow).toBe(true);
 await page.goto('/#/courses',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('هوش مصنوعی کاربردی',{exact:true}).first()).toBeVisible();
 expect(errors).toEqual([]);
 await page.close();
});
test('unverified public resume never renders personal data',async({browser})=>{
 const page=await browser.newPage({viewport:{width:820,height:1180}});
 await apiMock(page);
 await page.goto('/#/showcase/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('این رزومه در دسترس نیست')).toBeVisible();
 const html=await page.locator('#app').innerText();
 expect(html).not.toContain('شماره موبایل');
 await page.close();
});
test('unauthenticated workspace cannot show private dashboard',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await apiMock(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#app')).toContainText(/ورود|ایمیل|حساب/);
 await expect(page.locator('#app')).not.toContainText('پروفایل هنرجو');
 await page.close();
});
