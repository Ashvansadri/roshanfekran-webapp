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
  const login=await page.goto(LIVE+'/#/access',{waitUntil:'domcontentloaded',timeout:45000});
  expect(login?.status(),'Render login route HTTP status').toBe(200);
  await expect(page.locator('#rf-login input[name="email"]')).toBeVisible({timeout:15000});
  await expect(page.locator('#rf-login input[name="password"]')).toBeVisible();
  await page.goto(LIVE+'/#/workspace',{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('#rf-login')).toBeVisible({timeout:15000});
  await expect(page.locator('.rf-dashboard')).toHaveCount(0);
  expect(failures,'Uncaught browser JavaScript errors').toEqual([]);
 }finally{await page.close()}
});
