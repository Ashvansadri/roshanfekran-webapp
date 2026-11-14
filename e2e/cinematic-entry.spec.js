const {test,expect}=require('@playwright/test');
test('academy cinematic home uses actual Roshanfekran identity and related visual tracks',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:1487,height:1058},reducedMotion:'reduce'});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveTitle('آموزشگاه روشنفکران | آینده را بساز');
 await expect(page.locator('.brand-name')).toContainText('روشنفکران');
 await expect(page.locator('.headline')).toContainText('مهارت امروز');
 await expect(page.locator('.plate .scene-image')).toHaveCount(3);
 await expect(page.locator('[data-scene-choice]')).toHaveCount(3);
 await expect(page.locator('a[href="/academy.html#/courses"]').first()).toBeVisible();
 const dimensions=await page.evaluate(()=>{
  const r=document.querySelector('.headline').getBoundingClientRect();
  return {headlineVisible:r.width>0&&r.height>0,main:!!document.querySelector('.hero'),otherPortal:!!document.querySelector('#app'),
    externalScripts:document.querySelectorAll('script[src]').length,bodyOverflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(dimensions.headlineVisible).toBe(true);expect(dimensions.main).toBe(true);
 expect(dimensions.otherPortal).toBe(false);expect(dimensions.externalScripts).toBe(0);
 expect(dimensions.bodyOverflow).toBeLessThanOrEqual(4);
 const titles=['مهارت امروز','فناوری را بشناس','نمودارها را بخوان'];
 for(const [i,key] of ['ai','crypto','market'].entries()){
  await page.locator('[data-scene-choice="'+key+'"]').click();
  await expect(page.locator('.stage')).toHaveAttribute('data-active',key);
  await expect(page.locator('[data-scene-choice="'+key+'"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.headline')).toContainText(titles[i]);
  await expect.poll(async()=>Number(await page.locator('.scene-image[data-scene="'+key+'"]').evaluate(el=>getComputedStyle(el).opacity)),{timeout:3000}).toBeGreaterThan(.9);
 }
 await page.screenshot({path:testInfo.outputPath('academy-cinematic-desktop.png'),fullPage:false});
 await page.getByRole('link',{name:'سؤالات متداول'}).first().click();
 await expect(page.locator('#faqDialog')).toBeVisible();
 await page.locator('#faqClose').click();
 await expect(page.locator('#faqDialog')).toBeHidden();
 await page.close();
});
test('academy cinematic mobile menu, category switching and legacy portal links work',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.brand-name')).toBeVisible();
 const burger=page.locator('#burger');
 await expect(burger).toBeVisible();await burger.click();
 await expect(burger).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');
 await expect(burger).toHaveAttribute('aria-expanded','false');
 await page.locator('[data-scene-choice="crypto"]').click();
 await expect(page.locator('.headline')).toContainText('فناوری را بشناس');
 await page.locator('[data-scene-choice="market"]').click();
 await expect(page.locator('.headline')).toContainText('نمودارها را بخوان');
 await page.screenshot({path:testInfo.outputPath('academy-cinematic-mobile.png'),fullPage:false});
 await burger.click();
 await page.locator('#menu a[href="/academy.html#/portals"]').first().click();
 await expect(page).toHaveURL(/academy\.html#\/portals$/);
 await page.goto('/index.html#/access',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/academy\.html#\/access$/);
 await page.close();
});
