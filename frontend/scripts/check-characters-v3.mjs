import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const executablePath=process.env.MEMORYBOX_BROWSER||[
  resolve(process.env.LOCALAPPDATA||'','ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p=>existsSync(p));
const base=process.env.MEMORYBOX_URL||'http://127.0.0.1:5173';
const directory=resolve('..','artifacts','qa-v3');await mkdir(directory,{recursive:true});
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#e8e4dc;color:#504b43;font-family:Arial}canvas{display:block}
#labels{position:fixed;bottom:24px;left:4%;width:92%;display:flex;justify-content:space-around;font-size:20px}
</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head>
<body><div id="labels"><span>青年男性</span><span>长者男性</span><span>青年女性</span><span>长者女性</span></div><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e4dc');
const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.01,100);
camera.position.set(0,1.14,6.1);camera.lookAt(0,.88,0);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fff2de','#6b706a',1.1));
const light=new THREE.DirectionalLight('#fff5e2',2.7);light.position.set(-3,5,5);scene.add(light);
const fill=new THREE.DirectionalLight('#d7e4f5',.8);fill.position.set(4,2,-2);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#d1cec4',roughness:1}));
floor.rotation.x=-Math.PI/2;scene.add(floor);
const ids=['young-man','elder-man','young-woman','elder-woman'];const heights=[1.78,1.72,1.66,1.64];
const seated=location.search.includes('seated');
for(let i=0;i<ids.length;i++){
  const model=(await new GLTFLoader().loadAsync('/assets/models/'+ids[i]+(seated?'-seated':'')+'.glb')).scene;
  const mats=new Map();model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.set(m.uuid,m);});
  for(const m of mats.values()){
    if(m.name==='skin'){
      m.map=await new THREE.TextureLoader().loadAsync('/assets/models/skins/'+ids[i]+'.webp');m.color.set('#fff');m.roughness=.67;
    }else if(m.name.startsWith('cc0:')){
      const id=m.name.slice(4);m.map=await new THREE.TextureLoader().loadAsync('/assets/models/materials/'+id+'-color.webp');
      if(['male_casualsuit01','male_casualsuit03','female_elegantsuit01','elder-shirt','shoes04'].includes(id)){
        m.normalMap=await new THREE.TextureLoader().loadAsync('/assets/models/materials/'+id+'-normal.webp');m.normalMap.flipY=true;m.normalScale.set(.48,.48);
      }
    }
    if(m.map){m.map.flipY=true;m.map.colorSpace=THREE.SRGBColorSpace;}m.needsUpdate=true;
  }
  model.position.x=(i-1.5)*1.20;scene.add(model);
}
renderer.render(scene,camera);window.previewReady=true;
window.reviewFace=i=>{document.getElementById('labels').style.display='none';const x=(i-1.5)*1.20,y=heights[i]-.13;camera.position.set(x+.09,y,.74);camera.lookAt(x,y-.015,.015);renderer.render(scene,camera);};
</script></body></html>`;
const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/character-v3-review.html*',route=>route.fulfill({contentType:'text/html',body:html}));
  for(const pose of ['standing','seated']){
    await page.goto(base+'/character-v3-review.html?pose='+pose);
    await page.waitForFunction(()=>window.previewReady===true,{},{timeout:60_000});
    await page.screenshot({path:resolve(directory,'characters-v3-'+pose+'.png')});
    if(pose==='standing')for(let i=0;i<4;i++){
      await page.evaluate(i=>window.reviewFace(i),i);
      await page.screenshot({path:resolve(directory,'character-v3-face-'+i+'.png')});
    }
  }
  if(errors.length)throw Error(errors.join('\n'));console.log('Rendered all eight GLBs and four close-ups with all runtime materials.');
}finally{await browser.close();}
