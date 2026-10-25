const {test,expect}=require('@playwright/test');
const END='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const ID='123e4567-e89b-42d3-a456-426614174111',COURSE='123e4567-e89b-42d3-a456-426614174222';
function setup(page,{role='owner',deny=false}={}){
 const calls=[],items=[];
 page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'synthetic-owner',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000})));
 page.route(END,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(b.action==='resolve_portal')return reply(200,{ok:true,kind:'staff',role});
  if(b.action==='daily_admin_list'){calls.push(b);return deny?reply(403,{error:'Not authorized'}):reply(200,{ok:true,items,courses:[{id:COURSE,title:'دوره هوش مصنوعی'}],push_subscribers:0});}
  if(b.action==='daily_admin_save'){calls.push(b);const row={...b,id:b.id||ID};const i=items.findIndex(x=>x.id===row.id);if(i<0)items.push(row);else items[i]=row;return reply(200,{ok:true,record:row});}
  if(b.action==='daily_admin_archive'){calls.push(b);const x=items.find(x=>x.id===b.id);x.status='archived';return reply(200,{ok:true,record:x});}
  if(b.action==='proxy')return reply(200,[]);
  if(b.action==='public_catalog')return reply(200,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return reply(200,{ok:true,ai:[],markets:[],world:[]});
  return reply(200,{ok:true});
 });
 return calls;
}
test('owner publishes and archives content with explicit confirmation and Push opt-out',async({browser})=>{
 const page=await browser.newPage();const calls=setup(page);page.on('dialog',d=>d.accept());
 await page.goto('/#/manage',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'انتشار نکته روز'}).click();
 await expect(page.locator('#rfdaily-form')).toBeVisible();
 await page.locator('#rfdaily-form [name=title]').fill('نکته حریم خصوصی');
 await page.locator('#rfdaily-form [name=body]').fill('داده‌های محرمانه را در ابزارهای عمومی هوش مصنوعی وارد نکنید.');
 await page.locator('#rfdaily-form button[type=submit]').click();
 await expect(page.locator('.rfdaily-card')).toHaveCount(1);
 expect(calls.find(x=>x.action==='daily_admin_save')).toMatchObject({status:'draft',push_enabled:false});
 await page.locator('[data-rfdaily=edit]').click();
 await page.locator('#rfdaily-form [name=status]').selectOption('published');
 await page.locator('#rfdaily-form [name=audience]').selectOption('course');
 await page.locator('#rfdaily-form [name=course_id]').selectOption(COURSE);
 await page.locator('#rfdaily-form button[type=submit]').click();
 await expect(page.locator('.rfdaily-card [data-status=published]')).toHaveCount(1);
 expect(calls.filter(x=>x.action==='daily_admin_save')[1]).toMatchObject({id:ID,audience:'course',course_id:COURSE,status:'published'});
 await page.locator('[data-rfdaily=archive]').click();
 await expect(page.locator('.rfdaily-card [data-status=archived]')).toHaveCount(1);
 await page.locator('[data-rf=logout]').first().click();
 await expect(page.locator('.rfdaily')).toHaveCount(0);
 await page.close();
});
test('viewer has no publishing tab and makes no privileged request',async({browser})=>{
 const page=await browser.newPage();const calls=setup(page,{role:'viewer'});
 await page.goto('/#/manage',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfops-tabs')).toBeVisible();
 await expect(page.getByRole('button',{name:'انتشار نکته روز'})).toHaveCount(0);
 expect(calls.filter(x=>x.action==='daily_admin_list')).toHaveLength(0);
 await page.close();
});
test('403 management feed fails closed',async({browser})=>{
 const page=await browser.newPage();setup(page,{deny:true});
 await page.goto('/#/manage',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'انتشار نکته روز'}).click();
 await expect(page.locator('.rfdaily [role=alert]')).toContainText('دریافت نشد');
 await expect(page.locator('#rfdaily-form')).toHaveCount(0);
 await page.close();
});