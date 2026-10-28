const {test,expect}=require('@playwright/test');
const gateway='**/functions/v1/academy-gateway';
test('real 3D worlds initialize with unique scenes and maintain fallback assets',async({page})=>{
 await page.route(gateway,route=>{
  const b=JSON.parse(route.request().postData()||'{}');
  const data=b.action==='public_catalog'?{courses:[],settings:{}}:b.action==='public_news'?{ai:[],markets:[],world:[]}:{ok:true};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-cinema-scene')).toHaveCount(3);
 await expect(page.locator('.rf-cinema-world-nav button')).toHaveCount(3);
 await expect(page.locator('#rf26-main-title')).toContainText('آینده را بساز');
 await page.waitForFunction(()=>window.RFIMMERSIVE&&(window.RFIMMERSIVE.loaded||window.RFIMMERSIVE.fallbacks>0),null,{timeout:25000});
 const runtime=await page.evaluate(()=>({loaded:window.RFIMMERSIVE.loaded,contexts:window.RFIMMERSIVE.contexts,fallbacks:window.RFIMMERSIVE.fallbacks,status:document.querySelector('.rf-cinema-ai')?.dataset.rf3dStatus}));
 expect(runtime.loaded,'Real 3D renderer did not initialize: '+JSON.stringify(runtime)).toBe(true);
 expect(runtime.contexts).toBeGreaterThan(0);
 expect(runtime.status).toBe('live');
 await expect(page.locator('.rf-cinema-photo')).toHaveCount(3);
 await page.locator('[data-rf-jump-scene="1"]').click();
 await expect(page.locator('.rf-cinema-chain')).toBeInViewport({ratio:.15});
 expect(errors).toEqual([]);
});
test('reduced motion and small viewports retain text and avoid overflow without WebGL',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf26-main-title')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
 await page.close();
});
