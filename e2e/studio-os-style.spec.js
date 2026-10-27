const {test,expect}=require('@playwright/test');
const GATE='**/functions/v1/academy-gateway';
function fake(route,data){return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})}
async function setup(page,kind){
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'synthetic-ui-token',refresh_token:'synthetic-ui-refresh',expires_at:Date.now()+3600000})));
 await page.route(GATE,route=>{
  const p=JSON.parse(route.request().postData()||'{}');
  if(p.action==='resolve_portal')return fake(route,kind==='student'?{kind:'student',role:'student'}:{kind:'staff',role:'owner'});
  if(p.action==='public_catalog')return fake(route,{courses:[],settings:{}});
  if(p.action==='public_news')return fake(route,{ai:[],markets:[],world:[]});
  if(p.action==='proxy')return fake(route,p.path?.includes('academy_student_journey_snapshot')?{student_name:'هنرجوی آزمایشی',stages:[],percentage:0,missions_approved:0}:[]);
  return fake(route,{ok:true});
 });
}
test('new spatial shell is loaded and protected workspace remains privacy scoped',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await setup(page,'staff');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-dashboard')).toBeVisible();
 await expect(page.locator('.rfov-overview')).toBeVisible();
 const styles=await page.evaluate(async()=>({loaded:[...document.styleSheets].some(s=>s.href?.includes('academy-studio-os.css')),panels:document.querySelectorAll('.rf-dashboard .rf-panel').length}));
 expect(styles.loaded).toBe(true);
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="finance"]')).toHaveCount(1);
 expect(errors).toEqual([]);
 await page.close();
});
test('mobile login stays accessible and shared studio styles do not cause overflow',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,reducedMotion:'reduce'});
 await page.route(GATE,route=>fake(route,{courses:[],settings:{}}));
 await page.goto('/#/access',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#rf-login')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
 const sheet=await page.evaluate(()=>[...document.styleSheets].some(s=>s.href?.includes('academy-studio-os.css')));
 expect(sheet).toBe(true);
 await page.close();
});
