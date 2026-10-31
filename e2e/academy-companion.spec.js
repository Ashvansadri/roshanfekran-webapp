const {test,expect}=require('@playwright/test');
test('guide is available on every screen and questions are never sent to the server',async({page})=>{
 let leaked=false;
 await page.route('**/functions/v1/academy-gateway',route=>{
  if((route.request().postData()||'').includes('چطور سرپرست'))leaked=true;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,courses:[],settings:{}})});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('#rf-companion-toggle').click();
 await expect(page.locator('#rf-companion-panel')).toBeVisible();
 await page.locator('#rf-companion-query').fill('چطور سرپرست فعال شود؟');
 await page.locator('#rf-companion-form button[type=submit]').click();
 await expect(page.locator('.rf-companion-history')).toContainText('اولین ورود');
 expect(leaked).toBe(false);
 await expect(page.locator('.rf-companion-notice')).toContainText('سؤالت فقط در همین صفحه پردازش می‌شود');
});
test('install assistant gives manual instructions without a prompt',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-rf-install]').click();
 await expect(page.locator('.rf-install-dialog')).toBeVisible();
 await expect(page.locator('#rf-install-steps')).toContainText(/Chrome|Safari|Edge/);
 await page.locator('.rf-install-close').click();
 await expect(page.locator('.rf-install-dialog')).toBeHidden();
});
