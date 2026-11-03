import * as pc from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/+esm';

const canvas = document.getElementById('application-canvas');
const statusEl = document.getElementById('status');
const panel = document.getElementById('panel');
const setStatus = (message, show=true) => { statusEl.textContent=message; statusEl.classList.toggle('hidden',!show); };

const app = new pc.Application(canvas, {
  graphicsDeviceOptions: { antialias: false, powerPreference: 'high-performance' }
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.shadowType = pc.SHADOW_PCF3;
app.scene.gsplat.alphaClip = 0.4;

const camera = new pc.Entity('Viewer Camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.055,0.075,0.09), fov: 55, nearClip: 0.01, farClip: 100000
});
app.root.addChild(camera);

// A neutral ground plane gives the splat a visual reference and receives its shadows.
const floor = new pc.Entity('Ground Floor');
floor.addComponent('render', { type: 'plane' });
floor.setLocalScale(200, 1, 200);
floor.setLocalPosition(0, -1, 0);
const floorMaterial = new pc.StandardMaterial();
floorMaterial.diffuse = new pc.Color(0.22, 0.27, 0.30);
floorMaterial.metalness = 0;
floorMaterial.gloss = 8;
floorMaterial.useLighting = true;
floorMaterial.update();
floor.render.material = floorMaterial;
floor.render.receiveShadows = true;
floor.render.castShadows = false;
app.root.addChild(floor);

// Directional sunlight: GSplats cast shadows when both the splat and light enable it.
const sun = new pc.Entity('Shadow Sun');
sun.addComponent('light', {
  type: 'directional',
  color: new pc.Color(1, 0.94, 0.82),
  intensity: 1.6,
  castShadows: true,
  shadowResolution: 2048,
  shadowDistance: 150,
  normalOffsetBias: 0.05
});
sun.setLocalEulerAngles(45, 30, 0);
app.root.addChild(sun);

const target = new pc.Vec3(0,0,0);
let yaw=0, pitch=0.12, distance=3.5, dragging=false, button=0, lastX=0, lastY=0;
let currentAsset=null, currentEntity=null, objectUrl=null;
let isFlipped=false, orbiting=false;
let transformMode=null, dissolveProgress=1, dissolveFrom=1, dissolveTo=1, dissolveElapsed=0, dissolveAnimating=false;
const dissolveDuration=2.8, orbitSpeed=0.22;
let firstPerson=false, pointerLocked=false, fpYaw=0, fpPitch=0, moveForward=0, moveRight=0, moveVertical=0;
const fpSpeed=3.0, fpLookSpeed=0.0022;
const dissolveButton=document.getElementById('dissolve-reveal');
const dissolveReverseButton=document.getElementById('dissolve-out');
const dissolveResetButton=document.getElementById('dissolve-reset');
const firstPersonButton=document.getElementById('first-person-toggle');
const dissolveGLSL="uniform float uDissolveProgress;\nfloat vmHash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\nfloat vmNoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);\nfloat a=mix(vmHash31(i),vmHash31(i+vec3(1,0,0)),f.x);\nfloat b=mix(vmHash31(i+vec3(0,1,0)),vmHash31(i+vec3(1,1,0)),f.x);\nfloat c=mix(vmHash31(i+vec3(0,0,1)),vmHash31(i+vec3(1,0,1)),f.x);\nfloat d=mix(vmHash31(i+vec3(0,1,1)),vmHash31(i+vec3(1,1,1)),f.x);\nreturn mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}\nvoid modifySplatColor(vec3 center,inout vec4 color){\nfloat n=vmNoise3(center*0.72)*0.57+vmNoise3(center*1.51+vec3(17.0))*0.29+vmNoise3(center*3.13+vec3(41.0))*0.14;\nfloat edge=1.0-smoothstep(0.0,0.065,abs(n-uDissolveProgress));\nfloat visible=smoothstep(n-0.018,n+0.018,uDissolveProgress);\ncolor.rgb=mix(color.rgb,vec3(0.28,0.88,1.0)*1.65,edge*0.92);color.a*=max(visible,edge*0.82);}";
const dissolveWGSL="uniform uDissolveProgress: f32;\nfn vmHash31(p:vec3f)->f32{return fract(sin(dot(p,vec3f(127.1,311.7,74.7)))*43758.5453);}\nfn vmNoise3(p:vec3f)->f32{let i=floor(p);var f=fract(p);f=f*f*(vec3f(3.0)-2.0*f);\nlet a=mix(vmHash31(i),vmHash31(i+vec3f(1.0,0.0,0.0)),f.x);\nlet b=mix(vmHash31(i+vec3f(0.0,1.0,0.0)),vmHash31(i+vec3f(1.0,1.0,0.0)),f.x);\nlet c=mix(vmHash31(i+vec3f(0.0,0.0,1.0)),vmHash31(i+vec3f(1.0,0.0,1.0)),f.x);\nlet d=mix(vmHash31(i+vec3f(0.0,1.0,1.0)),vmHash31(i+vec3f(1.0,1.0,1.0)),f.x);return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);}\nfn modifySplatColor(center:vec3f,color:ptr<function,vec4f>){\nlet n=vmNoise3(center*0.72)*0.57+vmNoise3(center*1.51+vec3f(17.0))*0.29+vmNoise3(center*3.13+vec3f(41.0))*0.14;\nlet edge=1.0-smoothstep(0.0,0.065,abs(n-uniform.uDissolveProgress));\nlet visible=smoothstep(n-0.018,n+0.018,uniform.uDissolveProgress);\n(*color)=vec4f(mix((*color).rgb,vec3f(0.28,0.88,1.0)*1.65,edge*0.92),(*color).a*max(visible,edge*0.82));}";
const gsplatMaterial=app.scene.gsplat.material;
gsplatMaterial.getShaderChunks('glsl').set('gsplatModifyVS',dissolveGLSL);
gsplatMaterial.getShaderChunks('wgsl').set('gsplatModifyVS',dissolveWGSL);
gsplatMaterial.setParameter('uDissolveProgress',1.0);
gsplatMaterial.update();
const flipButton=document.getElementById('flip-splat');
const moveButton=document.getElementById('move-mode');
const rotateButton=document.getElementById('rotate-mode');
const transformOffButton=document.getElementById('transform-off');
const orbitButton=document.getElementById('orbit-toggle');
function applySplatOrientation() {
  if(!currentEntity)return;
  const e=currentEntity.getLocalEulerAngles();
  currentEntity.setLocalEulerAngles(isFlipped?180:0,e.y,e.z);
}
function setTransformMode(mode) {
  if(mode && !currentEntity) { setStatus('Load a splat before using Move or Rotate.'); return; }
  transformMode=mode;
  moveButton.classList.toggle('active',mode==='move');
  rotateButton.classList.toggle('active',mode==='rotate');
  transformOffButton.textContent=mode?'Exit '+mode+' mode':'Transform mode off';
  canvas.style.cursor=mode?'crosshair':'grab';
  setStatus(mode==='move'?'MOVE MODE — drag to move the splat in the camera plane':mode==='rotate'?'ROTATE MODE — drag to rotate the splat':'Viewer ready',!!mode);
}
function stopOrbit() {
  orbiting=false;
  orbitButton.classList.remove('active');
  orbitButton.textContent='▶ Start orbit';
}
function animateDissolve(reveal=true) {
  if(!currentEntity)return;
  dissolveFrom=dissolveProgress; dissolveTo=reveal?1:0; dissolveElapsed=0; dissolveAnimating=true;
  setStatus(reveal?'Revealing splats…':'Dissolving splats…');
}
function resetDissolve() {
  dissolveAnimating=false; dissolveProgress=1;
  gsplatMaterial.setParameter('uDissolveProgress',1.0);
  setStatus('Splat restored',false);
}
function enterFirstPerson() {
  if(firstPerson){document.exitPointerLock?.();return;}
  stopOrbit();setTransformMode(null);firstPerson=true;
  const e=camera.getEulerAngles();fpYaw=e.y*pc.math.DEG_TO_RAD;fpPitch=e.x*pc.math.DEG_TO_RAD;
  firstPersonButton.classList.add('active');firstPersonButton.textContent='Exit first person (Esc)';
  canvas.requestPointerLock?.();setStatus('FIRST PERSON — WASD to move, mouse to look');
}
function exitFirstPerson() {
  firstPerson=false;pointerLocked=false;firstPersonButton.classList.remove('active');
  firstPersonButton.textContent='Enter first person';moveForward=moveRight=moveVertical=0;
  if(document.pointerLockElement===canvas)document.exitPointerLock?.();
  canvas.style.cursor=transformMode?'crosshair':'grab';setStatus('First-person mode off',false);
}
function updateFirstPerson(dt) {
  if(!firstPerson)return;
  const forward=camera.forward.clone();forward.y=0;if(forward.lengthSq()>0)forward.normalize();
  const right=camera.right.clone();right.y=0;if(right.lengthSq()>0)right.normalize();
  const movement=forward.mulScalar(moveForward).add(right.mulScalar(moveRight));
  movement.y+=moveVertical;
  if(movement.lengthSq()>0){movement.normalize().mulScalar(fpSpeed*dt);camera.setPosition(camera.getPosition().clone().add(movement));}
  camera.setEulerAngles(fpPitch*pc.math.RAD_TO_DEG,fpYaw*pc.math.RAD_TO_DEG,0);
}

function updateCamera() {
  const cp=Math.cos(pitch);
  camera.setPosition(
    target.x+distance*Math.sin(yaw)*cp,
    target.y+distance*Math.sin(pitch),
    target.z+distance*Math.cos(yaw)*cp
  );
  camera.lookAt(target);
}
function resetView() { if(firstPerson)exitFirstPerson(); yaw=0; pitch=0.12; distance=3.5; if(currentEntity) target.copy(currentEntity.getPosition()); else target.set(0,0,0); updateCamera(); }
resetView();

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('click',()=>{if(firstPerson&&!pointerLocked)canvas.requestPointerLock?.();});
document.addEventListener('pointerlockchange',()=>{
  pointerLocked=document.pointerLockElement===canvas;
  if(firstPerson&&!pointerLocked)exitFirstPerson();
});
document.addEventListener('mousemove',e=>{
  if(!firstPerson||!pointerLocked)return;
  fpYaw-=e.movementX*fpLookSpeed;
  fpPitch=pc.math.clamp(fpPitch-e.movementY*fpLookSpeed,-1.52,1.52);
  camera.setEulerAngles(fpPitch*pc.math.RAD_TO_DEG,fpYaw*pc.math.RAD_TO_DEG,0);
});
window.addEventListener('keydown',e=>{
  if(!firstPerson)return;const k=e.key.toLowerCase();
  if(['w','a','s','d',' ','shift','control','e','q'].includes(k))e.preventDefault();
  if(k==='w')moveForward=1;if(k==='s')moveForward=-1;
  if(k==='d')moveRight=1;if(k==='a')moveRight=-1;
  if(k===' '||k==='e')moveVertical=1;if(k==='control'||k==='q')moveVertical=-1;
});
window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if((k==='w'&&moveForward>0)||(k==='s'&&moveForward<0))moveForward=0;
  if((k==='a'&&moveRight<0)||(k==='d'&&moveRight>0))moveRight=0;
  if([' ','e','q','control'].includes(k))moveVertical=0;
});
canvas.addEventListener('pointerdown',e=>{
  if(firstPerson)return;
  if(e.button!==0 && !transformMode)return;
  dragging=true; button=e.button; lastX=e.clientX; lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{
  if(firstPerson||!dragging)return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  if(transformMode && currentEntity) {
    if(transformMode==='move') {
      const scale=distance*0.0018;
      const p=currentEntity.getPosition().clone();
      p.add(camera.right.clone().mulScalar(dx*scale));
      p.add(camera.up.clone().mulScalar(-dy*scale));
      currentEntity.setPosition(p);
      target.copy(p); updateCamera();
    } else if(transformMode==='rotate') {
      const euler=currentEntity.getLocalEulerAngles();
      currentEntity.setLocalEulerAngles(euler.x+dy*0.45,euler.y+dx*0.45,euler.z);
    }
    return;
  }
  if(button===2 || e.shiftKey) {
    const scale=distance*0.0018;
    target.add(camera.right.clone().mulScalar(-dx*scale));
    target.add(camera.up.clone().mulScalar(dy*scale));
  } else {
    yaw-=dx*0.006;
    pitch=pc.math.clamp(pitch+dy*0.006,-1.48,1.48);
  }
  updateCamera();
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  distance=pc.math.clamp(distance*Math.exp(e.deltaY*0.001),0.08,100000);
  updateCamera();
},{passive:false});
canvas.addEventListener('dblclick',resetView);

async function loadSplat(url,label) {
  if(!url)return;
  exitFirstPerson();
  setStatus('Loading '+label+'…');
  const asset=new pc.Asset(label,'gsplat',{url});
  app.assets.add(asset);
  try {
    await new Promise((resolve,reject)=>{
      asset.once('load',resolve);
      asset.once('error',err=>reject(err||new Error('Splat load failed')));
      app.assets.load(asset);
    });
    if(currentEntity) currentEntity.destroy();
    if(currentAsset) { app.assets.remove(currentAsset); currentAsset.unload(); }
    currentAsset=asset;
    currentEntity=new pc.Entity(label);
    currentEntity.addComponent('gsplat',{asset, castShadows: document.getElementById('shadow-toggle').checked});
    app.root.addChild(currentEntity);
    isFlipped=false;
    flipButton.classList.remove('active');
    flipButton.setAttribute('aria-pressed','false');
    flipButton.disabled=false;
    dissolveButton.disabled=false;dissolveReverseButton.disabled=false;dissolveResetButton.disabled=false;
    moveButton.disabled=false;
    rotateButton.disabled=false;
    transformOffButton.disabled=false;
    orbitButton.disabled=false;
    moveButton.disabled=false; rotateButton.disabled=false; transformOffButton.disabled=false;
    stopOrbit();
    setTransformMode(null);
    applySplatOrientation();
    resetView();
    document.getElementById('filename').textContent=label;
    dissolveProgress=0;gsplatMaterial.setParameter('uDissolveProgress',0.0);animateDissolve(true);
  } catch(err) {
    console.error(err);
    app.assets.remove(asset);
    setStatus('Could not load file. Check format, URL and CORS permissions.');
  }
}
document.getElementById('file-input').addEventListener('change',e=>{
  const file=e.target.files?.[0]; if(!file)return;
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(file);
  loadSplat(objectUrl,file.name);
});
document.getElementById('load-url').addEventListener('click',()=>{
  const url=document.getElementById('url-input').value.trim();
  if(!url){setStatus('Enter a direct .ply or .sog file URL.');return;}
  loadSplat(url,url.split('/').pop().split('?')[0]||'Remote splat');
});
document.getElementById('url-input').addEventListener('keydown',e=>{
  if(e.key==='Enter')document.getElementById('load-url').click();
});
document.getElementById('load-demo').addEventListener('click',()=>{
  loadSplat('https://developer.playcanvas.com/assets/toy-cat.sog','PlayCanvas sample');
});
flipButton.addEventListener('click',()=>{
  if(!currentEntity)return;
  isFlipped=!isFlipped;
  applySplatOrientation();
  flipButton.classList.toggle('active',isFlipped);
  flipButton.setAttribute('aria-pressed',String(isFlipped));
  flipButton.textContent=isFlipped?'↕ Restore original orientation':'↕ Flip vertically';
});
dissolveButton.addEventListener('click',()=>animateDissolve(true));
dissolveReverseButton.addEventListener('click',()=>animateDissolve(false));
dissolveResetButton.addEventListener('click',resetDissolve);
firstPersonButton.addEventListener('click',enterFirstPerson);
moveButton.addEventListener('click',()=>setTransformMode(transformMode==='move'?null:'move'));
rotateButton.addEventListener('click',()=>setTransformMode(transformMode==='rotate'?null:'rotate'));
transformOffButton.addEventListener('click',()=>setTransformMode(null));
orbitButton.addEventListener('click',()=>{
  orbiting=!orbiting;
  orbitButton.classList.toggle('active',orbiting);
  orbitButton.textContent=orbiting?'Ⅱ Stop orbit':'▶ Start orbit';
  orbitButton.setAttribute('aria-pressed',String(orbiting));
  if(orbiting) { if(currentEntity) target.copy(currentEntity.getPosition()); setTransformMode(null); updateCamera(); setStatus('Camera orbiting — press Stop orbit to finish'); }
  else setStatus('Camera orbit stopped',false);
});
document.getElementById('floor-toggle').addEventListener('change',e=>{
  floor.enabled=e.target.checked;
});
document.getElementById('shadow-toggle').addEventListener('change',e=>{
  if(currentEntity?.gsplat) currentEntity.gsplat.castShadows=e.target.checked;
});
document.getElementById('reset-view').addEventListener('click',resetView);
document.getElementById('panel-toggle').addEventListener('click',()=>panel.classList.toggle('hidden'));
app.on('update',dt=>{
  if(dissolveAnimating&&currentEntity){
    dissolveElapsed+=dt;const t=pc.math.clamp(dissolveElapsed/dissolveDuration,0,1);
    const eased=t*t*(3-2*t);dissolveProgress=dissolveFrom+(dissolveTo-dissolveFrom)*eased;
    gsplatMaterial.setParameter('uDissolveProgress',dissolveProgress);
    if(t>=1){dissolveAnimating=false;setStatus(dissolveTo>0.5?'Splat revealed':'Splat dissolved',false);}
  }
  updateFirstPerson(dt);
  if(orbiting && !dragging && !firstPerson) { if(currentEntity) target.copy(currentEntity.getPosition()); yaw += orbitSpeed * dt; updateCamera(); }
});
app.on('error',err=>{console.error(err);setStatus('Viewer error. Check browser console.');});
app.start();
window.addEventListener('resize',()=>app.resizeCanvas());
setStatus('Viewer ready — load a splat to begin.',false);
// Camera navigation tools are available before a splat is loaded.
orbitButton.disabled=false;moveButton.disabled=false;rotateButton.disabled=false;transformOffButton.disabled=false;