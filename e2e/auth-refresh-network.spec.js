const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const reply=(route,status,data)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)});

test('network failure while refreshing preserves the session and a retry recovers without password',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:800}});
 let refreshes=0,roleChecks=0,passwordRequests=0;
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({
  access_token:'expired-synthetic-token',refresh_token:'synthetic-refresh',expires_at:Date.now()-1000
 })));
 await page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  if(b.action==='proxy'&&b.path==='/auth/v1/token?grant_type=refresh_token'){
   refreshes++;
   if(refreshes===1)return route.abort('failed');
   return reply(route,200,{access_token:'fresh-synthetic-token',refresh_token:'fresh-synthetic-refresh',expires_in:3600});
  }
  if(b.action==='proxy'&&b.path==='/auth/v1/token?grant_type=password'){
   passwordRequests++;return reply(route,400,{error:'unexpected password login'});
  }
  if(b.action==='resolve_portal'){
   roleChecks++;return reply(route,200,{ok:true,kind:'student',role:'student'});
  }
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))
   return reply(route,200,{student_name:'هنرجوی آزمایشی',stages:[],percentage:25,missions_approved:0});
  if(b.action==='proxy')return reply(route,200,[]);
  if(b.action==='public_catalog')return reply(route,200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(route,200,{ok:true,ai:[],markets:[],world:[]});
  return reply(route,200,{ok:true});
 });
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('ارتباط با سرویس ورود برقرار نشد');
 await expect(page.getByRole('button',{name:'تلاش مجدد'})).toBeVisible();
 const retained=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(retained?.refresh_token).toBe('synthetic-refresh');
 expect(roleChecks).toBe(0);
 await page.getByRole('button',{name:'تلاش مجدد'}).click();
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 expect(refreshes).toBe(2);
 expect(roleChecks).toBe(1);
 expect(passwordRequests).toBe(0);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rf_safe_session_v1')||'null'));
 expect(saved?.access_token).toBe('fresh-synthetic-token');
 await page.close();
});
