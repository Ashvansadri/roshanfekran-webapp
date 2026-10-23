const {test,expect}=require('@playwright/test');

test('Persian and Arabic numerals are normalized before enrollment validation and submission',async({page})=>{
 const requests=[];
 await page.route('**/functions/v1/academy-gateway',async route=>{
  const payload=JSON.parse(route.request().postData()||'{}');
  let body={ok:true};
  if(payload.action==='public_registration_info'){
   body={ok:true,course:{id:'synthetic-course',title:'دوره آزمایشی',code:'SYN-1',base_fee:100000,seats_left:5},pricing:{full_amount:100000},link:{slug:'synthetic-course',installment_enabled:false},settings:{}};
  }else if(payload.action==='submit_public_registration'){
   requests.push(payload);
   body={ok:true,tracking_code:'SYNTHETIC-ONLY',status:'pending'};
  }else if(payload.action==='public_catalog'){
   body={ok:true,courses:[],settings:{}};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/#/enroll/synthetic-course',{waitUntil:'domcontentloaded'});
 const form=page.locator('#rf-enroll-submit');
 await expect(form).toBeVisible();
 await form.locator('input[name="full_name"]').fill('هنرجوی آزمایشی');
 const mobile=form.locator('input[name="mobile"]');
 const national=form.locator('input[name="national_id"]');
 await mobile.fill('009123456789');
 expect(await mobile.evaluate(el=>el.validity.patternMismatch)).toBe(true);
 await form.locator('button[type="submit"]').click();
 expect(requests).toHaveLength(0);
 await mobile.fill('۰۹۱۲۳۴۵۶۷۸۹');
 await expect(mobile).toHaveValue('09123456789');
 await national.fill('٠٠١٢٣٤٥٦٧٨');
 await expect(national).toHaveValue('0012345678');
 await form.locator('input[name="privacy"]').check();
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('.rf-enroll-success')).toContainText('SYNTHETIC-ONLY');
 expect(requests).toHaveLength(1);
 expect(requests[0].body.mobile).toBe('09123456789');
 expect(requests[0].body.national_id).toBe('0012345678');
 expect(requests[0].body.receipt_base64).toBeUndefined();
});
