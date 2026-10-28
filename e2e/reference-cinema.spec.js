const {test,expect}=require('@playwright/test');
const gateway='**/functions/v1/academy-gateway';
async function mock(page){
 await page.route(gateway,route=>{
  let b={};try{b=JSON.parse(route.request().postData()||'{}')}catch{}
  const data=b.action==='public_catalog'?{courses:[],settings:{}}:b.action==='public_news'?{ai:[],markets:[],world:[]}:{ok:true};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
}
test('desktop landing has three interactive WebGL worlds with local image fallbacks',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await mock(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-cinema-scene')).toHaveCount(3);
 await expect(page.locator('#rf26-main-title')).toContainText('آینده را بساز');
 await expect(page.locator('.rf-cinema-scene img')).toHaveCount(3);
 const ready=await page.locator('.rf-cinema-scene img').evaluateAll(imgs=>imgs.map(x=>({loaded:x.complete&&x.naturalWidth>100,src:new URL(x.src).pathname,height:x.getBoundingClientRect().height})));
 expect(ready[0].loaded,JSON.stringify(ready)).toBe(true); // Other worlds stay lazy-loaded until selected.
 expect(ready.map(x=>x.src)).toEqual(['/assets/rf_ai_real3d.webp','/assets/rf_crypto_real3d.webp','/assets/rf_forex_real3d.webp']);
 expect(ready[0].height).toBeGreaterThan(500);
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 await page.screenshot({path:testInfo.outputPath('cinema-desktop.png'),fullPage:false});
 expect(errors).toEqual([]);
 await page.close();
});
test('mobile cinematic page remains navigable without horizontal overflow and supports reduced motion',async({browser},testInfo)=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await mock(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-cinema-scene')).toHaveCount(3);
 await expect(page.locator('.rf-cinema-ai .rf26-btn-glow')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
 expect(await page.locator('.rf-cinema-photo').first().evaluate(x=>getComputedStyle(x).transitionDuration)).toBe('0s');
 await page.getByRole('button',{name:/کشف مسیر یادگیری/}).click();
 await expect(page.locator('#rf26-discover')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('cinema-mobile.png'),fullPage:false});
 expect(errors).toEqual([]);
 await page.close();
});
