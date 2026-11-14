const {test,expect}=require('@playwright/test');
const VIDEO='https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4';
test('cinematic entry stays single-file, video-backed and faithful at 1487x1058',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1487,height:1058},reducedMotion:'reduce'});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveTitle('The Next Layer of Intelligence');
 await expect(page.locator('video.plate-video')).toHaveCount(1);
 await expect(page.locator('video.plate-video source')).toHaveAttribute('src',VIDEO);
 await expect(page.locator('.headline')).toContainText('The Next Layer');
 await expect(page.locator('.headline')).toContainText('of Intelligence');
 await expect(page.locator('.logos .lg')).toHaveCount(4);
 const layout=await page.evaluate(()=>{
  const select=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
  return {brand:select('.brand'),headline:select('.headline'),nav:select('.links'),start:select('.pill-nav'),logo:select('.lg1'),background:getComputedStyle(document.body).backgroundColor,
    hasOldPortalMarkup:!!document.getElementById('app'),externalScripts:document.querySelectorAll('script[src]').length,
    sections:document.querySelectorAll('.stage .hero').length};
 });
 expect(layout.background).toBe('rgb(5, 5, 5)');
 expect(layout.brand.x).toBeGreaterThan(73);expect(layout.brand.x).toBeLessThan(78);
 expect(layout.brand.y).toBeGreaterThan(25);expect(layout.brand.y).toBeLessThan(30);
 expect(layout.headline.y).toBeGreaterThan(225);expect(layout.headline.y).toBeLessThan(235);
 expect(layout.logo.y).toBeGreaterThan(989);expect(layout.logo.y).toBeLessThan(1003);
 expect(layout.externalScripts).toBe(0);expect(layout.hasOldPortalMarkup).toBe(false);
 expect(layout.sections).toBe(1);
 await page.close();
});
test('mobile burger, Esc, legacy deep links and academy access are operable',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const burger=page.locator('#burger');
 await expect(burger).toBeVisible();
 await burger.click();
 await expect(burger).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#menu')).toHaveAttribute('aria-hidden','false');
 await page.keyboard.press('Escape');
 await expect(burger).toHaveAttribute('aria-expanded','false');
 await burger.click();
 await page.locator('#menu a[href="/academy.html#/portals"]').click();
 await expect(page).toHaveURL(/academy\.html#\/portals$/);
 await page.goto('/index.html#/access',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/academy\.html#\/access$/);
 await page.close();
});
