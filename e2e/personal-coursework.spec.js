const {test,expect}=require('@playwright/test');
const STUDENT='33333333-3333-4333-8333-333333333333';
const COURSE='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TASK='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const due=new Date(Date.now()+86400000).toISOString();
const personal={id:TASK,student_id:STUDENT,course_id:COURSE,title:'پروژه شخصی هوش مصنوعی',instructions:'یک پروژه کوچک بسازید و توضیح دهید چگونه کار می‌کند.',due_at:due,published:true,created_at:new Date().toISOString()};
const answer=(r,obj)=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(obj)});
const setup=async(page,kind)=>{
 await page.addInitScript(()=>sessionStorage.setItem('rf_safe_session_v1',JSON.stringify({access_token:'fake-auth-for-UI-only',refresh_token:'fake-refresh',expires_at:Date.now()+3600000})));
 const writes=[];let submitted=false;
 await page.route('**/functions/v1/academy-gateway',r=>{
  const b=JSON.parse(r.request().postData()||'{}'),path=String(b.path||'');
  if(b.action==='resolve_portal')return answer(r,kind==='teacher'?{kind:'teacher',role:'teacher'}:{kind:'student',role:'student'});
  if(b.action==='public_catalog')return answer(r,{ok:true,courses:[],settings:{}});
  if(b.action==='public_news')return answer(r,{ok:true,ai:[],markets:[],world:[]});
  if(b.action==='daily_for_me')return answer(r,{ok:true,archive:[]});
  if(b.action==='push_status')return answer(r,{ok:true,identities:[]});
  if(b.action==='proxy'){
   if(path.includes('/rpc/academy_teacher_workspace_core'))return answer(r,{courses:[{id:COURSE,title:'هوش مصنوعی',code:'AI',status:'active'}],students:[{id:STUDENT,full_name:'هنرجوی آزمون'}]});
   if(path.includes('/rpc/academy_student_journey_snapshot'))return answer(r,{student_name:'هنرجوی آزمون',stages:[{done:true,title:'شناخت'},{done:false,title:'پروژه'}],percentage:10,missions_approved:0});
   if(path.startsWith('/rest/v1/academy_personal_tasks')){
    if(b.method==='POST'){writes.push(b);return answer(r,[{...personal,...b.body}])}
    return answer(r,[personal]);
   }
   if(path.startsWith('/rest/v1/academy_personal_task_submissions')){
    if(b.method==='POST'){writes.push(b);submitted=true;return answer(r,[{id:SUB,task_id:TASK,status:'submitted'}])}
    if(b.method==='PATCH'){writes.push(b);return answer(r,[{id:SUB,task_id:TASK,status:'reviewed',score:b.body.score}])}
    return answer(r,submitted?[{id:SUB,task_id:TASK,status:'submitted',submission_text:'پروژه ساختم و روش انجام آن را توضیح دادم'}]:[]);
   }
   return answer(r,[]);
  }
  return answer(r,{ok:true});
 });
 return {writes};
};
test('student sees only her assigned task and submits via authorized personal-task endpoint',async({page})=>{
 const {writes}=await setup(page,'student');page.on('dialog',d=>d.accept());
 await page.goto('/#/portal',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rf-personal-tasks')).toBeVisible({timeout:25000});
 await expect(page.locator('.rf-personal-tasks')).toContainText('پروژه شخصی هوش مصنوعی');
 await page.locator('.rf-personal-submit textarea').fill('پروژه را تکمیل کرده‌ام و نتیجه را در فایل توضیح داده‌ام.');
 await page.locator('.rf-personal-submit button[type=submit]').click();
 await expect.poll(()=>writes.filter(w=>w.method==='POST'&&w.path==='/rest/v1/academy_personal_task_submissions').length,{timeout:12000}).toBe(1);
 expect(writes[0].body.task_id).toBe(TASK);
 await expect(page.locator('.rf-personal-tasks')).toContainText('تحویل ثبت شده');
 await expect(page.locator('#rfops-personal-task')).toHaveCount(0);
});
test('teacher creates personal task only after confirmation and never publishes a course-wide assignment',async({page})=>{
 const {writes}=await setup(page,'teacher');page.on('dialog',d=>d.accept());
 await page.goto('/#/workspace',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.rfov-module-grid [data-rfops-tab="tasks"]')).toBeVisible({timeout:25000});
 await page.locator('.rfov-module-grid [data-rfops-tab="tasks"]').click();
 const form=page.locator('#rfops-personal-task');
 await expect(form).toBeVisible();
 await form.locator('select[name="course_id"]').selectOption(COURSE);
 await form.locator('select[name="student_id"]').selectOption(STUDENT);
 await form.locator('input[name="title"]').fill('تمرین اختصاصی مدل‌سازی');
 await form.locator('textarea[name="instructions"]').fill('فایل کامل پروژه را با توضیحات مراحل تحویل بده.');
 await form.locator('input[name="due_at"]').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
 await form.locator('button[type=submit]').click();
 await expect.poll(()=>writes.some(w=>w.method==='POST'&&w.path==='/rest/v1/academy_personal_tasks'),{timeout:12000}).toBe(true);
 const req=writes.find(w=>w.path==='/rest/v1/academy_personal_tasks');
 expect(req.body.student_id).toBe(STUDENT);
 expect(req.body.course_id).toBe(COURSE);
 expect(writes.some(w=>w.path==='/rest/v1/academy_assignments')).toBe(false);
});
