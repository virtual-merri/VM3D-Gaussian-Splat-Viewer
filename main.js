import * as pc from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/+esm';
import { TranslateGizmo } from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas/src/extras/gizmo/translate-gizmo.js/+esm';
import { RotateGizmo } from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas/src/extras/gizmo/rotate-gizmo.js/+esm';
import { Gizmo } from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/build/playcanvas/src/extras/gizmo/gizmo.js/+esm';
import { GSplatRevealRadial } from 'https://cdn.jsdelivr.net/npm/playcanvas@2.23.3/scripts/esm/gsplat/reveal-radial.mjs/+esm';

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
let activeGizmo=null, translateGizmo=null, rotateGizmo=null;
const orbitSpeed=0.22;
const flipButton=document.getElementById('flip-splat');
const replayButton=document.getElementById('replay-materialise');
const moveButton=document.getElementById('move-mode');
const rotateButton=document.getElementById('rotate-mode');
const transformOffButton=document.getElementById('transform-off');
const orbitButton=document.getElementById('orbit-toggle');
const gizmoLayer=Gizmo.createLayer(app);
translateGizmo=new TranslateGizmo(camera.camera,gizmoLayer);
rotateGizmo=new RotateGizmo(camera.camera,gizmoLayer);
translateGizmo.enabled=false;
rotateGizmo.enabled=false;
translateGizmo.size=1.35;
rotateGizmo.size=1.35;
translateGizmo.coordSpace='world';
rotateGizmo.coordSpace='world';

function applySplatOrientation() {
  if(!currentEntity)return;
  currentEntity.setLocalEulerAngles(isFlipped?180:0,0,0);
}
function setTransformMode(mode) {
  activeGizmo=mode==='move'?translateGizmo:mode==='rotate'?rotateGizmo:null;
  translateGizmo.enabled=activeGizmo===translateGizmo;
  rotateGizmo.enabled=activeGizmo===rotateGizmo;
  moveButton.classList.toggle('active',activeGizmo===translateGizmo);
  rotateButton.classList.toggle('active',activeGizmo===rotateGizmo);
  transformOffButton.textContent=activeGizmo?'Hide transform widget':'Transform widget hidden';
}
function stopOrbit() {
  orbiting=false;
  orbitButton.classList.remove('active');
  orbitButton.textContent='▶ Start orbit';
}
function playMaterialise() {
  if(!currentEntity)return;
  if(currentEntity.script) currentEntity.script.destroy();
  currentEntity.addComponent('script');
  const reveal=currentEntity.script.create(GSplatRevealRadial);
  if(reveal) {
    reveal.center.set(0,0,0);
    reveal.speed=3.2;
    reveal.acceleration=0;
    reveal.delay=0;
    reveal.oscillationIntensity=0.12;
    reveal.endRadius=18;
    setStatus('Materialising from the centre…');
  } else setStatus('Splat loaded');
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
function resetView() { yaw=0; pitch=0.12; distance=3.5; if(currentEntity) target.copy(currentEntity.getPosition()); else target.set(0,0,0); updateCamera(); }
resetView();

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(activeGizmo)return;
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
    if(currentEntity) { translateGizmo.detach(); rotateGizmo.detach(); currentEntity.destroy(); }
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
    moveButton.disabled=false;
    rotateButton.disabled=false;
    transformOffButton.disabled=false;
    orbitButton.disabled=false;
    stopOrbit();
    setTransformMode(null);
    translateGizmo.attach([currentEntity]);
    rotateGizmo.attach([currentEntity]);
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
moveButton.addEventListener('click',()=>setTransformMode(activeGizmo===translateGizmo?null:'move'));
rotateButton.addEventListener('click',()=>setTransformMode(activeGizmo===rotateGizmo?null:'rotate'));
transformOffButton.addEventListener('click',()=>setTransformMode(null));
orbitButton.addEventListener('click',()=>{
  orbiting=!orbiting;
  orbitButton.classList.toggle('active',orbiting);
  orbitButton.textContent=orbiting?'Ⅱ Stop orbit':'▶ Start orbit';
  if(orbiting) { if(currentEntity) target.copy(currentEntity.getPosition()); setTransformMode(null); updateCamera(); }
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
  if(orbiting && !dragging) { if(currentEntity) target.copy(currentEntity.getPosition()); yaw += orbitSpeed * dt; updateCamera(); }
});
app.on('error',err=>{console.error(err);setStatus('Viewer error. Check browser console.');});
app.start();
window.addEventListener('resize',()=>app.resizeCanvas());
setStatus('Viewer ready — load a splat to begin.');