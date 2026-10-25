const {test,expect}=require('@playwright/test');
const URL='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
function send(route,json,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)})}
async function publicRoute(page){
 const actions=[];
 await page.route(URL,route=>{
  const b=JSON.parse(route.request().postData()||'{}');actions.push(b);
  if(b.action==='guardian_phone_request')return send(route,{ok:true,requested:true});
  if(b.action==='guardian_phone_verify')return send(route,{access_token:'guardian-test',refresh_token:'test-refresh',expires_in:3600});
  if(b.action==='resolve_portal')return send(route,{ok:true,kind:'guardian',role:'guardian'});
  if(b.action==='proxy'){
   if(String(b.path||'').includes('academy_parent_journey_snapshot'))return send(route,{children:[]});
   if(String(b.path||'').includes('academy_parent_portal_snapshot'))return send(route,{students:[]});
   if(String(b.path||'').includes('academy_family_tip_today'))return send(route,{day_no:1,title:'تمرین',explanation:'پیشرفت'});
   return send(route,[]);
  }
  if(b.action==='daily_public')return send(route,{ok:true,today:null,archive:[]});
  if(b.action==='public_catalog')return send(route,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return send(route,{ok:true,ai:[],markets:[],world:[]});
  return send(route,{error:'AUTH_REQUIRED'},401);
 });
 return actions;
}
test('guardian enters mobile and OTP, then sees own family dashboard, never email',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 const requests=await publicRoute(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'ورود به پورتال'})).toBeVisible();
 const sms=page.locator('#rf-phone-request');
 await expect(sms).toBeVisible();
 await sms.locator('[name=phone]').fill('۰۹۱۲۱۲۳۴۵۶۷');
 await sms.getByRole('button',{name:/دریافت کد/}).click();
 await expect(page.locator('#rf-phone-verify')).toBeVisible();
 expect(requests.some(x=>x.action==='guardian_phone_request'&&x.phone==='09121234567')).toBe(true);
 await page.locator('#rf-phone-verify [name="otp"]').fill('۱۲۳۴۵۶');
 await page.locator('#rf-phone-verify button[type="submit"]').click();
 await expect(page.locator('.rf-family-monitor')).toBeVisible();
 expect(requests.some(x=>x.action==='guardian_phone_verify'&&x.otp==='123456')).toBe(true);
 expect(errors).toEqual([]);
 await page.close();
});
test('staff sees phone-only legal-guardian invite, without email dependency',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 await publicRoute(page);
 await page.route(URL,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='resolve_portal')return send(route,{ok:true,kind:'staff',role:'owner'});
  if(b.action==='proxy')return send(route,[]);
  return send(route,{ok:true,courses:[],settings:{}});
 });
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'admin-test',refresh_token:'ref',expires_at:Date.now()+3600000})));
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rfops-main')).toBeVisible();
 await expect(page.locator('#rf-invite-guardian')).toHaveCount(0);
 await expect(page.locator('.rf-guardian-onboarding')).toContainText('بدون نیاز به ایمیل');
 await page.locator('[data-rfops-tab="family"]').click();
 const form=page.locator('#rfops-invite-guardian');
 await expect(form.locator('[name="mobile"]')).toHaveAttribute('required','');
 await expect(form.locator('[name="email"]')).toHaveCount(0);
 await expect(form).toContainText('نسبت');
 await page.close();
});
test('new studio typography and image sources do not reuse cropped screenshot webps',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await publicRoute(page);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 const resources=await page.evaluate(()=>[...document.querySelectorAll('.rf26-track .rf26-track-visual')].map(x=>getComputedStyle(x).backgroundImage));
 expect(resources.length).toBe(3);
 expect(resources.every(x=>x.includes('images.unsplash.com'))).toBe(true);
 expect(resources.every(x=>!x.includes('rf_')&&!x.includes('floot.app'))).toBe(true);
 const x=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
 expect(x.s).toBeLessThanOrEqual(x.w+2);
 await page.close();
});
