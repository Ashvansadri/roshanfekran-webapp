const {test,expect}=require('@playwright/test');
// Read-only, real-deployment regression. No credentials, forms, or writes.
// This complements local mocked browser tests and prevents a false "LIVE PASS"
// based solely on successful asset downloads.
const LIVE='https://roshanfekran-next-academy.onrender.com';

const CINEMATIC_IMAGES=[
 'rf_hero_real3d.webp','rf_ai_real3d.webp','rf_crypto_real3d.webp',
 'rf_forex_real3d.webp','rf_architecture_real3d.webp'
];
test('Render serves all five self-hosted cinematic WebP assets without Floot CDN',async({request,browser})=>{
 test.setTimeout(90000);
 for(const name of CINEMATIC_IMAGES){
  const res=await request.get(LIVE+'/assets/'+name,{timeout:45000});
  expect(res.status(),name+' must be served from Render').toBe(200);
  expect(res.headers()['content-type']||'',name+' MIME').toMatch(/image\/webp/i);
  const bytes=await res.body();
  expect(bytes.length,name+' nonempty CGI').toBeGreaterThan(4096);
  expect(bytes.toString('ascii',0,4),name+' RIFF').toBe('RIFF');
  expect(bytes.toString('ascii',8,12),name+' WEBP').toBe('WEBP');
  expect(bytes.readUInt32LE(4)+8,name+' valid RIFF length').toBe(bytes.length);
 }
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const legacyAssetRequests=[];
 page.on('request',req=>{if(/floot\.app\/_cdn\//i.test(req.url()))legacyAssetRequests.push(req.url())});
 try{
  await page.goto(LIVE+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.rf-spatial-scene')).toBeVisible({timeout:25000});
  for(const room of ['0','1','2']){
   await page.locator('[data-rf-room="'+room+'"]').click();
   await expect(page.locator('.rf-spatial-scene')).toHaveAttribute('data-rf-room-active',room);
  }
  expect(legacyAssetRequests,'Homepage and rooms must not fetch legacy Floot image CDN').toEqual([]);
 }finally{await page.close()}
});

test('Render staging serves working interactive rooms and protected login screen',async({browser})=>{
 test.setTimeout(90000);
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 try{
  const home=await page.goto(LIVE+'/',{waitUntil:'domcontentloaded',timeout:45000});
  expect(home?.status(),'Render homepage HTTP status').toBe(200);
  const scene=page.locator('.rf-spatial-scene');
  await expect(scene).toBeVisible({timeout:25000});
  await page.locator('[data-rf-room="1"]').click();
  await expect(scene).toHaveAttribute('data-rf-room-active','1');
  await expect(scene.locator('.rf-spatial-title')).toHaveText('آزمایشگاه بلاکچین');
  await page.locator('[data-rf-room="2"]').click();
  await expect(scene).toHaveAttribute('data-rf-room-active','2');
  await expect(scene.locator('.rf-spatial-title')).toHaveText('اتاق تحلیل بازار');
  // Hash-only SPA navigation does not issue an HTTP request: Playwright returns null.
  // Verify the URL and rendered form instead of asserting a nonexistent response status.
  await page.goto(LIVE+'/#/access',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page).toHaveURL(LIVE+'/#/access');
  await expect(page.locator('#rf-login input[name="email"]')).toBeVisible({timeout:15000});
  await expect(page.locator('#rf-login input[name="password"]')).toBeVisible();
  // Read-only end-to-end diagnostic: no email, password, or personal data.
  await page.getByRole('button',{name:/بررسی اتصال ورود/}).click();
  await expect(page.locator('.portal-success')).toContainText('سرویس احراز هویت در دسترس‌اند',{timeout:15000});
  expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#rf-login')).toBeVisible({timeout:15000});
  await expect(page.locator('.rf-dashboard')).toHaveCount(0);
  expect(failures,'Uncaught browser JavaScript errors').toEqual([]);
 }finally{await page.close()}
});


test('Gateway rejects anonymous, forged and path-confused access without disclosing data',async({request})=>{
 test.setTimeout(120000);
 const END='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
 const check=async(body,authorization,allowed)=>{
  const headers={'Content-Type':'application/json'};
  if(authorization)headers.Authorization='Bearer '+authorization;
  const res=await request.post(END,{headers,data:body,timeout:30000});
  expect(allowed,'HTTP '+res.status()+' for '+body.action).toContain(res.status());
  expect(res.headers()['cache-control']||'').toContain('no-store');
  const json=await res.json();
  expect(json?.access_token,'No tokens in denied responses').toBeFalsy();
  expect(json?.refresh_token,'No refresh token in denied responses').toBeFalsy();
  return json;
 };
 const anonymousRole=await check({action:'resolve_portal'},null,[401]);
 expect(anonymousRole.error).toBe('AUTH_REQUIRED');
 await check({action:'proxy',path:'/rest/v1/academy_students?select=id&limit=1',method:'GET'},null,[401]);
 await check({action:'resolve_portal'},'invalid-test-jwt',[401]);
 await check({action:'proxy',path:'/rest/v1/academy_students/../../auth/v1/admin/users',method:'GET'},'invalid-test-jwt',[403]);
 await check({action:'proxy',path:'/auth/v1/token?grant_type=refresh_token',method:'POST',body:{refresh_token:'invalid-test-refresh-token'}},null,[400,401,403,429]);
});

test('Expired synthetic session is removed on definitive refresh rejection',async({browser})=>{
 test.setTimeout(90000);
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 await page.addInitScript(()=>{
  sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
   access_token:'synthetic-expired-access-token',
   refresh_token:'synthetic-expired-refresh-token',
   expires_at:Date.now()-60000
  }));
 });
 await page.route('**/functions/v1/academy-gateway',async route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='proxy'&&body.path==='/auth/v1/token?grant_type=refresh_token'){
   await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'invalid_grant'})});
  }else await route.continue();
 });
 try{
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#rf-login')).toBeVisible({timeout:20000});
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
  await expect(page.locator('.rf-dashboard')).toHaveCount(0);
 }finally{await page.close()}
});
