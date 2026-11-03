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
let isFlipped=false, materialiseElapsed=-1;
const materialiseDuration=1.65;
const flipButton=document.getElementById('flip-splat');
const replayButton=document.getElementById('replay-materialise');

function applySplatOrientation() {
  if(!currentEntity)return;
  currentEntity.setLocalEulerAngles(isFlipped?180:0,0,0);
}
function playMaterialise() {
  if(!currentEntity)return;
  materialiseElapsed=0;
  currentEntity.setLocalScale(0.001,0.001,0.001);
  setStatus('Materialising splat…');
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
function resetView() { yaw=0; pitch=0.12; distance=3.5; target.set(0,0,0); updateCamera(); }
resetView();

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  dragging=true; button=e.button; lastX=e.clientX; lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
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
    replayButton.disabled=false;
    applySplatOrientation();
    resetView();
    document.getElementById('filename').textContent=label;
    playMaterialise();
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
replayButton.addEventListener('click',playMaterialise);
document.getElementById('floor-toggle').addEventListener('change',e=>{
  floor.enabled=e.target.checked;
});
document.getElementById('shadow-toggle').addEventListener('change',e=>{
  if(currentEntity?.gsplat) currentEntity.gsplat.castShadows=e.target.checked;
});
document.getElementById('reset-view').addEventListener('click',resetView);
document.getElementById('panel-toggle').addEventListener('click',()=>panel.classList.toggle('hidden'));
app.on('update',dt=>{
  if(materialiseElapsed<0 || !currentEntity)return;
  materialiseElapsed+=dt;
  const t=Math.min(materialiseElapsed/materialiseDuration,1);
  // Ease-out-back gives the splat a soft, physical "assembling into place" finish.
  const overshoot=1.35, x=t-1;
  const eased=1+(overshoot+1)*x*x*x+overshoot*x*x;
  const scale=0.001+(Math.max(0,eased)*0.999);
  currentEntity.setLocalScale(scale,scale,scale);
  if(t>=1){
    currentEntity.setLocalScale(1,1,1);
    materialiseElapsed=-1;
    setStatus('Splat loaded');
    setTimeout(()=>setStatus('',false),900);
  }
});
app.on('error',err=>{console.error(err);setStatus('Viewer error. Check browser console.');});
app.start();
window.addEventListener('resize',()=>app.resizeCanvas());
setStatus('Viewer ready — load a splat to begin.');