(function(){
"use strict";
let lastNode=null;
function mount(){
 const node=document.getElementById("rf-3d-canvas");
 if(!node||node===lastNode)return;
 lastNode=node;
 const gl=node.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:"low-power"});
 if(!gl)return;
 const vertex=String.raw`attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=(a_position+1.0)*0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
 const fragment=String.raw`precision highp float;varying vec2 v_uv;
 uniform vec2 u_res;uniform float u_time;
 float goldline(vec2 p,float theta,float rx,float ry){
  float cs=cos(theta),sn=sin(theta);
  vec2 q=vec2(cs*p.x-sn*p.y,sn*p.x+cs*p.y);
  float dis=abs(length(q/vec2(rx,ry))-1.0);
  return exp(-pow(dis*135.0,1.3));
 }
 void main(){
  vec2 p=(v_uv*2.0-1.0);
  p.x*=u_res.x/u_res.y;
  float t=u_time*0.12;
  p.y+=0.012*sin(t*2.0);
  vec3 bg=vec3(0.0);float alpha=0.0;
  float h1=goldline(p,-0.26+t*0.17,0.82,0.29);
  float h2=goldline(p,0.40-t*0.06,0.77,0.32);
  float h3=goldline(p,1.12+t*0.1,0.56,0.86);
  float halo=0.018/(abs(length(p)-0.76)+0.15);
  bg+=vec3(.04,.5,.42)*(h1*.64+h2*.3)+vec3(.65,.46,.19)*h3*.18;
  alpha+=max(h1*.58,max(h2*.24,h3*.20));
  alpha+=halo*.17;
  vec2 sphere=p-vec2(.02,.01);float radius=.69;
  float q=dot(sphere,sphere)/(radius*radius);
  if(q<1.0){
   float z=sqrt(1.0-q);
   vec3 n=normalize(vec3(sphere/radius,z));
   float a=sin(t)*.23;
   mat3 rot=mat3(cos(a),0.0,sin(a),0.0,1.0,0.0,-sin(a),0.0,cos(a));
   vec3 nr=rot*n;
   vec3 lightDir=normalize(vec3(-.65,.9,1.45));
   float diff=max(dot(n,lightDir),0.0);
   float side=max(dot(n,normalize(vec3(.75,-.4,.6))),0.0);
   float rim=pow(1.0-z,3.5);
   float fres=pow(1.0-z,1.7);
   float wave=sin(16.0*nr.y+6.0*sin(nr.x*4.0+t)+t*1.3);
   float marble=sin(nr.x*9.0+nr.y*18.0+3.0*sin(nr.y*3.0-t));
   float threads=smoothstep(.86,1.0,marble)*.13;
   vec3 col=mix(vec3(.014,.080,.108),vec3(.11,.41,.38),diff*.72);
   col+=vec3(.035,.17,.16)*wave*.22;
   col+=vec3(.12,.62,.54)*threads;
   col+=vec3(.61,.91,.76)*pow(diff,6.0)*.55;
   col+=vec3(.08,.32,.29)*side*.37;
   col+=vec3(.49,.95,.74)*rim*.58;
   col+=vec3(.78,.55,.27)*pow(max(dot(n,normalize(vec3(.57,-.55,1.0))),0.0),14.0)*.42;
   float spec=pow(max(dot(reflect(-lightDir,n),vec3(0.,0.,1.)),0.0),47.0);
   col+=vec3(.78,.98,.91)*spec*.75;
   float metalLine=smoothstep(.98,1.0,sin(nr.x*11.0+nr.y*8.0+t*.4));
   col+=vec3(.45,.82,.72)*metalLine*.09*z;
   bg=col;
   alpha=1.0;
  }
  float edge=1.0-smoothstep(.87,1.02,length(p));
  float aout=clamp(alpha*edge,0.0,1.0);
  gl_FragColor=vec4(bg,aout);
 }`;
 const shader=(type,code)=>{const x=gl.createShader(type);gl.shaderSource(x,code);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)){gl.deleteShader(x);return null}return x};
 const v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment);
 if(!v||!f)return;
 const program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 gl.useProgram(program);
 const a=gl.getAttribLocation(program,"a_position");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 const ur=gl.getUniformLocation(program,"u_res"),ut=gl.getUniformLocation(program,"u_time");
 let last=0,visible=true;
 node.parentElement?.classList.add("has-webgl");
 const watcher=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(e=>{visible=e[0]?.isIntersecting!==false},{threshold:.02}):null;
 if(watcher)watcher.observe(node);
 const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 const small=window.matchMedia?.("(max-width: 760px)")?.matches||false;
 const target=small?35:55;
 function frame(ts){
  if(!document.contains(node)){watcher?.disconnect();lastNode=null;return}
  requestAnimationFrame(frame);
  if(!visible||document.visibilityState==="hidden")return;
  if(ts-last<1000/target&&!reduce)return;
  if(reduce&&last>0)return;
  last=ts;
  const rect=node.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,small?1.15:1.6);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(node.width!==w||node.height!==h){node.width=w;node.height=h;gl.viewport(0,0,w,h)}
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(ur,w,h);gl.uniform1f(ut,reduce?0:ts/1000);
  gl.drawArrays(gl.TRIANGLES,0,6);
 }
 requestAnimationFrame(frame);
}
window.RFSCENE={mount};
})();