// Offline regression: account A's late staff responses must never appear for account B.
import {readFileSync} from "node:fs";
import {join} from "node:path";
import assert from "node:assert/strict";

const source=readFileSync(join(new URL("../",import.meta.url).pathname,"site/academy-ops.js"),"utf8");
const root={addEventListener(){}};
const window={RFCORE:{render(){}}};
const document={getElementById(){return root}};
new Function("window","document","location","navigator","confirm","prompt",source)(
 window,document,{origin:"https://example.invalid"},{clipboard:{writeText:async()=>{}}},()=>false,()=>null
);
const ops=window.RFOPS;
assert.equal(typeof ops?.reset,"function");
const pending=[];
const oldLoad=ops.load({kind:"staff",role:"owner"},(_,{path})=>
 new Promise(resolve=>pending.push({path,resolve}))
);
assert(pending.length>0,"Expected old account requests to start");
ops.reset();
const fresh=await ops.load({kind:"staff",role:"owner"},(_,{path})=>
 Promise.resolve(path.includes("/academy_students?")?[{id:"new",full_name:"NEW_ACCOUNT_ONLY"}]:[])
);
assert.equal(fresh,true);
pending.forEach(({path,resolve})=>resolve(path.includes("/academy_students?")?[{id:"old",full_name:"OLD_ACCOUNT_PRIVATE"}]:[]));
assert.equal(await oldLoad,false,"Late request must be discarded");
const markup=ops.render({kind:"staff",role:"owner"});
assert(markup.includes("NEW_ACCOUNT_ONLY"),"Current account data should remain visible");
assert(!markup.includes("OLD_ACCOUNT_PRIVATE"),"Prior account data leaked");
ops.reset();
assert(!ops.render({kind:"staff",role:"owner"}).includes("NEW_ACCOUNT_ONLY"),"Reset must erase private data");
console.log("PASS: staff session isolation, stale request rejection, private cache reset");
