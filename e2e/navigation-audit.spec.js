const {test,expect}=require('@playwright/test');
const gateway='**/functions/v1/academy-gateway';
async function mockPublic(page){
 await page.route(gateway,route=>{
  let b={};try{b=JSON.parse(route.request().postData()||'{}')}catch{}
  const data=b.action==='public_catalog'?{ok:true,courses:[],settings:{}}:
   b.action==='public_news'?{ok:true,ai:[],markets:[],world:[]}:b.action==='daily_public'?{ok:true,today:null,latest:null}:{ok:true};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
}
test('all public navigation routes open correctly on mobile and desktop',async({browser})=>{
 for(const width of [390,1365]){
  const page=await browser.newPage({viewport:{width,height:830},isMobile:width===390,reducedMotion:'reduce'});
  await mockPublic(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  for(const route of ['/#/','/#/courses','/#/updates','/#/about','/#/portals','/#/access']){
   await page.goto(route,{waitUntil:'domcontentloaded'});
   await expect(page.locator('#app main').first()).toBeVisible();
   await expect(page.locator('#app')).not.toContainText('این صفحه پیدا نشد');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow,route+' viewport '+width).toBeLessThanOrEqual(3);
  }
  expect(errors,'page errors at '+width).toEqual([]);
  await page.close();
 }
});
test('public home CTAs, 3D selectors, course navigation and installation remain clickable',async({page})=>{
 await mockPublic(page);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-cinema-world-nav button')).toHaveCount(3);
 await page.locator('[data-rf-jump-scene="2"]').click();
 await expect(page.locator('.rf-cinema-panels')).toHaveAttribute('data-rf-world','2');
 await page.locator('[data-rf-jump-scene="0"]').click();
 await page.locator('[data-rf-install]').click();
 await expect(page.locator('.rf-install-dialog')).toBeVisible();
 await page.locator('.rf-install-close').click();
 await page.locator('#rf-companion-toggle').click();
 await expect(page.locator('#rf-companion-panel')).toBeVisible();
 await page.locator('#rf-companion-close').click();
 await expect(page.locator('#rf-companion-panel')).toBeHidden();
 await page.locator('a[href="#/courses"]').first().click();
 await expect(page).toHaveURL(/#\/courses$/);
 await expect(page.locator('#app')).not.toContainText('این صفحه پیدا نشد');
});
test('public landing never includes developer-oriented release/privacy disclaimers',async({page})=>{
 await mockPublic(page);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const publicText=await page.locator('body').innerText();
 expect(publicText).not.toContain('طراحی نسخه مستقل');
 expect(publicText).not.toContain('حریم خصوصی هنرجویان در محیط عمومی نمایش داده نمی‌شود');
 expect(publicText).not.toContain('در دستگاه‌های فاقد WebGL');
 expect(publicText).not.toContain('نمای ساختمان واقعی آموزشگاه');
});
