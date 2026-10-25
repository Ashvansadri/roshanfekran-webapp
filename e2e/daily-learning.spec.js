const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const ID='123e4567-e89b-42d3-a456-426614174000';
const session={access_token:'synthetic-student-token',refresh_token:'synthetic-student-refresh',expires_at:Date.now()+3600000};
const tip={id:ID,publish_date:'2026-10-25',title:'تمرین واقعی امروز',body:'یک ابزار هوش مصنوعی را با رعایت حریم خصوصی بررسی کنید.',action_title:'پروژه کوچک',action_prompt:'نتیجه را در سه جمله بنویسید.',audience:'all',read:null};
function setup(page,{fail=false}={}){
 let completed=false;const marks=[];
 page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),session);
 page.route(GATEWAY,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(b.action==='resolve_portal')return reply(200,{ok:true,kind:'student',role:'student'});
  if(b.action==='daily_for_me'){
   if(fail)return reply(503,{error:'temporary daily outage'});
   const row={...tip,read:completed?{completed_at:'2026-10-25T08:00:00Z'}:null};
   return reply(200,{ok:true,date:'2026-10-25',today:[row],latest:row,archive:[row],streak:completed?1:0,completed_count:completed?1:0});
  }
  if(b.action==='daily_mark'){
   marks.push({body:b,authorization:route.request().headers().authorization});
   if(b.content_id!==ID||b.completed!==true)return reply(400,{error:'Invalid mark'});
   completed=true;return reply(200,{ok:true});
  }
  if(b.action==='proxy'&&String(b.path).includes('academy_student_journey_snapshot'))
   return reply(200,{student_name:'هنرجوی تست',stages:[],percentage:0,missions_approved:0});
  if(b.action==='proxy')return reply(200,[]);
  if(b.action==='public_catalog')return reply(200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(200,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='daily_public')return reply(200,{ok:true,today:null,latest:null,archive:[]});
  return reply(200,{ok:true});
 });
 return marks;
}
test('student daily-learning feed is private, escaped, and completion uses authenticated server action',async({browser})=>{
 const page=await browser.newPage();const marks=setup(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const panel=page.locator('.rf-daily-panel');
 await expect(panel).toBeVisible();
 await expect(panel).toContainText('تمرین واقعی امروز');
 await expect(panel).toContainText('پروژه کوچک');
 await panel.getByRole('button',{name:/مطالعه و تمرین/}).click();
 await expect(panel).toContainText('این تمرین را تکمیل کرده‌اید');
 expect(marks).toHaveLength(1);
 expect(marks[0].authorization).toBe('Bearer synthetic-student-token');
 expect(marks[0].body).toMatchObject({action:'daily_mark',content_id:ID,completed:true});
 await page.locator('[data-rf="logout"]').first().click();
 await expect(page.locator('#rf-login')).toBeVisible();
 await expect(page.locator('.rf-daily-panel')).toHaveCount(0);
 expect(await page.evaluate(()=>sessionStorage.getItem('rf_safe_session_v1'))).toBeNull();
 await page.close();
});
test('daily feed failure fails closed without showing invented student content',async({browser})=>{
 const page=await browser.newPage();const marks=setup(page,{fail:true});
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const panel=page.locator('.rf-daily-panel');
 await expect(panel).toContainText('نکته‌های روز در دسترس نیستند');
 await expect(panel).not.toContainText('تمرین واقعی امروز');
 await expect(panel.locator('[data-rf="daily-complete"]')).toHaveCount(0);
 expect(marks).toHaveLength(0);
 await page.close();
});
