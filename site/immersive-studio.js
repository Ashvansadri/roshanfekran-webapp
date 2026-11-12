/* Roshanfekran Immersive Studio 2
 * One actual Three.js/WebGL viewport; immediate model change on all three controls.
 * 3D geometry is real, not a slideshow. Fallback imagery requires no GPU.
 * Three.js 0.180.0 is self-hosted under its MIT license.
 */
const root=document.querySelector('#app');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(max-width: 680px)');
const containerSelector='.rf-cinema-panels[data-rf-immersive-worlds]';
const labels=['هوش مصنوعی','فناوری بلاکچین','تحلیل بازار'];
const state={loaded:false,contexts:0,active:0,activeWorld:0,sceneId:'ai',renderedFrames:0,fallbacks:0,version:'studio-v2'};
window.RFIMMERSIVE=state;
let studio=null,booting=null;
const source='/vendor/three/three.module.min.js';
function findParts(){
 const wrap=document.querySelector(containerSelector);
 return wrap?{wrap,nodes:[...wrap.querySelectorAll(':scope > .rf-cinema-scene')],controls:[...wrap.querySelectorAll('[data-rf-jump-scene]')]}:null
}
function announce(parts,i){
 parts.wrap.dataset.rfWorld=String(i);
 parts.controls.forEach((b,n)=>{b.setAttribute('aria-pressed',String(n===i));b.tabIndex=n===i?0:-1});
 const live=parts.wrap.querySelector('.rf-world-live');
 if(live)live.textContent='فضای '+labels[i]+' انتخاب شد';
 state.activeWorld=i;state.sceneId=['ai','blockchain','markets'][i];
}
function createStudio(THREE,parts){
 const canvas=document.createElement('canvas');canvas.className='rf-live-3d rf-studio-viewport';canvas.setAttribute('aria-hidden','true');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!mobile.matches,powerPreference:'high-performance'});
 renderer.setClearColor(0x06131f,0);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile.matches?1.12:1.55));
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.48;
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x061521,.025);
 const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,1.6,14);
 const hemi=new THREE.HemisphereLight(0xd5faff,0x0a2435,2.2);scene.add(hemi);
 const key=new THREE.DirectionalLight(0xf5fdff,5.0);key.position.set(-4,8,7);scene.add(key);
 const fill=new THREE.PointLight(0x56e2e5,100,25);fill.position.set(-7,2,3);scene.add(fill);
 const amber=new THREE.PointLight(0xffc18b,105,25);amber.position.set(2,2,6);scene.add(amber);
 const rim=new THREE.PointLight(0x7c8cfa,80,21);rim.position.set(-1,1,-5);scene.add(rim);
 const sphereGeo=new THREE.SphereGeometry(1,32,24);
 const metal=(hex=.18,r=.16)=>new THREE.MeshPhysicalMaterial({color:hex,metalness:.81,roughness:r,clearcoat:1,clearcoatRoughness:.09,side:THREE.DoubleSide});
 const porcelain=metal(0xc8e9ef,.19), graphite=metal(0x091e2a,.13), bronze=metal(0xe4a767,.18), dark=metal(0x183642,.27);
 const translucent=new THREE.MeshPhysicalMaterial({color:0x7de7f0,metalness:.3,roughness:.08,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide});
 const luminous=(c,opacity=1)=>new THREE.MeshBasicMaterial({color:c,transparent:opacity<1,opacity,depthWrite:false,side:THREE.DoubleSide});
 const cyan=luminous(0x8bf9f2),gold=luminous(0xffcf92),blue=luminous(0x7fb6ff);
 const mesh=(parent,g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o};
 const ball=(parent,x,y,z,r,m)=>{const o=mesh(parent,sphereGeo,m,x,y,z);o.scale.setScalar(r);return o};
 const cube=(parent,x,y,z,sx,sy,sz,m)=>{const o=mesh(parent,new THREE.BoxGeometry(1,1,1),m,x,y,z);o.scale.set(sx,sy,sz);return o};
 const torus=(parent,r,t,m,x=0,y=0,z=0)=>mesh(parent,new THREE.TorusGeometry(r,t,10,96),m,x,y,z);
 const cylinder=(parent,top,bottom,h,m,x=0,y=0,z=0,n=28)=>mesh(parent,new THREE.CylinderGeometry(top,bottom,h,n),m,x,y,z);
 const line=(parent,points,color,opacity=.7)=>{
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
  const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const o=new THREE.Line(geo,mat);parent.add(o);return o
 };
 const createArchitecture=(g,accent)=>{
   const arch=new THREE.Group();g.add(arch);
   cube(arch,-2,-3.22,-5,22,.22,17,metal(0x102e3b,.32));
   cube(arch,-2,4.8,-8,22,.15,10,metal(0x172b39,.3));
   for(const x of [-8,-4,0,4]){
     cube(arch,x,.5,-9,.15,8,.3,dark);
     cube(arch,x+.12,.5,-8.8,.024,7.7,.022,luminous(accent,.44));
   }
   for(const y of [-2,0,2,4])line(arch,[[-9,y,-8.9],[6,y,-8.9]],accent,.22);
   for(const x of [-6,-2,2])cube(arch,x,4.4,-7.5,.045,.055,5,luminous(accent,.3));
   const floor=new THREE.GridHelper(22,23,accent,0x224a54);
   floor.material.transparent=true;floor.material.opacity=.24;floor.position.set(-2,-3.08,-2);arch.add(floor);
   const platform=cylinder(arch,3.1,3.38,.20,dark,-2.45,-3.03,-.7,64);
   const ring=torus(arch,3.03,.03,luminous(accent,.73),-2.45,-2.91,-.7);
   ring.rotation.x=Math.PI/2;
   return arch;
 };
 const worlds=[];
 // WORLD ONE — robotic teaching assistant, actuators, ceramic armor, orbital neural core.
 const ai=new THREE.Group();scene.add(ai);createArchitecture(ai,0x39e3e3);
 const body=new THREE.Group();body.position.set(-2.42,.02,.65);ai.add(body);
 const torso=mesh(body,new THREE.SphereGeometry(1,42,24),porcelain,0,-1.91,0);torso.scale.set(1.3,.82,.68);
 const chest=mesh(body,new THREE.SphereGeometry(1,36,24),graphite,0,-1.85,.57);chest.scale.set(.92,.50,.17);
 cube(body,0,-1.85,.75,.75,.07,.045,cyan);
 cylinder(body,.31,.32,.62,bronze,0,-1.18,0);
 const head=mesh(body,new THREE.SphereGeometry(1,56,36),porcelain,0,.1,0);head.scale.set(.91,1.08,.75);
 const visor=mesh(body,new THREE.SphereGeometry(1,44,26),graphite,0,-.02,.70);visor.scale.set(.67,.59,.19);
 for(const side of [-1,1]){
   const eye=ball(body,side*.28,.18,.878,.105,cyan);eye.scale.set(1.15,.75,.4);
   const ear=cylinder(body,.26,.26,.16,bronze,side*.93,.13,.03);ear.rotation.z=Math.PI/2;
   const earGlow=torus(body,.17,.026,cyan,side*1.05,.13,.03);earGlow.rotation.y=Math.PI/2;
   const shoulder=ball(body,side*1.18,-1.65,-.06,.46,porcelain);shoulder.scale.set(1.07,.85,1.0);
   const joint=ball(body,side*1.34,-2.23,.1,.24,graphite);
   const arm=cylinder(body,.22,.30,.84,porcelain,side*1.45,-2.48,.08);arm.rotation.z=side*.14;
   const elbow=ball(body,side*1.49,-2.91,.08,.20,bronze);
   const forearm=cylinder(body,.18,.23,.65,graphite,side*1.56,-3.19,.16);forearm.rotation.z=-side*.1;
   const seam=torus(body,.26,.022,cyan,side*1.18,-1.65,.19);seam.rotation.y=Math.PI/2;
 }
 const jaw=cube(body,0,-.53,.69,.57,.043,.042,bronze);
 const crown=torus(body,1.2,.015,cyan,0,.23,-.09);crown.rotation.x=.34;
 const halo=torus(body,1.73,.018,gold,0,.45,-.22);halo.rotation.set(.76,.28,.24);
 const brain=ball(ai,-.24,1.84,-1.7,.63,translucent);
 const brainRings=[];
 for(let k=0;k<7;k++){
  const o=torus(ai,.50+k*.07,.008,k%3===0?gold:cyan,-.24,1.84,-1.7);
  o.rotation.set(k*.29,k*.71,k*.38);brainRings.push(o);
 }
 for(let i=0;i<32;i++){
   const theta=i*2.3999,phi=Math.acos(1-2*(i+.5)/32),radius=2.1;
   const px=-.24+radius*Math.cos(theta)*Math.sin(phi),py=1.84+radius*Math.cos(phi),pz=-1.7+radius*Math.sin(theta)*Math.sin(phi);
   ball(ai,px,py,pz,.035,i%5?cyan:gold);
 }
 worlds.push({group:ai,spin:body,special:brainRings,accent:0x40ebea,base:[-2.4,0,0]});
 // WORLD TWO — transparent computational blockchain lattice, real 3D connected volumes.
 const web3=new THREE.Group();scene.add(web3);createArchitecture(web3,0x6eafff);
 const nodes=new THREE.Group();nodes.position.set(-2.2,0,.55);web3.add(nodes);
 const points=[[0,.4,0],[-2,1.6,-.6],[2,1.5,-1],[-2,-1.35,-1.2],[2,-1.5,-.6],[0,2.75,-1.6],[.15,-2.7,-1.5],[-3.1,.1,-2.8],[3.1,.2,-2.9]];
 const nodeBoxes=[];
 const glassWire=new THREE.LineBasicMaterial({color:0xc4eafe,transparent:true,opacity:.83});
 points.forEach((p,i)=>{
   const gg=new THREE.Group();gg.position.set(...p);nodes.add(gg);
   const size=i===0?1.95:(i<=4?.87:.61);
   cube(gg,0,0,0,size,size,size,translucent);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size,size,size)),glassWire);gg.add(edges);
   ball(gg,0,0,0,i===0?.25:.10,i%3===0?gold:blue);
   const core=torus(gg,size*.38,.013,i%2?cyan:gold);core.rotation.set(.5,.4,.2);
   nodeBoxes.push(gg);
 });
 for(let i=1;i<points.length;i++){
   const p=points[i];line(nodes,[points[0],p],i%3?0x68c6f9:0xffcf93,.65);
   for(let k=0;k<3;k++){
     const a=k/3,b=(k+1)/3;
     ball(nodes,p[0]*a,p[1]*a+.4*(1-a),p[2]*a,.028,cyan);
   }
 }
 const whalo=torus(nodes,2.72,.024,blue,0,.3,-.7);whalo.rotation.x=.43;
 const whalo2=torus(nodes,3.11,.014,gold,0,.3,-.8);whalo2.rotation.y=.61;
 worlds.push({group:web3,spin:nodes,special:nodeBoxes,accent:0x669fee,base:[-2.4,0,0]});
 // WORLD THREE — floating triple-market display, 3D candlesticks and trading deck.
 const mk=new THREE.Group();scene.add(mk);createArchitecture(mk,0xf3bd73);
 const desk=new THREE.Group();desk.position.set(-2.7,-.1,.55);mk.add(desk);
 cylinder(desk,.16,.25,1.02,bronze,0,-2.25,-.1);
 cube(desk,0,-2.68,0,4.6,.19,1.65,dark);
 const markets=[
  {x:0,y:.35,z:-.4,w:4.15,h:2.4,rot:0},
  {x:-3.15,y:.08,z:-1.55,w:2.32,h:1.9,rot:.28},
  {x:3.15,y:.08,z:-1.55,w:2.32,h:1.9,rot:-.28}
 ];
 markets.forEach((item,t)=>{
  const monitor=new THREE.Group();monitor.position.set(item.x,item.y,item.z);monitor.rotation.y=item.rot;desk.add(monitor);
  cube(monitor,0,0,0,item.w+.2,item.h+.2,.16,bronze);
  cube(monitor,0,0,.1,item.w,item.h,.035,graphite);
  for(let v=0;v<5;v++)line(monitor,[[-item.w*.48,(v/4-.5)*item.h,.15],[item.w*.48,(v/4-.5)*item.h,.15]],0x2e7382,.5);
  const prices=[.35,.64,.42,.94,.77,1.20,.99,1.40,1.27,1.51,1.11,1.65,1.91,1.76,2.14];
  const tradeLine=[];
  for(let i=0;i<prices.length;i++){
   const x=(i/(prices.length-1)-.5)*item.w*.88;
   const y=(prices[i]-1)*item.h*.36;
   const up=i===0||prices[i]>=prices[i-1],color=up?cyan:gold;
   const candle=cube(monitor,x,y,.20,Math.max(.027,item.w*.018),.11+Math.abs(prices[i]-(prices[i-1]||prices[i]))*.23,.065,color);
   cube(monitor,x,y,.21,.012,.34,.014,color);
   tradeLine.push([x,y,.25]);
  }
  line(monitor,tradeLine,t===1?0xffc27f:0x80f8e5,.92);
  cube(monitor,0,-item.h*.56,-.15,.12,.42,.15,bronze);
 });
 const arch=torus(desk,3.1,.018,gold,0,-2.64,-.4);arch.rotation.x=Math.PI/2;
 worlds.push({group:mk,spin:desk,special:[],accent:0xffcc90,base:[-2.4,0,0]});
 const particleCount=mobile.matches?90:185;
 const coords=new Float32Array(particleCount*3);
 for(let i=0;i<particleCount;i++){coords[i*3]=-9+Math.random()*16;coords[i*3+1]=-3+Math.random()*9;coords[i*3+2]=-8+Math.random()*12}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(coords,3));
 const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0xb1f8ff,size:.035,transparent:true,opacity:.58,depthWrite:false}));scene.add(stars);
 const controls={desired:0,current:0,pointerX:0,pointerY:0,last:0,running:false,dead:false,frame:0,width:0,height:0,visible:true};
 const observer3d=new IntersectionObserver(items=>{
  controls.visible=items.some(x=>x.isIntersecting);
  if(controls.visible)paint(performance.now());
 },{rootMargin:'100px',threshold:.01});
 observer3d.observe(parts.wrap);
 const attach=i=>{
  const el=parts.nodes[i];if(!el)return;el.appendChild(canvas);
  parts.nodes.forEach((n,j)=>{n.classList.toggle('rf-webgl-ready',i===j);n.dataset.rf3dStatus=i===j?'live':'idle'});
  renderer.setClearColor(i===2?0x170f08:0x06131f,0);
  const daylight=i===2?0xe6b977:i===1?0x7a9cff:0x56e2e5;fill.color.set(daylight);
 };
 const resize=()=>{
   const target=parts.nodes[controls.current];if(!target)return;
   const rect=target.getBoundingClientRect();
   const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
   if(w===controls.width&&h===controls.height)return;
   controls.width=w;controls.height=h;renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.fov=w<680?44:38;camera.position.z=w<680?16.8:14;
   camera.updateProjectionMatrix();
 };
 const paint=(time=0)=>{
  if(controls.dead)return;
  resize();
  for(let i=0;i<worlds.length;i++){
   const active=i===controls.current;
   worlds[i].group.visible=active;
  }
  const current=worlds[controls.current];
  const sec=time*.001;
  current.spin.rotation.y=reduced.matches?0:Math.sin(sec*.23)*.09+controls.pointerX*.20;
  current.spin.rotation.x=reduced.matches?0:Math.sin(sec*.17)*.035-controls.pointerY*.07;
  if(!reduced.matches){
   current.special.forEach((o,k)=>{if(controls.current===0)o.rotation.y+=.002*(k%2?-1:1)});
   stars.rotation.y=Math.sin(sec*.09)*.012;
  }
  camera.position.x+=((controls.pointerX*.50)-(camera.position.x||0))*.06;
  camera.position.y+=(1.6-controls.pointerY*.31-camera.position.y)*.06;
  camera.lookAt(mobile.matches?-2.2:-1.0,mobile.matches?.15:0,0);
  renderer.render(scene,camera);state.renderedFrames++;
 };
 const loop=time=>{
  if(controls.dead||!document.contains(canvas)){destroy();return}
  controls.frame=requestAnimationFrame(loop);
  if(document.hidden||!controls.visible||time-controls.last<(mobile.matches?50:28))return;
  controls.last=time;paint(time);
 };
 const onPointer=e=>{
   const el=parts.nodes[controls.current],r=el.getBoundingClientRect();
   if(!r.width||!r.height)return;
   controls.pointerX=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2));
   controls.pointerY=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)*2));
   if(reduced.matches)paint(performance.now());
 };
 const onVisibility=()=>{if(!document.hidden)paint(performance.now())};
 const onResize=()=>{controls.width=0;paint(performance.now())};
 parts.nodes.forEach(n=>n.addEventListener('pointermove',onPointer,{passive:true}));
 window.addEventListener('resize',onResize,{passive:true});
 document.addEventListener('visibilitychange',onVisibility);
 const activate=i=>{
   if(controls.dead||!Number.isInteger(i)||i<0||i>2)return;
   controls.current=i;controls.width=0;controls.height=0;
   attach(i);paint(performance.now());state.active=1;
 };
 function destroy(){
  if(controls.dead)return;controls.dead=true;cancelAnimationFrame(controls.frame);
  observer3d.disconnect();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('resize',onResize);
  parts.nodes.forEach(n=>n.removeEventListener('pointermove',onPointer));
  scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m?.dispose?.())}});
  renderer.dispose();canvas.remove();state.contexts=0;state.active=0;
 }
 state.loaded=true;state.contexts=1;activate(state.activeWorld);
 if(!reduced.matches)controls.frame=requestAnimationFrame(loop);
 return{parts,activate,destroy,paint};
}
async function ensure(){
 const parts=findParts();if(!parts){studio?.destroy();studio=null;return}
 if(studio){
  if(studio.parts.wrap===parts.wrap)return;
  studio.destroy();studio=null;
 }
 if(booting)return booting;
 booting=(async()=>{
  try{
   const THREE=await import(source);
   const current=findParts();
   if(!current)return;
   studio=createStudio(THREE,current);
  }catch(err){
   state.fallbacks++;
   console.warn('Immersive 3D unavailable; showing accessible image view',err);
  }finally{booting=null}
 })();
 return booting;
}
function setWorld(i){
 const p=findParts();if(!p)return;
 announce(p,i);
 if(studio&&studio.parts.wrap===p.wrap)studio.activate(i);
 else ensure();
}
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-rf-jump-scene]');if(!btn)return;
 const i=Number(btn.dataset.rfJumpScene);
 if(!Number.isInteger(i)||i<0||i>2)return;
 event.preventDefault();setWorld(i);
 const active=findParts()?.nodes[i];
 if(active)requestAnimationFrame(()=>active.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'}));
},{capture:true});
document.addEventListener('keydown',event=>{
 const btn=event.target.closest('[data-rf-jump-scene]');if(!btn||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();
 const current=state.activeWorld,i=event.key==='Home'?0:event.key==='End'?2:
  event.key==='ArrowLeft'?(current+1)%3:(current+2)%3;
 setWorld(i);findParts()?.controls[i]?.focus();
});
let scheduled=false;
const observer=new MutationObserver(records=>{
 if(!records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(containerSelector)||n.querySelector?.(containerSelector)))))return;
 if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensure()});
});
if(root)observer.observe(root,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensure()});
requestAnimationFrame(()=>ensure());
