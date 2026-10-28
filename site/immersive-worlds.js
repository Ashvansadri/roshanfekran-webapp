/* ROSHANFEKRAN / Live 3D Worlds
 * Three.js MIT-licensed, pinned 0.180.0, loaded only on the public landing.
 * Actual polygonal meshes + camera, lights, particles and pointer/scroll response.
 * Fallback: original still image remains visible when WebGL or CDN is unavailable.
 */
const ROOT=document.querySelector("#app");
const prefersReduced=window.matchMedia("(prefers-reduced-motion: reduce)");
const coarse=window.matchMedia("(pointer: coarse)");
const LIB="/vendor/three/three.module.min.js";
let threePromise=null, watchers=null, entries=new Map(), mutationQueued=false, dynamicCount=0;
const info={loaded:false,active:0,contexts:0,fallbacks:0,version:"immersive-v1"};
window.RFIMMERSIVE=info;
function setStatus(node,value){
 node.dataset.rf3dStatus=value;
 const label=node.querySelector(".rf-3d-live-label");
 if(label)label.textContent=value==="live"?"◉ صحنه سه‌بعدی فعال · موس را حرکت بده":"◌ نسخه تصویری سبک؛ سه‌بعدی در این دستگاه در دسترس نیست";
}
function loadThree(){if(!threePromise)threePromise=import(LIB);return threePromise}
const rand=(a,b)=>a+Math.random()*(b-a);
function startScene(THREE,node,idx){
 const canvas=document.createElement("canvas");canvas.className="rf-live-3d";canvas.setAttribute("aria-hidden","true");
 node.appendChild(canvas);
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!coarse.matches,powerPreference:"low-power",preserveDrawingBuffer:false})}
 catch(err){canvas.remove();throw err}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,coarse.matches?1.1:1.45));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.35;
 renderer.setClearColor(0x05131d,0);
 const scene=new THREE.Scene();
 scene.fog=new THREE.FogExp2(0x061824,0.028);
 const camera=new THREE.PerspectiveCamera(37,1,.1,130);
 camera.position.set(0,1.8,13);
 const hemisphere=new THREE.HemisphereLight(0x9df7ff,0x0a2432,2.0);scene.add(hemisphere);
 const cyanLight=new THREE.PointLight(0x35f1f0,120,24);cyanLight.position.set(-4,5,4);scene.add(cyanLight);
 const goldLight=new THREE.PointLight(0xf8b86e,155,25);goldLight.position.set(3,1,5);scene.add(goldLight);
 const rimLight=new THREE.PointLight(0x9cc5ff,70,25);rimLight.position.set(-2,4,-5);scene.add(rimLight);
 const entire=new THREE.Group();scene.add(entire);
 const accent=idx===2?0xf7b56b:0x47e9e9;
 const metal=(color=0x123f50,roughness=.18,metalness=.78,opacity=1)=>new THREE.MeshStandardMaterial({color,roughness,metalness,transparent:opacity<1,opacity,side:THREE.DoubleSide});
 const emissive=(color,intensity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:intensity,depthWrite:false,side:THREE.DoubleSide});
 const steel=metal(0x274453,.17,.92),dark=metal(0x081d2a,.22,.86),gold=metal(0xe9b979,.25,.9),glass=metal(0x77d9e6,.07,.24,.19),glow=emissive(0x73f6f7,.89),amber=emissive(0xffd092,.85);
 const ball=new THREE.SphereGeometry(1,32,22),box=new THREE.BoxGeometry(1,1,1);
 const torus=(rad,tube,col)=>new THREE.Mesh(new THREE.TorusGeometry(rad,tube,9,85),col);
 function mesh(g,m,parent=entire,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
 function sphere(parent,x,y,z,r,mat){const o=mesh(ball,mat,parent,x,y,z);o.scale.setScalar(r);return o}
 const lines=(positions,color,opacity=.45)=>{
  const g=new THREE.BufferGeometry().setFromPoints(positions.map(p=>new THREE.Vector3(...p)));
  const m=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
  const l=new THREE.Line(g,m);entire.add(l);return l;
 };
 function ring(parent,r,tube,mat,rotation=[0,0,0]){
  const o=mesh(new THREE.TorusGeometry(r,tube,10,110),mat,parent);o.rotation.set(...rotation);return o
 }
 const hero= new THREE.Group();hero.position.set(-2.05,.12,0);entire.add(hero);
 // A perspective architectural stage, drawn from real 3D depth-grid meshes.
 const floor=new THREE.GridHelper(29,32,0x2a9b9c,0x20515b);
 floor.position.y=-3.1;floor.material.transparent=true;floor.material.opacity=.25;entire.add(floor);
 const orbiters=[];
 if(idx===0){
  // Polished robotic head and torso with embedded digital neural organ.
  const torso=mesh(new THREE.SphereGeometry(1,32,22),dark,hero,0,-2.20,-.20);torso.scale.set(1.30,.66,.65);
  const chest=mesh(new THREE.SphereGeometry(1,32,22),steel,hero,0,-2.10,.28);chest.scale.set(.93,.47,.35);
  const neck=mesh(new THREE.CylinderGeometry(.30,.38,.75,24),gold,hero,0,-1.29,0);
  const head=mesh(new THREE.SphereGeometry(1,46,32),steel,hero,0,.20,.02);head.scale.set(.83,1.12,.66);
  const face=mesh(new THREE.SphereGeometry(1,32,22),dark,hero,0,.03,.56);face.scale.set(.59,.64,.19);
  for(const side of [-1,1]){
   const eye=mesh(new THREE.SphereGeometry(.13,16,12),glow,hero,side*.23,.25,.737);eye.scale.set(1.12,.58,.35);
   const ear=mesh(new THREE.CylinderGeometry(.22,.22,.18,22),gold,hero,side*.82,.19,.04);ear.rotation.z=Math.PI/2;
   ring(hero,.19,.027,glow,[0,Math.PI/2,0]).position.set(side*.91,.19,.04);
  }
  const brow=ring(hero,.69,.028,gold,[Math.PI/2.9,0,0]);brow.position.set(0,.15,.24);brow.scale.set(1,1.31,1);
  const skullCircuit=new THREE.Group();head.add(skullCircuit);
  for(let k=0;k<35;k++){
   const phi=rand(0,Math.PI*2),theta=rand(.35,2.45);
   const x=Math.sin(theta)*Math.cos(phi)*.88,y=Math.cos(theta)*1.0,z=Math.sin(theta)*Math.sin(phi)*.84;
   const m=sphere(hero,x*.83,y*1.12+.25,z*.65+.04,.016,k%4?glow:amber);
   m.material=m.material;
  }
  const halo=ring(hero,1.7,.024,glow,[.42,.31,.1]);halo.position.y=.4;
  const halo2=ring(hero,1.93,.017,amber,[1.18,.13,.38]);halo2.position.y=.4;
  orbiters.push(halo,halo2);
  const core=sphere(hero,0,1.88,-.1,.51,glass);core.scale.set(1.08,.78,1.0);
  for(let j=0;j<7;j++){const ringlet=ring(hero,.42+j*.055,.007,j%3===0?amber:glow,[rand(-1,1),rand(-1,1),rand(-1,1)]);ringlet.position.set(0,1.88,-.1);orbiters.push(ringlet)}
  for(let j=0;j<26;j++){const az=rand(0,Math.PI*2),y=rand(-1.3,2.7),r=rand(2.0,3.7);sphere(entire,Math.cos(az)*r-1.6,y,Math.sin(az)*r-1,.025,j%4?glow:amber)}
 }else if(idx===1){
  // Iridescent transparent cube-network with floating data centers and real connections.
  const positions=[[0,0,0],[-2,1.1,-1],[2,1.1,-1],[-2,-1.2,-1],[2,-1.2,-1],[0,2.2,-2.1],[0,-2.3,-1.8],[-3.4,.1,-3],[3.4,.1,-3]];
  const frameMat=new THREE.LineBasicMaterial({color:0xa9f8fa,transparent:true,opacity:.82});
  const cubeGroup=new THREE.Group();hero.add(cubeGroup);
  const cubes=[];
  positions.forEach((p,i)=>{
   const group=new THREE.Group();group.position.set(...p);cubeGroup.add(group);
   const sz=i===0?2.4:i<5?.92:.63;
   const solid=mesh(box,glass,group);solid.scale.setScalar(sz);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sz,sz,sz)),frameMat);group.add(edges);
   sphere(group,0,0,0,i===0?.24:.1,i%3?glow:amber);
   cubes.push(group);
  });
  positions.slice(1).forEach((p,i)=>lines([[0,0,0],p],i%2?0xeec38b:0x72e9ec,.65));
  for(let i=0;i<28;i++){const az=rand(0,Math.PI*2),radius=rand(.9,5.5);sphere(entire,-1.9+Math.cos(az)*radius,rand(-2.2,2.5),Math.sin(az)*radius-.6,rand(.012,.045),i%5?glow:amber)}
  const platform=mesh(new THREE.CylinderGeometry(2.7,2.9,.15,56),steel,hero,0,-3,0);
  ring(hero,2.5,.026,glow,[Math.PI/2,0,0]).position.y=-2.9;
  ring(hero,2.15,.015,amber,[Math.PI/2,0,0]).position.y=-2.88;
  orbiters.push(...cubes);
 }else{
  // Trading lab: genuine extruded candles, luminous market ribbons and 3D display frame.
  const board=new THREE.Group();hero.add(board);
  const panel=mesh(box,dark,board,0,.3,-.7);panel.scale.set(5.9,3.8,.22);
  const border=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6,3.87,.3)),new THREE.LineBasicMaterial({color:0xf4c68e}));border.position.set(0,.3,-.7);board.add(border);
  for(let i=0;i<10;i++){const x=-2.7+i*.6;lines([[x,-1.4,-.5],[x,2.0,-.5]],0x2a858f,.22)}
  for(let i=0;i<6;i++){const y=-1.3+i*.61;lines([[-2.75,y,-.48],[2.75,y,-.48]],0x2a858f,.26)}
  const prices=[.15,.62,.35,.82,1.05,.56,1.44,.99,1.68,1.42,1.91,1.69,2.06,1.62,2.34,2.07];
  const pts=[];
  prices.forEach((v,i)=>{
   const x=-2.48+i*.33,y=-1.17+v*1.19,z=-.35;
   const candle=mesh(box,i%3===0?gold:metal(0x34c4c1,.28,.45),board,x,y,z);candle.scale.set(.12,.25+Math.abs(v-(prices[i-1]??v))*.53,.15);
   const wick=mesh(new THREE.CylinderGeometry(.009,.009,.48,6),i%3===0?amber:glow,board,x,y,z);
   pts.push([x,y,z+.23]);
  });
  const path=lines(pts,0x9dfdfa,.94);
  ring(hero,2.9,.017,amber,[Math.PI/2,0,0]).position.y=-2.55;
  const base=mesh(new THREE.CylinderGeometry(3.0,3.0,.17,46),steel,hero,0,-2.7,0);
  const disc=mesh(new THREE.CylinderGeometry(.48,.55,.65,26),gold,hero,1.9,-1.65,.55);
  orbiters.push(board);
 }
 const particleCount=coarse.matches?95:190;
 const pa=new Float32Array(particleCount*3),pc=new Float32Array(particleCount*3);
 for(let i=0;i<particleCount;i++){pa[i*3]=rand(-8,6);pa[i*3+1]=rand(-3,5);pa[i*3+2]=rand(-8,2);const color=i%5===0?[1,.69,.35]:[.25,.82,.91];pc.set(color,i*3)}
 const pointsGeo=new THREE.BufferGeometry();
 pointsGeo.setAttribute("position",new THREE.BufferAttribute(pa,3));
 pointsGeo.setAttribute("color",new THREE.BufferAttribute(pc,3));
 const points=new THREE.Points(pointsGeo,new THREE.PointsMaterial({size:coarse.matches?.042:.048,vertexColors:true,transparent:true,opacity:.65,depthWrite:false}));
 entire.add(points);
 let disposed=false,playing=false,last=0,frameId=0,pointerX=0,pointerY=0,width=0,height=0,clock=0,intersecting=true;
 const reduce=()=>prefersReduced.matches;
 const resize=()=>{
  const box=node.getBoundingClientRect();const w=Math.max(1,Math.floor(box.width)),h=Math.max(1,Math.floor(box.height));
  if(w===width&&h===height)return;
  width=w;height=h;camera.aspect=w/h;camera.fov=w<650?50:37;camera.position.z=w<650?16:13;camera.updateProjectionMatrix();renderer.setSize(w,h,false)
 };
 const onPointer=e=>{const r=node.getBoundingClientRect();pointerX=((e.clientX-r.left)/r.width-.5)*2;pointerY=((e.clientY-r.top)/r.height-.5)*2};
 node.addEventListener("pointermove",onPointer,{passive:true});
 function draw(now){
  if(disposed||!node.isConnected){stop();return}
  frameId=requestAnimationFrame(draw);
  if(!intersecting||document.hidden||now-last<(coarse.matches?48:25))return;
  last=now;resize();
  const time=now*.001;
  const motion=reduce()?0:1;
  const tx=pointerX*motion,ty=pointerY*motion;
  camera.position.x+=(tx*.85-camera.position.x)*.032;
  camera.position.y+=(1.8-ty*.55-camera.position.y)*.028;
  camera.lookAt(width<650?new THREE.Vector3(-1.7,.0,0):new THREE.Vector3(-.95,0,0));
  hero.rotation.y=motion*(Math.sin(time*.20)*.12+tx*.18);
  hero.rotation.x=motion*(Math.cos(time*.22)*.04-ty*.07);
  orbiters.forEach((x,i)=>{if(!reduce()){x.rotation.y+=.002*(i%2?1:-1);if(idx===1)x.rotation.x+=.0006}});
  points.rotation.y=motion*Math.sin(time*.11)*.025;
  renderer.render(scene,camera);
  info.active=entries.size;
  if(reduce())pause();
 }
 function play(){if(disposed||playing)return;playing=true;frameId=requestAnimationFrame(draw)}
 function pause(){if(!playing)return;playing=false;cancelAnimationFrame(frameId);resize();renderer.render(scene,camera)}
 function stop(){
  if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(frameId);
  node.removeEventListener("pointermove",onPointer);
  scene.traverse(o=>{if(o.geometry?.dispose)o.geometry.dispose();if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(v=>v.dispose?.())}});
  renderer.dispose();renderer.forceContextLoss?.();canvas.remove();node.classList.remove("rf-webgl-ready");info.contexts=Math.max(0,info.contexts-1)
 }
 resize();renderer.render(scene,camera);node.classList.add("rf-webgl-ready");info.contexts++;info.loaded=true;
 return {play,pause,stop,setVisible(v){intersecting=v;if(v)play();else pause()}};
}
function scan(){
 const nodes=[...document.querySelectorAll(".rf-cinema-panels>.rf-cinema-scene")];
 for(const [el,state] of entries)if(!nodes.includes(el)){state.stop();entries.delete(el)}
 watchers?.disconnect();
 watchers=new IntersectionObserver(async items=>{
  for(const item of items){
   const el=item.target,idx=nodes.indexOf(el);
   if(idx<0)continue;
   if(!item.isIntersecting){entries.get(el)?.setVisible(false);continue}
   if(entries.has(el)){entries.get(el).setVisible(true);continue}
   if(el.dataset.rf3dAttempted)return;
   el.dataset.rf3dAttempted="true";
   let THREE;try{THREE=await loadThree()}catch{setStatus(el,"fallback");info.fallbacks++;continue}
   if(!el.isConnected)continue;
   try{const state=startScene(THREE,el,idx);entries.set(el,state);state.setVisible(true);setStatus(el,"live")}
   catch(err){setStatus(el,"fallback");info.fallbacks++;console.warn("3D fallback enabled",err)}
  }
 },{rootMargin:"120px 0px",threshold:.05});
 nodes.forEach(el=>watchers.observe(el));
}
function scheduleScan(){if(mutationQueued)return;mutationQueued=true;requestAnimationFrame(()=>{mutationQueued=false;scan()})}
const observer=new MutationObserver(changes=>{if(changes.some(c=>[...c.addedNodes,...c.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(".rf-cinema-panels")||n.querySelector?.(".rf-cinema-panels")))))scheduleScan()});
if(ROOT)observer.observe(ROOT,{childList:true,subtree:true});
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-rf-jump-scene]");if(!b)return;
 const n=Number(b.dataset.rfJumpScene);if(!Number.isInteger(n)||n<0||n>2)return;
 const el=document.querySelectorAll(".rf-cinema-scene")[n];if(el)el.scrollIntoView({behavior:prefersReduced.matches?"instant":"smooth",block:"start"})
});
document.addEventListener("visibilitychange",()=>{for(const [el,s] of entries) s.setVisible(!document.hidden&&el.getBoundingClientRect().bottom>0&&el.getBoundingClientRect().top<innerHeight)});
window.addEventListener("pagehide",()=>{for(const s of entries.values())s.stop();entries.clear()});
scheduleScan();
