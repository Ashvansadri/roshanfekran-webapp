const {test,expect}=require('@playwright/test');
test('student coach only appears for an authenticated student and uses authorized snapshot',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000})));
 await page.route('**/functions/v1/academy-gateway',route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  let data={ok:true,courses:[],settings:{}};
  if(b.action==='resolve_portal')data={kind:'student',role:'student'};
  if(b.action==='proxy')data=String(b.path||'').includes('academy_student_journey_snapshot')?{student_name:'هنرجوی آزمایشی',stages:[{title:'گام اول',done:true},{title:'گام دوم',done:false}],percentage:20,missions_approved:0}:[];
  if(b.action==='daily_for_me')data={ok:true,archive:[]};
  if(b.action==='push_status')data={ok:true,identities:[]};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/#/portal',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-student-coach')).toBeVisible();
 await expect(page.locator('.rf-student-coach')).toContainText('معرفی و هدف حرفه‌ای');
 await expect(page.locator('.rf-student-coach')).toContainText('این تمرین رسمی');
});
