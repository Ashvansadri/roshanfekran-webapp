const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const reply=(route,status,data)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)});

test('credentialless login diagnostic reports Auth reachability without sending account data',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 const seen=[];
 await page.route(GATEWAY,route=>{
  const req=route.request(),body=JSON.parse(req.postData()||'{}');
  if(body.action==='auth_preflight'){
   seen.push({body,authorization:req.headers().authorization||''});
   return reply(route,200,{ok:true,auth:'reachable'});
  }
  if(body.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(body.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 await page.getByRole('button',{name:/بررسی اتصال ورود/}).click();
 await expect(page.locator('.portal-success')).toContainText('سرویس احراز هویت در دسترس‌اند');
 expect(seen).toHaveLength(1);
 expect(seen[0].body).toEqual({action:'auth_preflight'});
 expect(seen[0].authorization).toBe('');
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await page.close();
});

test('credentialless diagnostic fails closed when Auth is unavailable',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let checks=0;
 await page.route(GATEWAY,route=>{
  const body=JSON.parse(route.request().postData()||'{}');
  if(body.action==='auth_preflight'){checks++;return reply(route,503,{error:'AUTH_UNAVAILABLE'});}
  if(body.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(body.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/بررسی اتصال ورود/}).click();
 await expect(page.locator('.portal-alert')).toContainText('سرور آموزشگاه موقتاً در دسترس نیست');
 expect(checks).toBe(1);
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await page.close();
});
