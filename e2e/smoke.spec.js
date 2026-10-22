const {test,expect}=require('@playwright/test');
const mockCatalog={
 ok:true,
 courses:[{id:'course-1009',title:'هوش مصنوعی کاربردی',code:'course-1009',slug:'course-1009',teacher_name:'مدرس دوره',base_fee:1500000,start_date:'2026-11-20',session_count:12,installment_enabled:true,installment_markup_percent:5,installment_max_count:3,installment_total:1575000}],
 settings:{academy_name:'آموزشگاه روشنفکران',phone:'09164880996'}
};
async function apiMock(page,authRole=null){
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
  else if(authRole&&payload.action==='resolve_portal'){result={kind:authRole};code=200}
  else if(authRole&&payload.action==='proxy'){
   const path=String(payload.path||'');
   if(path.includes('/rpc/academy_student_journey_snapshot'))result={student_name:'هنرجوی آزمایشی',stages:[],percentage:25,missions_approved:0};
   else if(path.includes('/rpc/academy_parent_journey_snapshot'))result={children:[]};
   else if(path.includes('/rpc/academy_family_tip_today'))result={day_no:1,title:'تمرین امروز',explanation:'گفت‌وگو',exercise:'پرسش کوتاه'};
   else if(path.includes('/academy_enrollments?select=id,course_id,final_fee,status'))result=[{id:'enroll-test',course_id:'course-test',final_fee:1500000,status:'active'}];
   else if(path.includes('/academy_installments?select=id,enrollment_id,installment_no,amount,paid_amount,due_date,status'))result=[{id:'inst-test',enrollment_id:'enroll-test',installment_no:1,amount:525000,paid_amount:100000,due_date:'2026-11-20',status:'partial'}];
   else if(path.includes('/academy_payments?select=id,enrollment_id,installment_id,amount,paid_at,status'))result=[{id:'payment-test',enrollment_id:'enroll-test',amount:100000,paid_at:'2026-10-20',status:'verified'}];
   else result=[];
   code=200;
  }
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
 const overflow=await page.evaluate(()=>({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+2||r.left< -2)}).slice(0,15).map(el=>el.tagName+'.'+String(el.className||'').replace(/\\s+/g,'.'))}));
 expect(overflow.scrollWidth,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width+2);
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
 const overflow=await page.evaluate(()=>({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>window.innerWidth+2||r.left< -2)}).slice(0,15).map(el=>el.tagName+'.'+String(el.className||'').replace(/\\s+/g,'.'))}));
 expect(overflow.scrollWidth,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width+2);
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

test('role-specific route aliases require authentication',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await apiMock(page);
 for(const route of ['portal','parent','teacher','manage']){
  await page.goto('/#/'+route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#rf-login')).toBeVisible();
  await expect(page.locator('#app')).not.toContainText('درخواست‌های ثبت‌نام اخیر');
  await expect(page.locator('#app')).not.toContainText('پیشرفت فرزند');
 }
 await page.close();
});

test('student sees synthetic RLS-scoped read-only finance summary',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await apiMock(page,'student');
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'test-student',refresh_token:'test-refresh',expires_at:Date.now()+3600000})));
 await page.goto('/#/portal',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'وضعیت مالی و اقساط'})).toBeVisible();
 await expect(page.locator('.rf-finance-readonly')).toContainText('قسط ۱');
 await expect(page.locator('.rf-finance-readonly')).toContainText('فقط برای هنرجوی واردشده');
 await expect(page.locator('.rf-finance-readonly')).not.toContainText('کد ملی');
 await page.close();
});
test('guardian has no student finance summary',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await apiMock(page,'guardian');
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'test-guardian',refresh_token:'test-refresh',expires_at:Date.now()+3600000})));
 await page.goto('/#/parent',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'فضای خانواده'})).toBeVisible();
 await expect(page.locator('.rf-finance-readonly')).toHaveCount(0);
 await page.close();
});
