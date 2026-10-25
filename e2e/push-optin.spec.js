const {test,expect}=require('@playwright/test');
const END='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
function setup(page,{fail=false}={}){
 const calls=[];
 page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'synthetic-student',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000})));
 page.route(END,route=>{
  const b=JSON.parse(route.request().postData()||'{}');calls.push(b.action);
  const send=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(b.action==='resolve_portal')return send(200,{ok:true,kind:'student',role:'student'});
  if(b.action==='push_config')return send(200,{ok:true,available:false,public_key:null});
  if(b.action==='push_status')return fail?send(403,{error:'Not authorized'}):send(200,{ok:true,identities:[]});
  if(b.action==='daily_for_me')return send(200,{ok:true,today:[],latest:null,archive:[],streak:0,completed_count:0});
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))return send(200,{student_name:'هنرجوی تست',stages:[],percentage:0,missions_approved:0});
  if(b.action==='proxy')return send(200,[]);
  if(b.action==='public_catalog')return send(200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return send(200,{ok:true,ai:[],markets:[],world:[]});
  return send(200,{ok:true});
 });return calls;
}
test('Push opt-in remains disabled without VAPID; no subscription sent',async({browser})=>{
 const page=await browser.newPage();const calls=setup(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const panel=page.locator('.rf-push-panel');
 await expect(panel).toBeVisible();
 await expect(panel).toContainText('VAPID');
 await expect(panel.locator('[data-rf=push-enable]')).toBeDisabled();
 expect(calls).toContain('push_config');expect(calls).toContain('push_status');
 expect(calls).not.toContain('push_save');
 await page.locator('[data-rf=logout]').first().click();
 await expect(panel).toHaveCount(0);
 await page.close();
});
test('Push authorization failure fails closed',async({browser})=>{
 const page=await browser.newPage();const calls=setup(page,{fail:true});
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const panel=page.locator('.rf-push-panel');
 await expect(panel).toBeVisible();
 await expect(panel.locator('[data-rf=push-enable]')).toBeDisabled();
 await expect(panel).toContainText('وضعیت امن اشتراک');
 expect(calls).not.toContain('push_save');
 await page.close();
});
