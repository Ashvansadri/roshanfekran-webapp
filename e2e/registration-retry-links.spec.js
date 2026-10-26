const {test,expect}=require('@playwright/test');
const gateway='**/functions/v1/academy-gateway';
const respond=(route,status,payload)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});

test('transient registration-info error offers working retry without reloading',async({page})=>{
 let attempts=0;
 await page.route(gateway,route=>{
  const {action}=JSON.parse(route.request().postData()||'{}');
  if(action==='public_registration_info'){
   attempts++;
   return attempts===1?respond(route,503,{error:'SERVICE_TEMPORARY'}):respond(route,200,{ok:true,course:{title:'آزمون رابط کاربری',code:'DEMO'},link:{},pricing:{},settings:{}});
  }
  if(action==='public_catalog')return respond(route,200,{courses:[],settings:{}});
  if(action==='public_news')return respond(route,200,{ai:[],markets:[],world:[]});
  return respond(route,200,{ok:true});
 });
 await page.goto('/#/enroll/retry-test-course',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.portal-alert')).toContainText('SERVICE_TEMPORARY');
 await page.getByRole('button',{name:'تلاش دوباره برای دریافت اطلاعات'}).click();
 await expect(page.locator('#rf-enroll-submit')).toBeVisible();
 expect(attempts).toBe(2);
});

test('corrupt percent-encoding in public course links fails safely, without a page crash',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(gateway,route=>{
  const {action}=JSON.parse(route.request().postData()||'{}');
  if(action==='public_catalog')return respond(route,200,{courses:[],settings:{}});
  if(action==='public_news')return respond(route,200,{ai:[],markets:[],world:[]});
  return respond(route,200,{ok:true});
 });
 await page.goto('/#/enroll/%E0%A4%A',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('alert')).toContainText('لینک ثبت‌نام معتبر نیست');
 await page.goto('/#/course/%E0%A4%A',{waitUntil:'domcontentloaded'});
 await expect(page.getByText('این صفحه پیدا نشد')).toBeVisible();
 expect(errors).toEqual([]);
});
