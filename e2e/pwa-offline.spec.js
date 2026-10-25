const {test,expect}=require('@playwright/test');

test('installed PWA retains all public scenes and scripts offline without caching private data',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow',viewport:{width:1100,height:820}});
 const page=await context.newPage();
 await page.route('https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway',route=>
  route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,courses:[],settings:{},ai:[],markets:[],world:[]})})
 );
 await page.goto('/',{waitUntil:'load'});
 await page.evaluate(async()=>{
  // The production page auto-registers on HTTPS; local HTTP CI explicitly registers.
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Service worker did not control the page')),12000);
   navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true});
  });
 });
 const paths=await page.evaluate(async()=>{
  const names=(await caches.keys()).filter(name=>name.startsWith('rf-academy-public-'));
  if(names.length!==1)throw Error('Expected exactly one active public shell cache');
  const cache=await caches.open(names[0]);
  return (await cache.keys()).map(request=>new URL(request.url).pathname);
 });
 for(const asset of ['/index.html','/homepage.js','/academy-ops.js','/daily-admin.js','/daily-admin.css','/portal-premium.css',
   '/assets/rf_hero_real3d.webp','/assets/rf_ai_real3d.webp','/assets/rf_crypto_real3d.webp','/assets/rf_forex_real3d.webp'])
  expect(paths,asset+' must be precached').toContain(asset);
 expect(paths.every(path=>!path.startsWith('/_api/')&&!path.startsWith('/auth/'))).toBe(true);
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf26-main-title')).toBeVisible();
 await expect(page.locator('.rf26-track')).toHaveCount(3);
 expect(await page.evaluate(()=>typeof window.RFHOMEPAGE?.render)).toBe('function');
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 await context.close();
});
