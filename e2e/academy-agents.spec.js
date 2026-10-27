const {test,expect}=require('@playwright/test');
test('assignment helper generates an editable draft only and never sends a publish request',async({page})=>{
 const writes=[];await page.route('**/functions/v1/academy-gateway',r=>{const body=JSON.parse(r.request().postData()||'{}');if(body.action==='proxy'&&body.method==='POST'&&String(body.path||'').includes('academy_assignments'))writes.push(body);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({courses:[],settings:{}})})});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>window.RFASSIGNMENT.buildDraft({courseTitle:'هوش مصنوعی',skill:'پرامپت‌نویسی',level:'beginner'}));
 expect(result.title).toContain('پرامپت‌نویسی');
 expect(result.instructions).toContain('معیار ارزیابی');
 expect(writes).toHaveLength(0);
});
test('audit report tab is restricted in source and uses minimum fields',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{const s=await(await fetch('/academy-ops.js')).text();return {manager:s.includes('["report","گزارش رویدادهای امروز",manage()]'),query:s.includes('select=entity_type,action,created_at'),limit:s.includes('limit=201')}});
 expect(result).toEqual({manager:true,query:true,limit:true});
});
