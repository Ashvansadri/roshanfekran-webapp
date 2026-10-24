const SUPA=Deno.env.get('SUPABASE_URL')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const JSONH={...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function jr(d:any,s=200){return new Response(JSON.stringify(d),{status:s,headers:JSONH})}
async function body(req:Request){try{return await req.json()}catch{return {}}}
async function jo(r:Response){const t=await r.text();let d:any;try{d=t?JSON.parse(t):null}catch{d={message:t}}if(!r.ok)throw new Error(d?.msg||d?.message||d?.error_description||d?.error||`HTTP ${r.status}`);return d}
function bt(req:Request){return(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()}
async function supa(path:string,method='GET',b:any=null,token='',prefer='return=representation'){
 const h:any={apikey:ANON,'Content-Type':'application/json',Authorization:'Bearer '+(token||ANON)};
 if(path.startsWith('/rest/v1/'))h.Prefer=prefer;
 return fetch(SUPA+path,{method,headers:h,body:b===null||b===undefined?undefined:JSON.stringify(b)});
}
async function svc(path:string,method='POST',b:any=null,prefer='return=representation'){
 const h:any={apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json',Prefer:prefer};
 return fetch(SUPA+path,{method,headers:h,body:b===null||b===undefined?undefined:JSON.stringify(b)});
}
async function svcRaw(path:string,method:string,bytes:Uint8Array,mime:string){
 return fetch(SUPA+path,{method,headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':mime,'x-upsert':'true'},body:bytes});
}
async function findUser(email:string){const x=await jo(await svc('/auth/v1/admin/users?page=1&per_page=1000','GET',null));const arr=x?.users||[];return arr.find((u:any)=>String(u.email||'').toLowerCase()===email)||null}
async function ensureUser(email:string,password:string,full_name:string){
 if(await findUser(email))throw new Error('حساب از قبل وجود دارد؛ رمز قبلی را تغییر نمی‌دهیم. با رمز همان حساب وارد شوید.');
 return jo(await svc('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{full_name}}));
}
async function invitationSignature(kind:string,email:string,target:string,expiry:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SERVICE),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=new TextEncoder().encode('RF_INVITE_V1|'+kind+'|'+email.toLowerCase().trim()+'|'+target+'|'+new Date(expiry).toISOString());
 const mac=await crypto.subtle.sign('HMAC',key,data);
 return [...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function verifyInvite(code:string,kind:string,email:string,target:string,expiry:string){
 if(!/^[a-f0-9]{64}$/.test(code))throw new Error('کد فعال‌سازی امن لازم است؛ لینک جدید را از مدیریت دریافت کنید.');
 const expected=await invitationSignature(kind,email,target,expiry);
 let diff=0;for(let i=0;i<64;i++)diff|=code.charCodeAt(i)^expected.charCodeAt(i);
 if(diff)throw new Error('لینک فعال‌سازی نامعتبر است.');
}
async function invitedAccount(email:string,password:string,name:string){
 const existing=await findUser(email);
 if(existing){
  let session:any;try{session=await jo(await supa('/auth/v1/token?grant_type=password','POST',{email,password}))}catch{throw new Error('این ایمیل حساب دارد؛ رمز همان حساب را وارد کنید.')}
  const checked=await currentUser(session.access_token);
  if(checked?.id!==existing.id||String(checked?.email||'').toLowerCase()!==email)throw new Error('مالکیت حساب تأیید نشد.');
  return {user:existing,session};
 }
 const user=await ensureUser(email,password,name);
 const session=await jo(await supa('/auth/v1/token?grant_type=password','POST',{email,password}));
 return {user,session};
}
async function currentUser(token:string){if(!token)throw new Error('ابتدا وارد حساب کاربری شوید');return jo(await supa('/auth/v1/user','GET',null,token))}
async function currentRole(token:string,userId:string){const rows=await jo(await supa('/rest/v1/academy_staff?select=role,active&user_id=eq.'+encodeURIComponent(userId)+'&active=eq.true&archived_at=is.null','GET',null,token));return Array.isArray(rows)&&rows.length?rows[0].role:null}
async function studentByUser(userId:string){
 const rows=await jo(await svc('/rest/v1/academy_students?select=id,user_id,full_name,email,portal_enabled,avatar_url,status,archived_at&user_id=eq.'+encodeURIComponent(userId)+'&limit=1','GET',null));
 const student=Array.isArray(rows)&&rows.length?rows[0]:null;
 if(student&&(student.status==='archived'||student.archived_at!==null&&student.archived_at!==undefined))throw new Error('حساب هنرجو آرشیو شده است');
 return student;
}
async function guardianByUser(userId:string){const rows=await jo(await svc('/rest/v1/academy_guardians?select=id,user_id,full_name,email,mobile,active&user_id=eq.'+encodeURIComponent(userId)+'&active=eq.true&limit=1','GET',null));return Array.isArray(rows)&&rows.length?rows[0]:null}
async function sha256(v:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('')}

function mimeExt(mime:string){return mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/webp'?'webp':mime==='application/pdf'?'pdf':''}
function decodeBase64(data:string,max:number){const clean=String(data||'').replace(/^data:[^;]+;base64,/,'');if(!clean||clean.length>Math.ceil(max*4/3)+32)throw new Error('حجم فایل بیشتر از حد مجاز است');let raw='';try{raw=atob(clean)}catch{throw new Error('فایل معتبر نیست')}if(raw.length>max)throw new Error('حجم فایل بیشتر از حد مجاز است');return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function uploadObject(bucket:string,key:string,bytes:Uint8Array,mime:string){const r=await svcRaw('/storage/v1/object/'+bucket+'/'+key,'POST',bytes,mime);await jo(r);return key}
async function signedObject(bucket:string,key:string,seconds=600){
 const d=await jo(await svc('/storage/v1/object/sign/'+bucket+'/'+key,'POST',{expiresIn:seconds}));
 const p=String(d?.signedURL||d?.signedUrl||d?.signed_url||'');
 if(!p)throw new Error('ساخت لینک امن فایل ناموفق بود');
 if(/^https?:\/\//i.test(p))return p;
 if(p.startsWith('/storage/v1/'))return SUPA+p;
 if(p.startsWith('/object/'))return SUPA+'/storage/v1'+p;
 return SUPA+'/storage/v1/'+p.replace(/^\/+/, '');
}
function publicLinkLocator(b:any){
 const slug=String(b.slug||'').trim().toLowerCase();
 if(slug){
  if(slug.length<3||slug.length>60||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error('نام لینک ثبت‌نام معتبر نیست');
  return 'slug=eq.'+encodeURIComponent(slug);
 }
 const public_token=String(b.token||'').trim();
 if(!/^[a-f0-9]{20,32}$/i.test(public_token))throw new Error('لینک ثبت‌نام معتبر نیست');
 return 'public_token=eq.'+encodeURIComponent(public_token);
}

function allowedProxy(path:string,method:string,token:string){
 if((path==='/auth/v1/token?grant_type=password'||path==='/auth/v1/token?grant_type=refresh_token')&&method==='POST')return true;
 if(!token)return false;
 if(path==='/auth/v1/user'&&method==='GET')return true;
 if(!path.startsWith('/rest/v1/'))return false;
 if(!['GET','POST','PATCH'].includes(method))return false;
 if(path.includes('/academy_staff_invites')||path.includes('/academy_student_invites')||path.includes('/academy_guardian_invites'))return false;
 if(path.includes('/rpc/academy_bootstrap_')||path.includes('/rpc/academy_claim_staff_invite_service'))return false;
 return true;
}

async function studentRemovalState(studentId:string){
 const rows=await jo(await svc('/rest/v1/academy_students?select=id,student_no,full_name,user_id,status,archived_at&id=eq.'+encodeURIComponent(studentId)+'&limit=1','GET',null));
 if(!Array.isArray(rows)||!rows.length)throw new Error('هنرجو پیدا نشد');
 const student=rows[0];
 const refs=[
  ['academy_assessment_scores','student_id'],['academy_assignment_submissions','student_id'],['academy_attendance','student_id'],
  ['academy_automation_jobs','student_id'],['academy_communication_log','student_id'],['academy_enrollments','student_id'],
  ['academy_followups','student_id'],['academy_guardian_students','student_id'],['academy_leads','converted_student_id'],
  ['academy_learning_progress','student_id'],['academy_notifications','student_id'],['academy_payment_submissions','student_id'],
  ['academy_registration_requests','student_id'],['academy_self_registration_requests','student_id'],['academy_student_documents','student_id'],
  ['academy_student_invites','student_id'],['academy_student_requests','student_id'],['academy_student_rewards','student_id'],
  ['academy_student_skill_scores','student_id']
 ];
 const checks=await Promise.all(refs.map(async([table,col])=>{
  const q=await jo(await svc('/rest/v1/'+table+'?select='+col+'&'+col+'=eq.'+encodeURIComponent(studentId)+'&limit=1','GET',null));
  return [table,Array.isArray(q)&&q.length>0] as const;
 }));
 const dependencies=Object.fromEntries(checks);
 const hasDependencies=checks.some(([,v])=>v);
 return {student,dependencies,has_dependencies:hasDependencies,can_hard_delete:!hasDependencies&&!student.user_id};
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return jr({error:'فقط درخواست POST مجاز است'},405);
 const b=await body(req);
 try{
  if(b.action==='status')return jr(await jo(await svc('/rest/v1/rpc/academy_bootstrap_status','POST',{})));
  if(b.action==='bootstrap_owner'){
   const st=await jo(await svc('/rest/v1/rpc/academy_bootstrap_status','POST',{}));
   if(st?.initialized)throw new Error('سامانه قبلاً راه‌اندازی شده است');
   const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),full_name=String(b.full_name||'').trim()||'مدیر آموزشگاه';
   if(!email.includes('@')||password.length<8)throw new Error('ایمیل معتبر و رمز حداقل ۸ کاراکتری لازم است');
   const u=await ensureUser(email,password,full_name);
   await jo(await svc('/rest/v1/rpc/academy_bootstrap_owner_service','POST',{p_user_id:u.id,p_full_name:full_name}));
   return jr(await jo(await supa('/auth/v1/token?grant_type=password','POST',{email,password})));
  }
  if(b.action==='invite_activation_link'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   const kind=String(b.kind||'staff'),email=String(b.email||'').trim().toLowerCase();
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   if(kind==='staff'&&!['owner','manager'].includes(String(role||'')))throw new Error('Only management can issue staff invitation links');
   if(!['staff','student','guardian'].includes(kind)||!email.includes('@'))throw new Error('Invalid invitation');
   const table=kind==='staff'?'academy_staff_invites':kind==='student'?'academy_student_invites':'academy_guardian_invites';
   const cols=kind==='staff'?'email,role,expires_at':kind==='student'?'email,student_id,expires_at':'email,guardian_id,expires_at';
   const rows=await jo(await svc('/rest/v1/'+table+'?select='+cols+'&email=eq.'+encodeURIComponent(email)+'&used_at=is.null&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1','GET',null));
   if(!Array.isArray(rows)||!rows.length)throw new Error('دعوت معتبر یافت نشد.');
   const x=rows[0],target=String(kind==='staff'?x.role:kind==='student'?x.student_id:x.guardian_id);
   const code=await invitationSignature(kind,email,target,x.expires_at);
   return jr({ok:true,activation_path:'/activate?kind='+kind+'&email='+encodeURIComponent(email)+'&code='+code,expires_at:x.expires_at});
  }
  if(b.action==='signup_invited'){
   const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),full_name=String(b.full_name||'').trim();
   if(!email.includes('@')||password.length<8)throw new Error('ایمیل معتبر و رمز حداقل ۸ کاراکتری لازم است');
   const inv=await jo(await svc('/rest/v1/academy_staff_invites?select=email,full_name,role,expires_at,used_at,revoked_at&email=eq.'+encodeURIComponent(email)+'&used_at=is.null&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'GET',null));
   if(!Array.isArray(inv)||!inv.length)throw new Error('دعوت معتبر برای این ایمیل وجود ندارد');
   await verifyInvite(String(b.invite_token||''),'staff',email,String(inv[0].role),inv[0].expires_at);
   const {user:u,session}=await invitedAccount(email,password,full_name||inv[0].full_name||email);
   await jo(await svc('/rest/v1/rpc/academy_claim_staff_invite_service','POST',{p_user_id:u.id,p_email:email}));
   return jr(session);
  }
  if(b.action==='invite_student'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   const student_id=String(b.student_id||''),email=String(b.email||'').trim().toLowerCase();
   if(!student_id||!email.includes('@'))throw new Error('شناسه هنرجو و ایمیل معتبر لازم است');
   const rows=await jo(await svc('/rest/v1/academy_students?select=id,full_name,user_id,status,archived_at& id=eq.'.replace(' ','')+encodeURIComponent(student_id)+'&limit=1','GET',null));
   if(!Array.isArray(rows)||!rows.length)throw new Error('هنرجو پیدا نشد');
   if(rows[0].status==='archived'||rows[0].archived_at)throw new Error('هنرجوی آرشیوشده قابل دعوت نیست');
   await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(student_id),'PATCH',{email,portal_enabled:false},'return=representation'));
   const validUntil=new Date(Date.now()+14*86400000).toISOString();
   await jo(await svc('/rest/v1/academy_student_invites?on_conflict=email','POST',{email,student_id,invited_by:u.id,expires_at:validUntil,used_at:null,revoked_at:null},'resolution=merge-duplicates,return=representation'));
   return jr({ok:true,email,student_id,full_name:rows[0].full_name,expires_in_days:14,activation_path:'/portal?activate=student&email='+encodeURIComponent(email)+'&code='+await invitationSignature('student',email,student_id,validUntil)});
  }
  if(b.action==='signup_student'){
   const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   if(!email.includes('@')||password.length<8)throw new Error('ایمیل معتبر و رمز حداقل ۸ کاراکتری لازم است');
   const inv=await jo(await svc('/rest/v1/academy_student_invites?select=email,student_id,expires_at,used_at,revoked_at&email=eq.'+encodeURIComponent(email)+'&used_at=is.null&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'GET',null));
   if(!Array.isArray(inv)||!inv.length){
    try{
     const session=await jo(await supa('/auth/v1/token?grant_type=password','POST',{email,password}));
     const u=await currentUser(session.access_token);
     const linked=await studentByUser(u.id);
     if(linked&&linked.portal_enabled){try{await jo(await supa('/rest/v1/rpc/academy_seed_my_notifications','POST',{},session.access_token))}catch{}return jr(session)}
    }catch{}
    throw new Error('دعوت فعال برای این ایمیل وجود ندارد. اگر حساب قبلاً فعال شده، از گزینه «حسابم فعال است؛ ورود» استفاده کن.');
   }
   await verifyInvite(String(b.invite_token||''),'student',email,String(inv[0].student_id),inv[0].expires_at);
   const st=await jo(await svc('/rest/v1/academy_students?select=id,full_name,user_id,status,archived_at& id=eq.'.replace(' ','')+encodeURIComponent(inv[0].student_id)+'&limit=1','GET',null));
   if(!Array.isArray(st)||!st.length)throw new Error('پرونده هنرجو پیدا نشد');
   if(st[0].status==='archived'||st[0].archived_at)throw new Error('حساب هنرجوی آرشیوشده قابل فعال‌سازی نیست');
   const {user:u,session}=await invitedAccount(email,password,st[0].full_name||email);
   if(st[0].user_id&&st[0].user_id!==u.id)throw new Error('پرونده به حساب دیگری متصل است.');
   await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(st[0].id),'PATCH',{user_id:u.id,email,portal_enabled:true},'return=representation'));
   await jo(await svc('/rest/v1/academy_student_invites?email=eq.'+encodeURIComponent(email),'PATCH',{used_at:new Date().toISOString()},'return=representation'));
   try{await jo(await supa('/rest/v1/rpc/academy_seed_my_notifications','POST',{},session.access_token))}catch{}
   return jr(session);
  }
  if(b.action==='invite_guardian'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   const student_id=String(b.student_id||''),email=String(b.email||'').trim().toLowerCase(),full_name=String(b.full_name||'').trim(),mobile=String(b.mobile||'').replace(/\D/g,''),relationship=String(b.relationship||'guardian').trim()||'guardian',can_view_finance=!!b.can_view_finance;
   if(!student_id||!email.includes('@')||full_name.length<3)throw new Error('نام، ایمیل و هنرجوی معتبر لازم است');
   const students=await jo(await svc('/rest/v1/academy_students?select=id,full_name,status,archived_at&id=eq.'+encodeURIComponent(student_id)+'&limit=1','GET',null));
   if(!students?.length)throw new Error('هنرجو پیدا نشد');
   if(students[0].status==='archived'||students[0].archived_at)throw new Error('هنرجوی آرشیوشده قابل اتصال به سرپرست نیست');
   let guardians=await jo(await svc('/rest/v1/academy_guardians?select=id,email,full_name,user_id&email=eq.'+encodeURIComponent(email)+'&limit=1','GET',null));
   let g:any;
   if(guardians?.length){const rows=await jo(await svc('/rest/v1/academy_guardians?id=eq.'+encodeURIComponent(guardians[0].id),'PATCH',{full_name,mobile:mobile||null,active:true},'return=representation'));g=rows?.[0]||guardians[0]}
   else{const rows=await jo(await svc('/rest/v1/academy_guardians','POST',{full_name,email,mobile:mobile||null,active:true},'return=representation'));g=rows?.[0]}
   if(!g?.id)throw new Error('ساخت حساب ولی ناموفق بود');
   await jo(await svc('/rest/v1/academy_guardian_students?on_conflict=guardian_id,student_id','POST',{guardian_id:g.id,student_id,relationship,can_view_academic:true,can_view_attendance:true,can_view_finance,can_receive_notifications:true},'resolution=merge-duplicates,return=representation'));
   const validUntil=new Date(Date.now()+14*86400000).toISOString();
   await jo(await svc('/rest/v1/academy_guardian_invites?on_conflict=email,guardian_id','POST',{email,guardian_id:g.id,invited_by:u.id,expires_at:validUntil,used_at:null,revoked_at:null},'resolution=merge-duplicates,return=representation'));
   return jr({ok:true,guardian_id:g.id,email,student_id,student_name:students[0].full_name,activation_path:'/parent?activate=guardian&email='+encodeURIComponent(email)+'&code='+await invitationSignature('guardian',email,String(g.id),validUntil),expires_in_days:14});
  }
  if(b.action==='signup_guardian'){
   const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
   if(!email.includes('@')||password.length<8)throw new Error('ایمیل معتبر و رمز حداقل ۸ کاراکتری لازم است');
   const inv=await jo(await svc('/rest/v1/academy_guardian_invites?select=id,email,guardian_id,expires_at,used_at,revoked_at&email=eq.'+encodeURIComponent(email)+'&used_at=is.null&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&order=created_at.desc&limit=1','GET',null));
   if(!Array.isArray(inv)||!inv.length){
    try{
     const session=await jo(await supa('/auth/v1/token?grant_type=password','POST',{email,password}));
     const gu=await guardianByUser((await currentUser(session.access_token)).id);
     if(gu&&gu.active)return jr(session);
    }catch{}
    throw new Error('دعوت فعال خانواده برای این ایمیل وجود ندارد. اگر قبلاً فعال شده، از ورود استفاده کن.');
   }
   await verifyInvite(String(b.invite_token||''),'guardian',email,String(inv[0].guardian_id),inv[0].expires_at);
   const gr=await jo(await svc('/rest/v1/academy_guardians?select=id,full_name,email,user_id& id=eq.'.replace(' ','')+encodeURIComponent(inv[0].guardian_id)+'&limit=1','GET',null));
   if(!gr?.length)throw new Error('پرونده ولی/والد پیدا نشد');
   const {user:au,session}=await invitedAccount(email,password,gr[0].full_name||email);
   if(gr[0].user_id&&gr[0].user_id!==au.id)throw new Error('حساب ولی قبلاً به شخص دیگری متصل شده است.');
   await jo(await svc('/rest/v1/academy_guardians?id=eq.'+encodeURIComponent(gr[0].id),'PATCH',{user_id:au.id,email,active:true},'return=representation'));
   await jo(await svc('/rest/v1/academy_guardian_invites?id=eq.'+encodeURIComponent(inv[0].id),'PATCH',{used_at:new Date().toISOString()},'return=representation'));
   return jr(session);
  }

  if(b.action==='student_removal_preview'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('فقط مدیر مجاز به حذف یا آرشیو هنرجو است');
   const student_id=String(b.student_id||'');if(!student_id)throw new Error('شناسه هنرجو لازم است');
   return jr({ok:true,...await studentRemovalState(student_id)});
  }
  if(b.action==='student_remove'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('فقط مدیر مجاز به حذف یا آرشیو هنرجو است');
   const student_id=String(b.student_id||'');if(!student_id)throw new Error('شناسه هنرجو لازم است');
   const state=await studentRemovalState(student_id);
   if(state.can_hard_delete){
    const removed=await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(student_id),'DELETE',null,'return=representation'));
    return jr({ok:true,mode:'deleted',student:Array.isArray(removed)?removed[0]||state.student:state.student});
   }
   const archived=await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(student_id),'PATCH',{status:'archived',archived_at:new Date().toISOString(),portal_enabled:false},'return=representation'));
   return jr({ok:true,mode:'archived',student:Array.isArray(archived)?archived[0]||state.student:state.student,dependencies:state.dependencies});
  }

  if(b.action==='set_student_portal'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   const student_id=String(b.student_id||''),enabled=!!b.enabled;
   if(!student_id)throw new Error('شناسه هنرجو لازم است');
   const check=await jo(await svc('/rest/v1/academy_students?select=id,status,archived_at&id=eq.'+encodeURIComponent(student_id)+'&limit=1','GET',null));
   if(!Array.isArray(check)||!check.length)throw new Error('هنرجو پیدا نشد');
   if(check[0].status==='archived'||check[0].archived_at)throw new Error('پورتال هنرجوی آرشیوشده نباید دوباره فعال شود');
   const rows=await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(student_id),'PATCH',{portal_enabled:enabled},'return=representation'));
   return jr({ok:true,student:rows?.[0]||null});
  }
  if(b.action==='avatar_upload'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id),mime=String(b.mime||'');
   const ext=mimeExt(mime);if(!['jpg','png','webp'].includes(ext))throw new Error('فرمت تصویر باید JPG، PNG یا WEBP باشد');
   const bytes=decodeBase64(String(b.data_base64||''),1572864);
   const targetStudent=String(b.student_id||'');let url='';
   if(targetStudent){
     if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
     const st=await jo(await svc('/rest/v1/academy_students?select=id,status,archived_at& id=eq.'.replace(' ','')+encodeURIComponent(targetStudent)+'&limit=1','GET',null));if(!Array.isArray(st)||!st.length)throw new Error('هنرجو پیدا نشد');
     if(st[0].status==='archived'||st[0].archived_at)throw new Error('پرونده آرشیوشده قابل تغییر نیست');
     const key='students/'+targetStudent+'/'+crypto.randomUUID()+'.'+ext;await uploadObject('academy-avatars',key,bytes,mime);url=SUPA+'/storage/v1/object/public/academy-avatars/'+key;
     await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(targetStudent),'PATCH',{avatar_url:url},'return=representation'));
   }else{
     const st=role?null:await studentByUser(u.id);
     if(st&&!role){const key='students/'+st.id+'/'+crypto.randomUUID()+'.'+ext;await uploadObject('academy-avatars',key,bytes,mime);url=SUPA+'/storage/v1/object/public/academy-avatars/'+key;await jo(await svc('/rest/v1/academy_students?id=eq.'+encodeURIComponent(st.id),'PATCH',{avatar_url:url},'return=representation'));}
     else{if(!role)throw new Error('حساب مجاز پیدا نشد');const key='staff/'+u.id+'/'+crypto.randomUUID()+'.'+ext;await uploadObject('academy-avatars',key,bytes,mime);url=SUPA+'/storage/v1/object/public/academy-avatars/'+key;await jo(await svc('/rest/v1/academy_staff?user_id=eq.'+encodeURIComponent(u.id),'PATCH',{avatar_url:url},'return=representation'));}
   }
   return jr({ok:true,url});
  }

  if(b.action==='assignment_file_upload'){
   const token=bt(req),u=await currentUser(token),st=await studentByUser(u.id);
   if(!st||!st.portal_enabled)throw new Error('Student portal access required');
   const assignment_id=String(b.assignment_id||'');if(!assignment_id)throw new Error('شناسه تکلیف لازم است');
   const assignments=await jo(await supa('/rest/v1/academy_assignments?select=id,course_id,published&id=eq.'+encodeURIComponent(assignment_id)+'&published=eq.true&limit=1','GET',null,token));
   if(!Array.isArray(assignments)||!assignments.length)throw new Error('تکلیف معتبر پیدا نشد');
   const mime=String(b.mime||''),ext=mimeExt(mime);
   if(!['jpg','png','webp','pdf'].includes(ext))throw new Error('فرمت فایل تکلیف باید JPG، PNG، WEBP یا PDF باشد');
   const bytes=decodeBase64(String(b.data_base64||''),5242880);
   const safeName=String(b.file_name||'file.'+ext).replace(/[^a-zA-Z0-9._ -]/g,'').slice(0,120)||('file.'+ext);
   const key=st.id+'/'+assignment_id+'/'+crypto.randomUUID()+'.'+ext;
   await uploadObject('academy-assignment-submissions',key,bytes,mime);
   try{
    const out=await jo(await supa('/rest/v1/rpc/academy_submit_assignment_with_file','POST',{
      p_assignment_id:assignment_id,
      p_submission_text:String(b.submission_text||'').trim()||null,
      p_submission_url:String(b.submission_url||'').trim()||null,
      p_file_path:key,p_file_name:safeName,p_mime_type:mime
    },token));
    return jr({ok:true,path:key,file_name:safeName,record:out});
   }catch(e){
    try{await jo(await svc('/storage/v1/object/academy-assignment-submissions/'+key,'DELETE',null))}catch{}
    throw e;
   }
  }
  if(b.action==='assignment_file_url'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id),sid=String(b.submission_id||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid))throw new Error('شناسه تحویل معتبر نیست');
   const rows=await jo(await svc('/rest/v1/academy_assignment_submissions?select=id,assignment_id,student_id,file_path,file_name,mime_type&id=eq.'+encodeURIComponent(sid)+'&limit=1','GET',null));
   if(!Array.isArray(rows)||!rows.length||!rows[0].file_path)throw new Error('فایل تکلیف پیدا نشد');
   const sub=rows[0];
   if(role==='teacher'){
    // An active teacher may download only submissions for a course assigned to that exact user.
    // Service-role storage signing must never rely on a global teacher role alone.
    const assignments=await jo(await svc('/rest/v1/academy_assignments?select=id,course_id&id=eq.'+encodeURIComponent(sub.assignment_id)+'&limit=1','GET',null));
    if(!Array.isArray(assignments)||assignments.length!==1||!assignments[0].course_id)throw new Error('Not authorized');
    const courses=await jo(await svc('/rest/v1/academy_courses?select=id,teacher_user_id,status,archived_at&id=eq.'+encodeURIComponent(assignments[0].course_id)+'&teacher_user_id=eq.'+encodeURIComponent(u.id)+'&archived_at=is.null&status=neq.archived&limit=1','GET',null));
    if(!Array.isArray(courses)||courses.length!==1||courses[0].teacher_user_id!==u.id||courses[0].archived_at!==null||courses[0].status==='archived')throw new Error('Not authorized');
   }else if(!['owner','manager'].includes(String(role||''))){
    const st=await studentByUser(u.id);
    if(!st||st.id!==sub.student_id)throw new Error('Not authorized');
   }
   return jr({ok:true,url:await signedObject('academy-student-documents',sub.file_path,600),file_name:sub.file_name,mime_type:sub.mime_type});
  }
  if(b.action==='student_document_upload'){
   const token=bt(req),u=await currentUser(token),st=await studentByUser(u.id);if(!st||!st.portal_enabled)throw new Error('Student portal access required');
   const mime=String(b.mime||''),ext=mimeExt(mime);if(!['jpg','png','webp','pdf'].includes(ext))throw new Error('فرمت مدرک معتبر نیست');
   const bytes=decodeBase64(String(b.data_base64||''),5242880);
   const requirement_id=String(b.requirement_id||'')||null,title=String(b.title||'').trim()||'مدرک هنرجو',file_name=String(b.file_name||'').slice(0,180)||null;
   const key=st.id+'/'+crypto.randomUUID()+'.'+ext;await uploadObject('academy-student-documents',key,bytes,mime);
   try{
    const out=await jo(await supa('/rest/v1/rpc/academy_register_student_document','POST',{p_requirement_id:requirement_id,p_title:title,p_file_path:key,p_file_name:file_name,p_mime_type:mime},token));
    return jr({ok:true,path:key,record:out});
   }catch(e){try{await jo(await svc('/storage/v1/object/academy-student-documents/'+key,'DELETE',null))}catch{}throw e}
  }
  if(b.action==='student_document_url'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id),id=String(b.document_id||'');if(!id)throw new Error('شناسه مدرک لازم است');
   const rows=await jo(await svc('/rest/v1/academy_student_documents?select=id,student_id,file_path,file_name,mime_type,status&id=eq.'+encodeURIComponent(id)+'&limit=1','GET',null));
   if(!Array.isArray(rows)||!rows.length)throw new Error('مدرک پیدا نشد');const doc=rows[0];
   if(!['owner','manager','registrar'].includes(String(role||''))){const st=await studentByUser(u.id);if(!st||st.id!==doc.student_id)throw new Error('Not authorized');}
   return jr({ok:true,url:await signedObject('academy-student-documents',doc.file_path,600),file_name:doc.file_name,mime_type:doc.mime_type,status:doc.status});
  }
  if(b.action==='verify_certificate'){
   const code=String(b.code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<6)throw new Error('کد استعلام معتبر نیست');
   const certs=await jo(await svc('/rest/v1/academy_certificates?select=id,enrollment_id,certificate_no,status,issued_at,verification_code&verification_code=eq.'+encodeURIComponent(code)+'&status=in.(issued,delivered)&limit=1','GET',null));
   if(!Array.isArray(certs)||!certs.length)return jr({valid:false});
   const c=certs[0];
   const ens=await jo(await svc('/rest/v1/academy_enrollments?select=id,student_id,course_id,status,completed_at&id=eq.'+encodeURIComponent(c.enrollment_id)+'&limit=1','GET',null));
   if(!Array.isArray(ens)||!ens.length)return jr({valid:false});const e=ens[0];
   const [students,courses]=await Promise.all([
    jo(await svc('/rest/v1/academy_students?select=id,full_name,student_no&id=eq.'+encodeURIComponent(e.student_id)+'&limit=1','GET',null)),
    jo(await svc('/rest/v1/academy_courses?select=id,title,code,start_date,end_date&id=eq.'+encodeURIComponent(e.course_id)+'&limit=1','GET',null))
   ]);
   if(!students?.length||!courses?.length)return jr({valid:false});
   return jr({valid:true,certificate_no:c.certificate_no,verification_code:c.verification_code,status:c.status,issued_at:c.issued_at,student_name:students[0].full_name,student_no:students[0].student_no,course_title:courses[0].title,course_code:courses[0].code,course_start:courses[0].start_date,course_end:courses[0].end_date,completed_at:e.completed_at});
  }

  if(b.action==='daily_public'){
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const rows=await jo(await svc('/rest/v1/academy_daily_content?select=id,publish_date,title,body,category,action_title,action_prompt,media_url,audience,course_id,status&status=eq.published&audience=eq.all&publish_date=lte.'+encodeURIComponent(today)+'&order=publish_date.desc&limit=30','GET',null));
   const list=Array.isArray(rows)?rows:[];
   return jr({ok:true,date:today,today:list.find((x:any)=>x.publish_date===today)||null,latest:list[0]||null,archive:list.slice(0,30)});
  }
  if(b.action==='daily_for_me'){
   const token=bt(req),u=await currentUser(token),st=await studentByUser(u.id);
   if(!st||!st.portal_enabled)throw new Error('Student portal access required');
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const [content,enrollments,reads]=await Promise.all([
    jo(await svc('/rest/v1/academy_daily_content?select=id,publish_date,title,body,category,action_title,action_prompt,media_url,audience,course_id,status&status=eq.published&publish_date=lte.'+encodeURIComponent(today)+'&order=publish_date.desc&limit=90','GET',null)),
    jo(await svc('/rest/v1/academy_enrollments?select=course_id&student_id=eq.'+encodeURIComponent(st.id)+'&status=eq.active','GET',null)),
    jo(await svc('/rest/v1/academy_daily_reads?select=content_id,opened_at,completed_at,points&student_id=eq.'+encodeURIComponent(st.id)+'&order=created_at.desc&limit=180','GET',null))
   ]);
   const courseIds=new Set((Array.isArray(enrollments)?enrollments:[]).map((x:any)=>String(x.course_id)));
   const feed=(Array.isArray(content)?content:[]).filter((x:any)=>x.audience==='all'||(x.audience==='course'&&courseIds.has(String(x.course_id))));
   const readMap=Object.fromEntries((Array.isArray(reads)?reads:[]).map((x:any)=>[x.content_id,x]));
   const completedDates=new Set<string>();
   for(const x of feed){const rr=readMap[x.id];if(rr?.completed_at)completedDates.add(x.publish_date)}
   let streak=0;
   const d=new Date(today+'T12:00:00Z');
   for(let i=0;i<365;i++){const key=d.toISOString().slice(0,10);if(completedDates.has(key)){streak++;d.setUTCDate(d.getUTCDate()-1)}else if(i===0){d.setUTCDate(d.getUTCDate()-1)}else break}
   const decorated=feed.map((x:any)=>({...x,read:readMap[x.id]||null}));
   return jr({ok:true,date:today,student:{id:st.id,full_name:st.full_name},today:decorated.filter((x:any)=>x.publish_date===today),latest:decorated[0]||null,archive:decorated.slice(0,30),streak,completed_count:completedDates.size});
  }
  if(b.action==='daily_mark'){
   const token=bt(req),u=await currentUser(token),st=await studentByUser(u.id);
   if(!st||!st.portal_enabled)throw new Error('Student portal access required');
   const content_id=String(b.content_id||'');if(!content_id)throw new Error('شناسه محتوای روزانه لازم است');
   const rows=await jo(await svc('/rest/v1/academy_daily_content?select=id,audience,course_id,status&id=eq.'+encodeURIComponent(content_id)+'&status=eq.published&limit=1','GET',null));
   if(!rows?.length)throw new Error('محتوا در دسترس نیست');
   const item=rows[0];
   if(item.audience==='course'){
    const e=await jo(await svc('/rest/v1/academy_enrollments?select=id&student_id=eq.'+encodeURIComponent(st.id)+'&course_id=eq.'+encodeURIComponent(item.course_id)+'&status=eq.active&limit=1','GET',null));
    if(!e?.length)throw new Error('این محتوا متعلق به دوره شما نیست');
   }
   const complete=!!b.completed,now=new Date().toISOString();
   const payload:any={content_id,student_id:st.id,opened_at:now};
   if(complete){payload.completed_at=now;payload.points=1}
   const saved=await jo(await svc('/rest/v1/academy_daily_reads?on_conflict=content_id,student_id','POST',payload,'resolution=merge-duplicates,return=representation'));
   return jr({ok:true,record:Array.isArray(saved)?saved[0]:saved});
  }
  if(b.action==='push_save'){
   const token=bt(req),u=await currentUser(token),st=await studentByUser(u.id);
   if(!st||!st.portal_enabled)throw new Error('Student portal access required');
   const sub=b.subscription&&typeof b.subscription==='object'?b.subscription:null;
   if(!sub)throw new Error('اشتراک اعلان معتبر نیست');
   const identity=String(sub.endpoint||sub.fcmToken||sub.apnsToken||'').trim();
   if(identity.length<12||identity.length>2000)throw new Error('شناسه اعلان معتبر نیست');
   const platform=String(sub.platform||((sub.fcmToken||sub.apnsToken)?'native':'web')).slice(0,20);
   const row=await jo(await svc('/rest/v1/academy_push_subscriptions?on_conflict=identity','POST',{user_id:u.id,student_id:st.id,identity,subscription:sub,platform,active:true,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation'));
   return jr({ok:true,identity,record:Array.isArray(row)?row[0]:row});
  }
  if(b.action==='push_delete'){
   const token=bt(req),u=await currentUser(token);
   const identity=String(b.identity||'').trim();if(!identity)throw new Error('شناسه اعلان لازم است');
   await jo(await svc('/rest/v1/academy_push_subscriptions?user_id=eq.'+encodeURIComponent(u.id)+'&identity=eq.'+encodeURIComponent(identity),'DELETE',null,'return=minimal'));
   return jr({ok:true});
  }
  if(b.action==='daily_admin_list'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const [items,courses,subs]=await Promise.all([
    jo(await svc('/rest/v1/academy_daily_content?select=*&order=publish_date.desc,created_at.desc&limit=150','GET',null)),
    jo(await svc('/rest/v1/academy_courses?select=id,code,title,status&status=neq.archived&order=created_at.desc','GET',null)),
    jo(await svc('/rest/v1/academy_push_subscriptions?select=id&active=eq.true','GET',null))
   ]);
   return jr({ok:true,items:Array.isArray(items)?items:[],courses:Array.isArray(courses)?courses:[],push_subscribers:Array.isArray(subs)?subs.length:0});
  }
  if(b.action==='daily_admin_save'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const id=String(b.id||''),publish_date=String(b.publish_date||''),title=String(b.title||'').trim(),contentBody=String(b.body||'').trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(publish_date))throw new Error('تاریخ انتشار معتبر نیست');
   if(title.length<3||title.length>160)throw new Error('عنوان باید بین ۳ تا ۱۶۰ کاراکتر باشد');
   if(contentBody.length<10||contentBody.length>5000)throw new Error('متن روزانه باید بین ۱۰ تا ۵۰۰۰ کاراکتر باشد');
   const audience=String(b.audience||'all'),course_id=audience==='course'?String(b.course_id||''):null;
   if(!['all','course'].includes(audience))throw new Error('مخاطب نامعتبر است');
   if(audience==='course'&&!course_id)throw new Error('برای محتوای دوره‌ای، دوره را انتخاب کنید');
   const status=String(b.status||'draft');if(!['draft','published','archived'].includes(status))throw new Error('وضعیت نامعتبر است');
   const payload:any={
    publish_date,title,body:contentBody,category:String(b.category||'general').slice(0,40),
    action_title:String(b.action_title||'').trim().slice(0,120)||null,
    action_prompt:String(b.action_prompt||'').trim().slice(0,2000)||null,
    media_url:String(b.media_url||'').trim().slice(0,1000)||null,
    audience,course_id,status,push_enabled:b.push_enabled!==false,
    push_title:String(b.push_title||'').trim().slice(0,120)||null,
    push_body:String(b.push_body||'').trim().slice(0,240)||null,
    updated_at:new Date().toISOString()
   };
   let row;
   if(id)row=await jo(await svc('/rest/v1/academy_daily_content?id=eq.'+encodeURIComponent(id),'PATCH',payload,'return=representation'));
   else row=await jo(await svc('/rest/v1/academy_daily_content','POST',{...payload,created_by:u.id},'return=representation'));
   return jr({ok:true,record:Array.isArray(row)?row[0]:row});
  }
  if(b.action==='daily_admin_archive'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const id=String(b.id||'');if(!id)throw new Error('شناسه محتوا لازم است');
   const row=await jo(await svc('/rest/v1/academy_daily_content?id=eq.'+encodeURIComponent(id),'PATCH',{status:'archived',updated_at:new Date().toISOString()},'return=representation'));
   return jr({ok:true,record:Array.isArray(row)?row[0]:row});
  }
  if(b.action==='daily_admin_notify'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const out=await jo(await svc('/rest/v1/rpc/academy_seed_daily_learning_notifications','POST',{}));
   return jr({ok:true,result:out});
  }
  if(b.action==='daily_admin_push_batch'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const id=String(b.content_id||'');
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const q=id
    ?'/rest/v1/academy_daily_content?select=*&id=eq.'+encodeURIComponent(id)+'&status=eq.published&push_enabled=eq.true&limit=1'
    :'/rest/v1/academy_daily_content?select=*&publish_date=eq.'+encodeURIComponent(today)+'&status=eq.published&push_enabled=eq.true&order=audience.asc&limit=1';
   const tips=await jo(await svc(q,'GET',null));if(!tips?.length)throw new Error('محتوای منتشرشده و قابل اعلان پیدا نشد');
   const tip=tips[0];
   let subs=await jo(await svc('/rest/v1/academy_push_subscriptions?select=identity,student_id,subscription&active=eq.true','GET',null));
   subs=Array.isArray(subs)?subs:[];
   if(tip.audience==='course'){
    const ens=await jo(await svc('/rest/v1/academy_enrollments?select=student_id&course_id=eq.'+encodeURIComponent(tip.course_id)+'&status=eq.active','GET',null));
    const allowed=new Set((Array.isArray(ens)?ens:[]).map((x:any)=>String(x.student_id)));
    subs=subs.filter((x:any)=>allowed.has(String(x.student_id)));
   }
   return jr({ok:true,tip,subscriptions:subs.map((x:any)=>({identity:x.identity,subscription:x.subscription}))});
  }
  if(b.action==='daily_admin_push_cleanup'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const ids=(Array.isArray(b.identities)?b.identities:[]).map((x:any)=>String(x)).filter(Boolean).slice(0,100);
   for(const identity of ids){
    await jo(await svc('/rest/v1/academy_push_subscriptions?identity=eq.'+encodeURIComponent(identity),'PATCH',{active:false,updated_at:new Date().toISOString()},'return=minimal'));
   }
   return jr({ok:true,count:ids.length});
  }
  if(b.action==='daily_admin_mark_push_sent'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const id=String(b.content_id||'');if(!id)throw new Error('شناسه محتوا لازم است');
   const row=await jo(await svc('/rest/v1/academy_daily_content?id=eq.'+encodeURIComponent(id),'PATCH',{push_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()},'return=representation'));
   return jr({ok:true,record:Array.isArray(row)?row[0]:row});
  }


  if(b.action==='daily_cron_batch'){
   const secret=String(b.secret||'');if(secret.length<32)throw new Error('Not authorized');
   const verified=await jo(await svc('/rest/v1/rpc/academy_verify_daily_cron_secret','POST',{p_secret:secret}));
   if(verified!==true)throw new Error('Not authorized');
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const tips=await jo(await svc('/rest/v1/academy_daily_content?select=id,publish_date,title,body,category,audience,course_id,push_title,push_body,push_enabled,push_sent_at&status=eq.published&push_enabled=eq.true&push_sent_at=is.null&publish_date=eq.'+encodeURIComponent(today)+'&order=audience.asc','GET',null));
   const allTips=Array.isArray(tips)?tips:[];
   if(!allTips.length)return jr({ok:true,date:today,batches:[]});
   const subs=await jo(await svc('/rest/v1/academy_push_subscriptions?select=id,identity,student_id,subscription,platform&active=eq.true','GET',null));
   const activeSubs=Array.isArray(subs)?subs:[];
   const batches:any[]=[];
   for(const tip of allTips){
    let selected=activeSubs;
    if(tip.audience==='course'){
     const ens=await jo(await svc('/rest/v1/academy_enrollments?select=student_id&course_id=eq.'+encodeURIComponent(String(tip.course_id||''))+'&status=eq.active','GET',null));
     const allowed=new Set((Array.isArray(ens)?ens:[]).map((x:any)=>String(x.student_id)));
     selected=activeSubs.filter((x:any)=>allowed.has(String(x.student_id)));
    }
    batches.push({tip,subscriptions:selected.map((x:any)=>({id:x.id,identity:x.identity,subscription:x.subscription,platform:x.platform}))});
   }
   return jr({ok:true,date:today,batches});
  }
  if(b.action==='daily_cron_finalize'){
   const secret=String(b.secret||'');if(secret.length<32)throw new Error('Not authorized');
   const verified=await jo(await svc('/rest/v1/rpc/academy_verify_daily_cron_secret','POST',{p_secret:secret}));
   if(verified!==true)throw new Error('Not authorized');
   const ids=(Array.isArray(b.gone_identities)?b.gone_identities:[]).map((x:any)=>String(x)).filter(Boolean).slice(0,500);
   for(const identity of ids){
    await jo(await svc('/rest/v1/academy_push_subscriptions?identity=eq.'+encodeURIComponent(identity),'PATCH',{active:false,updated_at:new Date().toISOString()},'return=minimal'));
   }
   const contentId=String(b.content_id||'');
   const sent=Math.max(0,Number(b.sent||0));
   if(contentId&&sent>0){
    await jo(await svc('/rest/v1/academy_daily_content?id=eq.'+encodeURIComponent(contentId),'PATCH',{push_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()},'return=minimal'));
   }
   return jr({ok:true,content_id:contentId,sent,gone:ids.length});
  }

  if(b.action==='change_password'){
   const token=bt(req),password=String(b.password||'');if(password.length<8)throw new Error('رمز جدید باید حداقل ۸ کاراکتر باشد');
   const u=await currentUser(token);await jo(await svc('/auth/v1/admin/users/'+u.id,'PUT',{password}));return jr({ok:true});
  }
  if(b.action==='staff_purge_preview'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(role!=='owner')throw new Error('فقط مالک می‌تواند حذف دائمی کارمند را بررسی کند');
   const target=String(b.user_id||'');if(!target)throw new Error('شناسه کارمند لازم است');
   const out=await jo(await supa('/rest/v1/rpc/academy_staff_purge_preview','POST',{p_user_id:target},token));
   return jr({ok:true,...out});
  }
  if(b.action==='staff_purge'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(role!=='owner')throw new Error('فقط مالک می‌تواند کارمند را برای همیشه حذف کند');
   const target=String(b.user_id||''),confirmName=String(b.confirm_name||'').trim();
   if(!target||!confirmName)throw new Error('شناسه کارمند و تأیید نام لازم است');
   const contracts=await jo(await supa('/rest/v1/academy_staff_contracts?select=file_path&staff_user_id=eq.'+encodeURIComponent(target), 'GET', null, token));
   const out=await jo(await supa('/rest/v1/rpc/academy_purge_staff_data','POST',{p_user_id:target,p_confirm_name:confirmName},token));
   if(Array.isArray(contracts))for(const c of contracts){if(c?.file_path){try{await svc('/storage/v1/object/academy-staff-contracts/'+c.file_path,'DELETE',null)}catch{}}}
   try{await jo(await svc('/auth/v1/admin/users/'+encodeURIComponent(target),'DELETE',null))}catch(e){throw new Error('اطلاعات پرسنلی پاک شد اما حذف حساب ورود کامل نشد؛ با پشتیبانی بررسی شود')}
   return jr({ok:true,mode:'purged',user_id:target,result:out});
  }
  if(b.action==='staff_contract_upload'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager'].includes(String(role||'')))throw new Error('Not authorized');
   const staff_user_id=String(b.staff_user_id||'');if(!staff_user_id)throw new Error('کارمند را انتخاب کنید');
   const mime=String(b.mime||''),ext=mimeExt(mime);if(!['jpg','png','webp','pdf'].includes(ext))throw new Error('فرمت قرارداد باید تصویر یا PDF باشد');
   const bytes=decodeBase64(String(b.data_base64||''),6291456);
   const key=staff_user_id+'/'+crypto.randomUUID()+'.'+ext;
   await uploadObject('academy-staff-contracts',key,bytes,mime);
   try{
    const row=await jo(await supa('/rest/v1/academy_staff_contracts','POST',{
      staff_user_id,contract_no:String(b.contract_no||'').trim()||null,contract_type:String(b.contract_type||'teaching'),
      start_date:String(b.start_date||'')||null,end_date:String(b.end_date||'')||null,status:String(b.status||'active'),
      file_path:key,file_name:String(b.file_name||'').slice(0,180)||null,mime_type:mime,
      notes:String(b.notes||'').trim()||null,created_by:u.id
    },token));
    return jr({ok:true,record:Array.isArray(row)?row[0]:row});
   }catch(e){try{await svc('/storage/v1/object/academy-staff-contracts/'+key,'DELETE',null)}catch{}throw e}
  }
  if(b.action==='student_contract_upload'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   const student_id=String(b.student_id||''),course_id=String(b.course_id||'')||null;
   if(!student_id)throw new Error('هنرجو را انتخاب کنید');
   const mime=String(b.mime||''),ext=mimeExt(mime);if(!['jpg','png','webp','pdf'].includes(ext))throw new Error('فرمت قرارداد باید تصویر یا PDF باشد');
   const bytes=decodeBase64(String(b.data_base64||''),6291456);
   const key=student_id+'/'+crypto.randomUUID()+'.'+ext;
   await uploadObject('academy-student-contracts',key,bytes,mime);
   try{
    const row=await jo(await supa('/rest/v1/academy_student_contracts','POST',{
      student_id,course_id,contract_no:String(b.contract_no||'').trim()||null,
      start_date:String(b.start_date||'')||null,end_date:String(b.end_date||'')||null,status:String(b.status||'active'),
      delivered_copy:!!b.delivered_copy,file_path:key,file_name:String(b.file_name||'').slice(0,180)||null,mime_type:mime,
      notes:String(b.notes||'').trim()||null,created_by:u.id
    },token));
    return jr({ok:true,record:Array.isArray(row)?row[0]:row});
   }catch(e){try{await svc('/storage/v1/object/academy-student-contracts/'+key,'DELETE',null)}catch{}throw e}
  }
  if(b.action==='contract_file_url'){
   const token=bt(req),u=await currentUser(token),role=await currentRole(token,u.id);
   if(!['owner','manager','registrar'].includes(String(role||'')))throw new Error('Not authorized');
   const kind=String(b.kind||''),id=String(b.id||'');if(!id||!['staff','student'].includes(kind))throw new Error('نوع و شناسه قرارداد لازم است');
   const table=kind==='staff'?'academy_staff_contracts':'academy_student_contracts';
   const bucket=kind==='staff'?'academy-staff-contracts':'academy-student-contracts';
   if(kind==='staff'&&role==='registrar')throw new Error('Not authorized');
   const rows=await jo(await supa('/rest/v1/'+table+'?select=id,file_path,file_name,mime_type&id=eq.'+encodeURIComponent(id)+'&limit=1','GET',null,token));
   if(!Array.isArray(rows)||!rows.length||!rows[0].file_path)throw new Error('فایل قرارداد پیدا نشد');
   return jr({ok:true,url:await signedObject(bucket,rows[0].file_path,900),file_name:rows[0].file_name,mime_type:rows[0].mime_type});
  }

  if(b.action==='admin_reset_password'){
   const token=bt(req),password=String(b.password||''),target=String(b.user_id||'');if(password.length<8)throw new Error('رمز موقت باید حداقل ۸ کاراکتر باشد');
   const u=await currentUser(token),role=await currentRole(token,u.id);if(role!=='owner')throw new Error('Not authorized');
   if(!target||target===u.id)throw new Error('برای تغییر رمز خودت از بخش امنیت حساب استفاده کن');
   await jo(await svc('/auth/v1/admin/users/'+encodeURIComponent(target),'PUT',{password}));return jr({ok:true});
  }
  if(b.action==='proxy'){
   const path=String(b.path||''),method=String(b.method||'GET').toUpperCase(),token=bt(req);
   if(!allowedProxy(path,method,token))throw new Error(token?'مسیر یا روش غیرمجاز است':'ابتدا وارد حساب کاربری شوید');
   const authToken=path.startsWith('/auth/v1/token?')?'':token;
   const r=await supa(path,method,b.body??null,authToken,String(b.prefer||'return=representation'));
   const t=await r.text();let d:any;try{d=t?JSON.parse(t):null}catch{d=t}
   return jr(d,r.status);
  }
  throw new Error('عملیات ناشناخته');
 }catch(e){return jr({error:String((e as Error).message||e)},400)}
});