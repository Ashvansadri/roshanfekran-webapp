const {test,expect}=require('@playwright/test');
test('3D buttons switch a SINGLE actual rendered canvas and three visually distinct models',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.RFIMMERSIVE?.loaded&&window.RFIMMERSIVE.contexts===1,null,{timeout:25000});
 const scenes=['ai','blockchain','markets'];
 for(let i=0;i<3;i++){
  await page.locator('[data-rf-jump-scene="'+i+'"]').click();
  await expect(page.locator('.rf-cinema-panels')).toHaveAttribute('data-rf-world',String(i));
  await expect(page.locator('[data-rf-jump-scene="'+i+'"]')).toHaveAttribute('aria-pressed','true');
  const status=await page.evaluate(()=>({id:RFIMMERSIVE.sceneId,contexts:RFIMMERSIVE.contexts,canvas:document.querySelectorAll('canvas.rf-studio-viewport').length,host:document.querySelector('.rf-studio-viewport')?.parentElement?.className,frames:RFIMMERSIVE.renderedFrames}));
  expect(status.id).toBe(scenes[i]);expect(status.contexts).toBe(1);expect(status.canvas).toBe(1);
  expect(status.host).toContain(['rf-cinema-ai','rf-cinema-chain','rf-cinema-markets'][i]);
  expect(status.frames).toBeGreaterThan(i);
 }
});
test('mobile scene selector is keyboard-operable and changing worlds works with reduced motion',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-rf-jump-scene="0"]').press('ArrowLeft');
 await expect(page.locator('.rf-cinema-panels')).toHaveAttribute('data-rf-world','1');
 await expect(page.locator('.rf-cinema-chain')).toBeVisible();
 await page.locator('[data-rf-jump-scene="2"]').click();
 await expect(page.locator('.rf-cinema-markets')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(3);
 await page.close();
});
