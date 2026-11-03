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

const camera = new pc.Entity('Viewer Camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.055,0.075,0.09), fov: 55, nearClip: 0.01, farClip: 100000
});
app.root.addChild(camera);

const target = new pc.Vec3(0,0,0);
let yaw=0, pitch=0.12, distance=3.5, dragging=false, button=0, lastX=0, lastY=0;
let currentAsset=null, currentEntity=null, objectUrl=null;

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
    currentEntity.addComponent('gsplat',{asset});
    app.root.addChild(currentEntity);
    resetView();
    document.getElementById('filename').textContent=label;
    setStatus('Splat loaded');
    setTimeout(()=>setStatus('',false),1400);
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
document.getElementById('reset-view').addEventListener('click',resetView);
document.getElementById('panel-toggle').addEventListener('click',()=>panel.classList.toggle('hidden'));
app.on('error',err=>{console.error(err);setStatus('Viewer error. Check browser console.');});
app.start();
window.addEventListener('resize',()=>app.resizeCanvas());
setStatus('Viewer ready — load a splat to begin.');