const {test,expect}=require('@playwright/test');
const GATEWAY='https://sdsdzktsqpahpdrgmzuo.supabase.co/functions/v1/academy-gateway';
const mockSession={access_token:'visual-test-only-token',refresh_token:'visual-test-only-refresh'};
function respond(route,data,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(data)})}
async function withSyntheticStaff(page,kind='staff'){
 await page.addInitScript(s=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({...s,expires_at:Date.now()+3600000})),mockSession);
 await page.route(GATEWAY,route=>{
  let b={};try{b=JSON.parse(route.request().postData()||'{}')}catch{}
  if(b.action==='resolve_portal')return respond(route,kind==='staff'?{kind:'staff',role:'owner'}:{kind:'teacher',role:'teacher'});
  if(b.action==='public_catalog')return respond(route,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return respond(route,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='daily_public')return respond(route,{ok:true,today:null,latest:null});
  if(b.action==='proxy'){
   const p=String(b.path||'');
   if(p.includes('/rpc/academy_teacher_workspace_core'))return respond(route,{courses:[],students:[]});
   if(p.includes('/rest/v1/academy_students?'))return respond(route,[{id:'stud-1',full_name:'هنرجوی مجاز',user_id:null,status:'active',archived_at:null}]);
   if(p.includes('/rest/v1/academy_registration_requests?'))return respond(route,[{id:'reg-1',full_name:'درخواست آزمایشی',course_id:'c-1',status:'pending',submitted_at:'2026-10-25T09:00:00Z'}]);
   if(p.includes('/rest/v1/academy_courses?'))return respond(route,[{id:'c-1',title:'هوش مصنوعی',status:'active',code:'AI',teacher_name:'مدرس',capacity:10,session_count:12}]);
   return respond(route,[]);
  }
  if(b.action==='daily_admin_list'||b.action==='daily_admin_snapshot')return respond(route,{ok:true,items:[]});
  return respond(route,{ok:true,items:[]});
 });
}
test('owner dashboard shows premium overview, real mock counts and navigable operational sections',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1512,height:940}});
 await withSyntheticStaff(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const overview=page.locator('.rfov-overview');
 await expect(overview).toBeVisible({timeout:20000});
 await expect(page.locator('.rf-premium-workspace .rf-page-head')).toContainText('مرکز مدیریت روشنفکران');
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="finance"]')).toHaveCount(1);
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="students"]')).toHaveCount(1);
 await expect(page.locator('.rfov-metric-copy').filter({hasText:'پرونده‌های قابل مشاهده'})).toContainText('۱');
 const nav=page.locator('.nav-signin');
 await expect(nav).toContainText('پنل من');
 await expect(nav).toHaveAttribute('href','#/workspace');
 await page.locator('.rfov-module-grid [data-rfops-tab="finance"]').click();
 await expect(page.locator('.rfops-view-finance')).toBeVisible();
 await expect(page.locator('.rfops-tabs [data-rfops-tab="overview"]')).toBeVisible();
 await page.locator('.rfops-tabs [data-rfops-tab="overview"]').click();
 await expect(overview).toBeVisible();
 const max=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(max).toBeLessThanOrEqual(3);
 await page.close();
});
test('responsive premium dashboard fits a narrow phone and preserves route actions',async({browser})=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await withSyntheticStaff(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfov-overview')).toBeVisible({timeout:20000});
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="applications"]')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(3);
 await page.locator('.rfov-module-grid [data-rfops-tab="applications"]').click();
 await expect(page.locator('.rfops-view-applications')).toBeVisible();
 await page.close();
});
test('teacher sees only authorized work modules, not finance or private student administration',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1100,height:850}});
 await withSyntheticStaff(page,'teacher');
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfov-overview')).toBeVisible({timeout:20000});
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="finance"]')).toHaveCount(0);
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="students"]')).toHaveCount(0);
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="tasks"]')).toHaveCount(1);
 await page.close();
});

test('manager search filters only authorized navigation and opens the chosen module',async({browser})=>{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await withSyntheticStaff(page);
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 const find=page.locator('#rfops-find');
 await expect(find).toBeVisible({timeout:20000});
 await find.fill('تکالیف');
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="tasks"]')).toBeVisible();
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="finance"]')).toBeHidden();
 await find.fill('');
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="finance"]')).toBeVisible();
 await page.locator('.rfov-module-grid [data-rfops-tab="tasks"]').click();
 await expect(page.locator('.rfops-view-tasks')).toBeVisible();
 await page.close();
});
