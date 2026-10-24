const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const session={access_token:'old-synthetic-token',refresh_token:'old-synthetic-refresh',expires_at:Date.now()+3600000};
const reply=(route,status,data)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)});

test('401 on role lookup refreshes token once and retries with the replacement token',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 const calls=[];let roleChecks=0,refreshes=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),session);
 await page.route(GATEWAY,route=>{
  const req=route.request(),b=JSON.parse(req.postData()||'{}');
  calls.push({action:b.action,path:b.path||'',authorization:req.headers().authorization||''});
  if(b.action==='resolve_portal'){
   roleChecks++;
   if(roleChecks===1)return reply(route,401,{error:'JWT expired'});
   return reply(route,200,{ok:true,kind:'student',role:'student'});
  }
  if(b.action==='proxy'&&String(b.path).includes('grant_type=refresh_token')){
   refreshes++;return reply(route,200,{access_token:'renewed-synthetic-token',refresh_token:'renewed-synthetic-refresh',expires_in:3600});
  }
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))return reply(route,200,{student_name:'هنرجوی آزمایشی',stages:[],percentage:25,missions_approved:0});
  if(b.action==='proxy')return reply(route,200,[]);
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 expect(roleChecks).toBe(2);
 expect(refreshes).toBe(1);
 expect(calls.filter(x=>x.action==='resolve_portal').map(x=>x.authorization)).toEqual(['Bearer old-synthetic-token','Bearer renewed-synthetic-token']);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(saved?.access_token).toBe('renewed-synthetic-token');
 expect(saved?.refresh_token).toBe('renewed-synthetic-refresh');
 await page.close();
});

test('403 NO_ACTIVE_ROLE invalidates a previously stored session and hides the workspace',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let resolves=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),session);
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='resolve_portal'){resolves++;return reply(route,403,{error:'NO_ACTIVE_ROLE'})}
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,401,{error:'AUTH_REQUIRED'});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('نقش فعال ندارد');
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await expect(page.locator('#app')).not.toContainText('پرونده مهارتی');
 expect(resolves).toBe(1);
 await page.close();
});

test('temporary role lookup failure preserves the valid login and allows explicit retry without password',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let passwords=0,roleChecks=0;
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='proxy'&&b.path==='/auth/v1/token?grant_type=password'){
   passwords++;return reply(route,200,{access_token:'fresh-synthetic-token',refresh_token:'fresh-synthetic-refresh',expires_in:3600});
  }
  if(b.action==='resolve_portal'){
   roleChecks++;
   if(roleChecks===1)return reply(route,503,{error:'temporary backend failure'});
   return reply(route,200,{ok:true,kind:'student',role:'student'});
  }
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))
   return reply(route,200,{student_name:'هنرجوی آزمایشی',stages:[],percentage:25,missions_approved:0});
  if(b.action==='proxy')return reply(route,200,[]);
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await page.locator('#rf-login [name=email]').fill('synthetic@example.com');
 await page.locator('#rf-login [name=password]').fill('synthetic-password');
 await page.locator('#rf-login button[type=submit]').click();
 await expect(page.getByText('اتصال به پورتال برقرار نشد')).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('سرور آموزشگاه موقتاً در دسترس نیست');
 await page.waitForTimeout(300);
 expect(roleChecks).toBe(1);
 expect(passwords).toBe(1);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(saved?.access_token).toBe('fresh-synthetic-token');
 await page.getByRole('button',{name:'تلاش مجدد'}).click();
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 expect(roleChecks).toBe(2);
 expect(passwords).toBe(1);
 await page.close();
});


test('temporary refresh failure preserves the existing session and explicit retry succeeds',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let refreshes=0,roleChecks=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()-1000})),session);
 await page.route(GATEWAY,route=>{
  const req=route.request(),b=JSON.parse(req.postData()||'{}');
  if(b.action==='proxy'&&String(b.path).includes('grant_type=refresh_token')){
   refreshes++;
   if(refreshes===1)return reply(route,503,{error:'temporary gateway outage'});
   return reply(route,200,{access_token:'refreshed-synthetic-token',refresh_token:'refreshed-synthetic-refresh',expires_in:3600});
  }
  if(b.action==='resolve_portal'){roleChecks++;return reply(route,200,{ok:true,kind:'student',role:'student'})}
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))
   return reply(route,200,{student_name:'هنرجوی آزمایشی',stages:[],percentage:25,missions_approved:0});
  if(b.action==='proxy')return reply(route,200,[]);
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('سرور احراز هویت موقتاً در دسترس نیست');
 expect(refreshes).toBe(1);
 expect(roleChecks).toBe(0);
 const retained=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(retained?.refresh_token).toBe('old-synthetic-refresh');
 await page.getByRole('button',{name:'تلاش مجدد'}).click();
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 expect(refreshes).toBe(2);
 expect(roleChecks).toBe(1);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(saved?.access_token).toBe('refreshed-synthetic-token');
 await page.close();
});

test('invalid refresh credential clears stored tokens and requires login',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let refreshes=0,roleChecks=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()-1000})),session);
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='proxy'&&String(b.path).includes('grant_type=refresh_token')){
   refreshes++;return reply(route,401,{error:'invalid_grant'});
  }
  if(b.action==='resolve_portal'){roleChecks++;return reply(route,200,{ok:true,kind:'student'})}
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,401,{error:'AUTH_REQUIRED'});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 expect(refreshes).toBe(1);
 expect(roleChecks).toBe(0);
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await expect(page.locator('.rf-dashboard')).toHaveCount(0);
 await page.close();
});


test('repeated 401 after successful refresh revokes the unusable session and returns to login',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let roleChecks=0,refreshes=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),session);
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='resolve_portal'){roleChecks++;return reply(route,401,{error:'JWT expired'})}
  if(b.action==='proxy'&&String(b.path).includes('grant_type=refresh_token')){
   refreshes++;return reply(route,200,{access_token:'new-but-rejected-synthetic-token',refresh_token:'new-synthetic-refresh',expires_in:3600});
  }
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,401,{error:'AUTH_REQUIRED'});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('نشست ورود نامعتبر است');
 expect(roleChecks).toBe(2);
 expect(refreshes).toBe(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await expect(page.locator('.rf-dashboard')).toHaveCount(0);
 await page.close();
});

test('generic role 403 retains a valid session for investigation rather than deleting credentials',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let roleChecks=0,refreshes=0;
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),session);
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='resolve_portal'){roleChecks++;return reply(route,403,{error:'FORBIDDEN'})}
  if(b.action==='proxy'&&String(b.path).includes('grant_type=refresh_token')){refreshes++;return reply(route,500,{error:'unexpected refresh'})}
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,401,{error:'AUTH_REQUIRED'});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('اتصال به پورتال برقرار نشد')).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('FORBIDDEN');
 expect(roleChecks).toBe(1);
 expect(refreshes).toBe(0);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(saved?.access_token).toBe('old-synthetic-token');
 await expect(page.locator('.rf-dashboard')).toHaveCount(0);
 await page.close();
});
