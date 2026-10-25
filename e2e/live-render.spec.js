const {test,expect}=require('@playwright/test');
// Read-only, real-deployment regression. No credentials, forms, or writes.
// This complements local mocked browser tests and prevents a false "LIVE PASS"
// based solely on successful asset downloads.
const LIVE='https://roshanfekran-next-academy.onrender.com';
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
