import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run the production predicate with synthetic records only. No SMS, Push,
// credentials, or writes to real users are performed.
const source=fs.readFileSync(new URL('../supabase/functions/academy-gateway/index.ts',import.meta.url),'utf8');
const start=source.indexOf('function filterPushRecipients(');
const end=source.indexOf('\nasync function eligiblePushSubscriptions(',start);
assert.ok(start>=0&&end>start,'Dispatch-time recipient predicate must exist');
const fn=source.slice(start,end)
 .replace(/:any\[\]/g,'')
 .replace(/:Set<string>\|null/g,'')
 .replace(/:any/g,'')
 .replace(/new Map<string,Set<string>>\(\)/g,'new Map()')
 .replace(/new Set<string>\(\)/g,'new Set()')
 .replace(/\(s:any\)/g,'(s)')
 .replace(/\(g:any\)/g,'(g)')
 .replace(/\(link:any\)/g,'(link)')
 .replace(/\(sub:any\)/g,'(sub)')
 .replace(/guardianStudents\.get\(guardianId\)!/g,'guardianStudents.get(guardianId)');
const filter=vm.runInNewContext('('+fn.replace(/^function /,'function ')+')',{Map,Set,Array,String});
const students=[
 {id:'s1',user_id:'u1',status:'active',archived_at:null,portal_enabled:true},
 {id:'s2',user_id:'u2',status:'active',archived_at:null,portal_enabled:false},
 {id:'s3',user_id:'u3',status:'archived',archived_at:null,portal_enabled:true},
 {id:'s4',user_id:'u4',status:'active',archived_at:null,portal_enabled:true}
];
const guardians=[{id:'g1',user_id:'p1',active:true},{id:'g2',user_id:'p2',active:false}];
const links=[
 {guardian_id:'g1',student_id:'s1',can_view_academic:true,can_receive_notifications:true},
 {guardian_id:'g1',student_id:'s4',can_view_academic:true,can_receive_notifications:false},
 {guardian_id:'g2',student_id:'s1',can_view_academic:true,can_receive_notifications:true}
];
const subs=[
 {identity:'student-good',user_id:'u1',student_id:'s1'},
 {identity:'student-disabled',user_id:'u2',student_id:'s2'},
 {identity:'student-archived',user_id:'u3',student_id:'s3'},
 {identity:'student-forged',user_id:'attacker',student_id:'s1'},
 {identity:'guardian-good',user_id:'p1',student_id:null},
 {identity:'guardian-inactive',user_id:'p2',student_id:null},
 {identity:'guardian-unknown',user_id:'unknown',student_id:null},
 {identity:'student-good',user_id:'u1',student_id:'s1'}
];
const ids=x=>Array.from(filter(subs,students,guardians,links,x),s=>s.identity);
assert.deepEqual(ids(null),['student-good','guardian-good']);
assert.deepEqual(ids(new Set(['s1'])),['student-good','guardian-good']);
assert.deepEqual(ids(new Set(['s4'])),[]);
assert.deepEqual(ids(new Set(['s2'])),[]);
const revoked=links.map(x=>({...x,can_receive_notifications:false}));
assert.deepEqual(Array.from(filter(subs,students,guardians,revoked,null),s=>s.identity),['student-good']);
assert.match(source,/daily_admin_push_batch[\s\S]*eligiblePushSubscriptions\(stored,/);
assert.match(source,/daily_cron_batch[\s\S]*eligiblePushSubscriptions\(activeSubs,/);
console.log('PASS: revoked guardian consent, archived accounts, disabled portals, course scoping, stale owners and duplicate endpoints');
