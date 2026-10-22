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
 await expect(page.locator('#rf26-main-title')).toContainText('خودت بسازش');
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 await expect(page.locator('.rf26-quiz-section')).toBeVisible();
 await page.locator('#rf26-quiz-live button[data-rf26-quiz="ai"]').click();
 await expect(page.locator('#rf26-quiz-live h3')).toContainText('روش');
 await page.locator('#rf26-quiz-live button[data-rf26-quiz="ai"]').click();
 await page.locator('#rf26-quiz-live button[data-rf26-quiz="ai"]').click();
 await expect(page.locator('.rf26-quiz-answer h3')).toContainText('هوش مصنوعی');
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
 await expect(page.locator('.rf26-hero h1')).toBeVisible();
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


test('motion stack honors reduced motion and preserves native scroll',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await apiMock(page);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-hero h1')).toBeVisible();
 const status=await page.evaluate(()=>window.RFMOTION?.status||null);
 expect(status).not.toBeNull();
 expect(status.reduced).toBe(true);
 expect(status.smooth).toBe(false);
 await page.goto('/#/courses',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('هوش مصنوعی کاربردی',{exact:true}).first()).toBeVisible();
 expect(errors).toEqual([]);
 await page.close();
});
test('pinned animation vendors initialize or safely fall back',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await apiMock(page);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 const result=await page.evaluate(()=>({
  status:window.RFMOTION?.status||null,
  globals:{gsap:!!window.gsap,ScrollTrigger:!!window.ScrollTrigger,Lenis:!!window.Lenis},
  libraryScripts:Array.from(document.scripts).filter(s=>/gsap|lenis/.test(s.src)).map(s=>s.src),
  scrollHeight:document.documentElement.scrollHeight,
  windowHeight:window.innerHeight,
 }));
 expect(result.status).not.toBeNull();
 expect(result.libraryScripts.length).toBe(3);
 if(result.globals.gsap&&result.globals.ScrollTrigger)expect(result.status.gsap).toBe(true);
 else expect(result.status.gsap).toBe(false);
 if(!result.globals.Lenis)expect(result.status.smooth).toBe(false);
 console.log('RF_LIBRARIES',JSON.stringify(result));
 expect(errors).toEqual([]);
 await page.close();
});

test('new 360px landing design and discovery quiz stay readable and interactive',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:360,height:780},isMobile:true,deviceScaleFactor:1});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf26-main-title')).toBeVisible();
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 await expect(page.locator('.rf26-faq-list details')).toHaveCount(5);
 for(let i=0;i<3;i++)await page.locator('#rf26-quiz-live button[data-rf26-quiz="crypto"]').click();
 await expect(page.locator('.rf26-quiz-answer h3')).toContainText('فناوری مالی');
 await expect(page.locator('#rf26-quiz-live')).toContainText('پاسخ‌ها ذخیره یا به سرور ارسال نمی‌شوند');
 const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(dims.scroll,JSON.stringify(dims)).toBeLessThanOrEqual(dims.viewport+2);
 await page.screenshot({path:testInfo.outputPath('mobile-360-new-homepage.png'),fullPage:true});
 expect(errors).toEqual([]);
 await page.close();
});
test('real catalog creates exactly one public course card without invented reviews',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-course')).toHaveCount(1);
 await expect(page.locator('.rf26-course-guide')).toHaveCount(1);
 await expect(page.locator('.rf26-course h3')).toContainText('هوش مصنوعی کاربردی');
 await expect(page.locator('.rf26-course a[href="#/course/course-1009"]')).toBeVisible();
 await expect(page.locator('.rf26-dashboard')).toContainText('نمای مفهومی');
 await expect(page.locator('blockquote')).toHaveCount(0);
 await page.locator('.rf26-faq-list details').last().locator('summary').click();
 await expect(page.locator('.rf26-faq-list details').last()).toHaveAttribute('open','');
 expect(errors).toEqual([]);
 await page.close();
});
test('anonymous path finder collects no personal information or extra API calls',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1120,height:900}});
 const requests=[];
 await page.route('https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway',route=>{
  const body=JSON.parse(route.request().postData()||'{}');requests.push(body.action);
  if(body.action==='public_catalog')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockCatalog)});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ai:[],markets:[],world:[]})});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 await page.waitForTimeout(250);
 const before=requests.length;
 for(let i=0;i<3;i++)await page.locator('#rf26-quiz-live button[data-rf26-quiz="ai"]').click();
 await expect(page.locator('.rf26-quiz-answer')).toBeVisible();
 expect(requests.length).toBe(before);
 await page.locator('[data-rf26-quiz="restart"]').click();
 await expect(page.locator('#rf26-quiz-live h3')).toContainText('چه چیزی بسازی');
 await page.close();
});
test('conversion homepage works even when GSAP and Lenis CDN scripts are blocked',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1024,height:800}});
 await apiMock(page);
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 await expect(page.locator('#rf26-main-title')).toBeVisible();
 await page.locator('#rf26-quiz-live button[data-rf26-quiz="forex"]').click();
 await expect(page.locator('#rf26-quiz-live h3')).toContainText('روش');
 expect(errors).toEqual([]);
 await page.close();
});

test('premium unified sign-in remains accessible on narrow mobile',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 const login=page.locator('#rf-login');
 await expect(login).toBeVisible();
 await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
 const design=await page.locator('.rf-auth-card').evaluate(el=>({radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderColor}));
 expect(design.radius).toBe('5px');
 expect(design.border).not.toBe('rgba(0, 0, 0, 0)');
 const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport+2);
 await page.screenshot({path:testInfo.outputPath('mobile-portal-signin-premium.png'),fullPage:true});
 expect(errors).toEqual([]);
 await page.close();
});
test('student dashboard keeps premium panel styling without private data leaks',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await apiMock(page,'student');
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'synthetic-student',refresh_token:'test-refresh',expires_at:Date.now()+3600000})));
 await page.goto('/#/portal',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 const panel=page.locator('.rf-panel').first();
 await expect(panel).toBeVisible();
 expect(await panel.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('5px');
 const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(overflow.scroll).toBeLessThanOrEqual(overflow.viewport+2);
 await page.close();
});

test('photorealistic assets are used in live home and all course worlds',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await apiMock(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 const photos=await page.evaluate(()=>{
 const root=document.querySelector('.rf26-home');
 const hero=getComputedStyle(document.querySelector('.rf26-stage'),'::before').backgroundImage;
 const worlds=[...document.querySelectorAll('.rf26-track-visual')].map(el=>getComputedStyle(el).backgroundImage);
 return {hero,worlds,allHaveRealAssets:worlds.every(x=>x.includes('real3d.webp'))};
 });
 expect(photos.hero).toContain('rf_hero_real3d.webp');
 expect(photos.allHaveRealAssets).toBe(true);
 expect(errors).toEqual([]);
 await page.close();
});

test('cinematic images load successfully over the public CDN',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await apiMock(page);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const urls=['rf_hero_real3d.webp','rf_ai_real3d.webp','rf_crypto_real3d.webp','rf_forex_real3d.webp'];
  return await Promise.all(urls.map(async name=>{
   const src='https://roshanfekran-academy-control.floot.app/_cdn/static/'+name;
   return await new Promise(resolve=>{
    const img=new Image(); const timeout=setTimeout(()=>resolve({name,ok:false,reason:'timeout'}),12000);
    img.onload=()=>{clearTimeout(timeout);resolve({name,ok:img.naturalWidth>50,w:img.naturalWidth})};
    img.onerror=()=>{clearTimeout(timeout);resolve({name,ok:false,reason:'image-error'})};
    img.src=src;
   });
  }));
 });
 expect(result.every(x=>x.ok),JSON.stringify(result)).toBe(true);
 await page.close();
});
