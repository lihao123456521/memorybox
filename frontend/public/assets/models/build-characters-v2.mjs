/** Offline asset build. MakeHuman graphical inputs: CC0; all assembly code: project original. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';

const dir=path.dirname(fileURLToPath(import.meta.url));
globalThis.FileReader=class { result=null; onloadend=null; onerror=null; readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();}).catch(e=>this.onerror?.(e));} readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+blob.type+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});} };
const vertices=[], faces=[], uvs=[], uvByVertex=[], groups=new Map();let group='';
for(const line of fs.readFileSync(path.join(dir,'makehuman-base.obj'),'utf8').split(/\r?\n/)){
  const p=line.trim().split(/\s+/);
  if(p[0]==='v')vertices.push(p.slice(1).map(Number));
  if(p[0]==='vt')uvs.push(p.slice(1,3).map(Number));
  if(p[0]==='g'){group=p[1];if(!groups.has(group))groups.set(group,[]);}
  if(p[0]==='f'){const tuples=p.slice(1).map(v=>v.split('/').map(Number));const indices=tuples.map(v=>v[0]-1);groups.get(group).push(...indices);if(group==='body'){for(const [v,uv] of tuples)if(!uvByVertex[v-1])uvByVertex[v-1]=uvs[uv-1];for(let i=1;i<indices.length-1;i++)faces.push([indices[0],indices[i],indices[i+1]]);}}
}
const sourceBodyIds=[...new Set(faces.flat())];
const presets=[
  {id:'young-man',target:'asian-male-young',height:1.78,skin:'#c99f85',shirt:'#8aabb4',pants:'#3d4d58',hair:'#282622',elder:false,female:false},
  {id:'elder-man',target:'asian-male-old',height:1.72,skin:'#c3a089',shirt:'#b3ab95',pants:'#535349',hair:'#c1bdb3',elder:true,female:false},
  {id:'young-woman',target:'asian-female-young',height:1.66,skin:'#d7af98',shirt:'#a86e61',pants:'#4c5552',hair:'#302a26',elder:false,female:true},
  {id:'elder-woman',target:'asian-female-old',height:1.64,skin:'#c7a28a',shirt:'#7e9283',pants:'#535249',hair:'#b7b5ad',elder:true,female:true},
];
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
const vec=p=>new THREE.Vector3(...p);
const material=(name,color,roughness=.83)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness:0});
function sphere(name,p,s,mat,segments=28){const m=new THREE.Mesh(new THREE.SphereGeometry(1,segments,20),mat);m.name=name;m.position.set(...p);m.scale.set(...s);m.castShadow=true;m.receiveShadow=true;return m;}
function curve(name,points,radius,mat){const c=new THREE.CatmullRomCurve3(points.map(vec));const m=new THREE.Mesh(new THREE.TubeGeometry(c,14,radius,7,false),mat);m.name=name;return m;}
function indexedGeometry(coords,indices){const used=[...new Set(indices)],map=new Map(used.map((id,i)=>[id,i]));const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(used.flatMap(id=>Array.from(coords.slice(id*3,id*3+3))),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(used.flatMap(id=>uvByVertex[id]||[0,0]),2));geo.setIndex(indices.map(id=>map.get(id)));geo.computeVertexNormals();return geo;}
function create(preset,seated){
  const points=vertices.map(v=>[...v]);
  for(const line of fs.readFileSync(path.join(dir,'source',preset.target+'.target'),'utf8').split(/\r?\n/)){
    if(!/^\d/.test(line))continue;const [id,x,y,z]=line.trim().split(/\s+/).map(Number);points[id][0]+=x;points[id][1]+=y;points[id][2]+=z;
  }
  const minY=Math.min(...sourceBodyIds.map(i=>points[i][1])), maxY=Math.max(...sourceBodyIds.map(i=>points[i][1]));const scale=preset.height/(maxY-minY);
  const marker=name=>{const ids=[...new Set(groups.get(name))];return [0,1,2].map(a=>ids.reduce((s,i)=>s+points[i][a],0)/ids.length);};
  const shoulderL=marker('joint-l-shoulder'), shoulderR=marker('joint-r-shoulder');
  const raw=points.map(([x,y,z])=>[x*scale,(y-minY)*scale,z*scale]);
  const hipY=(marker('joint-pelvis')[1]-minY)*scale-.025;
  const kneeY=(marker('joint-l-knee')[1]-minY)*scale;
  const seatOffset=seated?hipY-.465:0;
  const transform=(p,arm=true)=>{
    let [x,y,z]=p;
    const isLeg=p[1]<hipY+.06&&Math.abs(p[0])<.32;
    if(arm){const shoulder=(x>=0?shoulderL:shoulderR).map((v,a)=>a===1?(v-minY)*scale:v*scale);const lowerMask=Math.abs(x)>Math.abs(shoulder[0])+.12?1:smooth(hipY-.06,hipY+.08,y);const w=smooth(Math.abs(shoulder[0])-.045,Math.abs(shoulder[0])+.065,Math.abs(x))*(1-smooth(shoulder[1]+.02,shoulder[1]+.12,y))*lowerMask;if(w>0){const a=(x>=0?-.69:.69)*w,dx=x-shoulder[0],dy=y-shoulder[1];x=shoulder[0]+dx*Math.cos(a)-dy*Math.sin(a);y=shoulder[1]+dx*Math.sin(a)+dy*Math.cos(a);z+=.012*w;if(seated){const bend=smooth(Math.abs(shoulder[0])+.09,Math.abs(shoulder[0])+.25,Math.abs(p[0]))*w;z+=.18*bend;y+=.11*bend;}}}
    // Preserve an anatomically sensible stance instead of the source editing A-pose.
    const legWeight=isLeg?1-smooth(hipY-.10,hipY+.04,y):0;x*=1-legWeight*.13;
    if(seated){const w=isLeg?1-smooth(hipY-.025,hipY+.06,y):0;if(w>0){const below=Math.max(0,kneeY-y);const thigh=Math.min(hipY-y,hipY-kneeY);const posedY=hipY-below;const posedZ=z+Math.max(0,thigh);y=THREE.MathUtils.lerp(y,posedY,w);z=THREE.MathUtils.lerp(z,posedZ,w);}y-=seatOffset;}
    return [x,y,z];
  };
  const positions=raw.map(v=>transform(v));
  if(process.env.CHARACTER_DEBUG==='1'){const outer=sourceBodyIds.reduce((best,i)=>positions[i][0]>positions[best][0]?i:best,sourceBodyIds[0]);console.log('ANATOMY',preset.id,{shoulderL,rawShoulderY:(shoulderL[1]-minY)*scale,outer,raw:raw[outer],posed:positions[outer],hand:marker('joint-l-hand')});}
  const root=new THREE.Group();root.name=preset.id+(seated?'-seated':'');
  root.userData={source:'MakeHuman CC0 hm08 + official Asian age/sex target',unit:'meter',height:preset.height,pose:seated?'seated':'standing',fullyClothed:true};
  const mats={skin:material('skin',preset.skin,.72),shirt:material('woven long-sleeve shirt',preset.shirt,.94),pants:material('loose woven trousers',preset.pants,.98),shoe:material('leather walking shoes','#3d3833',.62),hair:material('hair',preset.hair,.9),lip:material('natural lips',preset.elder?'#a78377':'#b58477',.75),eye:material('eye whites','#e5dfd4',.3),iris:material('dark brown iris','#3a3028',.38),pupil:material('pupil','#171817',.2),button:material('shirt buttons','#d1cbbd',.66)};
  const categories={skin:[],shirt:[],pants:[],shoe:[],lip:[]};
  const collarY=(marker('joint-neck')[1]-minY)*scale-.015;
  const shoulderY=(shoulderL[1]-minY)*scale;
  const hemY=hipY-.09;
  const wristX=Math.abs(marker('joint-l-hand')[0])*scale-.008;
  for(const tri of faces){const center=[0,1,2].map(a=>tri.reduce((s,i)=>s+raw[i][a],0)/3);const sourceCenter=[0,1,2].map(a=>tri.reduce((s,i)=>s+points[i][a],0)/3);let category='skin';
    if(center[1]<hipY+.025)category=center[1]<.115?'shoe':'pants';
    else if(center[1]<collarY&&Math.abs(center[0])<wristX)category='shirt';
    // Clothing has its own continuous surface; cropped body triangles leave ragged seams.
    if(category==='shirt')continue;
    if(category==='shoe')continue;
    if(category==='pants'&&seated)continue;
    categories[category].push(...tri);
  }
  const shirtRadius=preset.female?.19:.212;
  const shirtHem=seated?hipY+.035:hemY;
  // Fit the lower garment to this age/sex shape, including the trousers' added ease.
  // The original arm vertices lie outside this torso band and must not widen the hem.
  const fitTorsoRing=(y,minimum)=>sourceBodyIds.reduce((radius,id)=>{
    const [x,bodyY,z]=raw[id];
    if(Math.abs(x)>=.3||Math.abs(bodyY-y)>.045)return radius;
    return Math.max(radius,Math.hypot(x*1.055,(z*1.04+.004-.022)/.69)+.012);
  },minimum);
  const lowerProfile=[[shirtRadius*.91,shirtHem],[shirtRadius*.94,hipY+.065],[shirtRadius*.86,hipY+.16]].map(([radius,y])=>[fitTorsoRing(y,radius),y]);
  const shirtProfile=[...lowerProfile,[shirtRadius,shoulderY-.16],[shirtRadius*1.035,shoulderY-.025],[.062,collarY+.006]].map(([radius,y])=>new THREE.Vector2(radius,y-seatOffset));
  const torso=new THREE.Mesh(new THREE.LatheGeometry(shirtProfile,48),mats.shirt);torso.name='loose opaque tailored shirt torso';torso.scale.z=.69;torso.position.z=.022;torso.castShadow=true;torso.receiveShadow=true;root.add(torso);
  const hem=new THREE.Mesh(new THREE.TorusGeometry(lowerProfile[0][0],.004,8,48),mats.shirt);hem.name='continuous sewn shirt hem';hem.rotation.x=Math.PI/2;hem.scale.y=.69;hem.position.set(0,shirtHem-seatOffset,.022);root.add(hem);
  const neckband=new THREE.Mesh(new THREE.TorusGeometry(.061,.010,10,40),mats.shirt);neckband.name='continuous shirt neckline';neckband.rotation.x=Math.PI/2;neckband.scale.y=.69;neckband.position.set(0,collarY+.009-seatOffset,.022);root.add(neckband);
  for(const side of ['l','r']){
    const joint=name=>vec(transform(marker('joint-'+side+'-'+name).map((v,a)=>a===1?(v-minY)*scale:v*scale)));
    const shoulder=joint('shoulder'),elbow=joint('elbow'),wrist=joint('hand');
    shoulder.x*=.94; // Bury the sleeve root inside the separate shirt body.
    const outward=wrist.clone().sub(elbow).normalize();
    const cuff=wrist.clone().addScaledVector(outward,.010);
    const path=new THREE.CatmullRomCurve3([shoulder,elbow,cuff]);
    const segments=24,radial=20,geometry=new THREE.TubeGeometry(path,segments,1,radial,false);
    const coords=geometry.attributes.position,normals=geometry.attributes.normal;
    const shoulderRadius=preset.female?.060:.066,cuffRadius=preset.female?.036:.040;
    for(let ring=0;ring<=segments;ring++){
      const t=ring/segments,center=path.getPointAt(t);
      const radius=THREE.MathUtils.lerp(shoulderRadius,cuffRadius,smooth(0,1,t));
      for(let slice=0;slice<=radial;slice++){
        const i=ring*(radial+1)+slice;
        coords.setXYZ(i,center.x+normals.getX(i)*radius,center.y+normals.getY(i)*radius,center.z+normals.getZ(i)*radius);
      }
    }
    geometry.computeVertexNormals();
    const sleeve=new THREE.Mesh(geometry,mats.shirt);sleeve.name='continuous tailored long sleeve '+side;sleeve.castShadow=true;sleeve.receiveShadow=true;root.add(sleeve);
    root.add(sphere('rounded tailored shoulder cap '+side,shoulder.toArray(),[shoulderRadius*1.015,shoulderRadius*1.015,shoulderRadius*1.015],mats.shirt));
    const cuffSeam=new THREE.Mesh(new THREE.TorusGeometry(cuffRadius,.0035,8,radial),mats.shirt);cuffSeam.name='closed sewn sleeve cuff '+side;cuffSeam.position.copy(cuff);cuffSeam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),path.getTangentAt(1));root.add(cuffSeam);
  }
  for(const [category,indices] of Object.entries(categories)){
    if(!indices.length)continue;const p=new Float32Array(positions.flat());
    for(const id of sourceBodyIds){let [x,y,z]=positions[id];if(category==='pants'){x*=1.055;z=z*1.04+.004;if(Math.abs(raw[id][0])<.075&&raw[id][1]>.69&&raw[id][1]<hipY+.05)z=Math.min(z,.105+(seated?.15:0));}if(category==='shoe'){x*=1.04;z+=.008;}p.set([x,y,z],id*3);}
    const geo=indexedGeometry(p,indices);const mesh=new THREE.Mesh(geo,mats[category]);mesh.name=category==='skin'?'anatomical face neck and articulated fingers':category==='shirt'?'opaque long sleeve shirt and collar':'opaque '+category;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  // Eyes sit inside the source mesh's actual eyelid rims; no oversized toy eyes.
  for(const side of ['l','r']){const center=marker('joint-'+side+'-eye').map((v,a)=>a===1?(v-minY)*scale:v*scale);const eye=transform(center,false);const radius=.119*scale;
    root.add(sphere(side+' eyeball',eye,[radius,radius,radius],mats.eye));
    root.add(sphere(side+' brown iris',[eye[0],eye[1],eye[2]+radius*.91],[radius*.48,radius*.48,radius*.12],mats.iris));
    root.add(sphere(side+' pupil',[eye[0],eye[1],eye[2]+radius*1.015],[radius*.22,radius*.22,radius*.06],mats.pupil));
    root.add(sphere(side+' eye catchlight',[eye[0]-radius*.12,eye[1]+radius*.2,eye[2]+radius*1.07],[radius*.07,radius*.07,radius*.025],mats.eye,12));
    const ey=eye[1]+radius*1.65;root.add(curve(side+' eyebrow',[[eye[0]-.019,ey-.002,eye[2]+.026],[eye[0],ey+.0015,eye[2]+.028],[eye[0]+.018,ey-.003,eye[2]+.024]],preset.elder?.0011:.0014,mats.hair));
  }
  // Hair follows the detailed scalp, keeping ear and facial topology unobscured.
  const hairIndices=[];
  const eyeRaw=marker('joint-l-eye').map((v,a)=>a===1?(v-minY)*scale:v*scale);
  for(const tri of faces){const c=[0,1,2].map(a=>tri.reduce((s,i)=>s+raw[i][a],0)/3);const frontLine=eyeRaw[1]+(preset.elder&&!preset.female?.102:.048);const cap=c[1]>frontLine||(c[1]>eyeRaw[1]-.054&&c[2]<eyeRaw[2]-.025);const ear=Math.abs(c[0])>.077*preset.height/1.72&&c[1]<eyeRaw[1]+.005;if(cap&&!ear)hairIndices.push(...tri);}
  const hp=new Float32Array(positions.flat());for(const i of sourceBodyIds){hp[i*3]*=1.045;hp[i*3+1]+=.004;hp[i*3+2]=(hp[i*3+2]-.025)*1.05+.025;}const hairGeo=indexedGeometry(hp,hairIndices);const hair=new THREE.Mesh(hairGeo,mats.hair);hair.name='scalp fitted hair';root.add(hair);
  const head=transform(marker('joint-head').map((v,a)=>a===1?(v-minY)*scale:v*scale),false);const headTop=preset.height-seatOffset;
  if(preset.female){root.add(sphere(preset.elder?'silver hair bun':'shoulder length hair back',[0,head[1]+.036,head[2]-.062],preset.elder?[.049,.054,.047]:[.076,.123,.063],mats.hair));}
  for(let i=0;i<28;i++){const a=i/(27)*Math.PI*1.75+.39;const radius=.076;const yy=headTop-.015;const depth=head[2]+Math.cos(a)*.067;const xx=Math.sin(a)*radius;const endY=head[1]+(preset.female&&!preset.elder?-.075:.026);if(depth>head[2]+.045&&preset.elder&&!preset.female)continue;root.add(curve('individual swept hair lock '+i,[[xx*.24,yy,head[2]],[xx*.79,yy-.03,depth*.85],[xx,endY,depth]],.0011,material('strand '+i,new THREE.Color(preset.hair).offsetHSL(0,0,(i%3-1)*.025))));}
  // Collars, button placket, cuffs and soles make the covering read as clothing.
  const frontZ=shirtRadius*.69+.028;const cY=collarY-seatOffset;
  for(const s of [-1,1]){root.add(curve('folded shirt collar '+s,[[s*.026,cY+.007,.061],[s*.055,cY-.024,.095],[s*.035,cY-.071,.125]],.006,mats.shirt));}
  for(let i=0;i<5;i++){const yy=collarY-.10-i*.065;if(yy<hipY+.035)continue;root.add(sphere('shirt button '+i,[0,yy-seatOffset,frontZ],[.0036,.0036,.002],mats.button,12));}
  for(const side of ['l','r']){const ankle=transform(marker('joint-'+side+'-ankle').map((v,a)=>a===1?(v-minY)*scale:v*scale),false);const x=ankle[0],z=ankle[2]+.077;root.add(sphere('fully enclosed leather shoe '+side,[x,.058,z],[.055,.053,.125],mats.shoe));root.add(sphere('solid shoe sole '+side,[x,.016,z],[.058,.014,.133],mats.shoe));root.add(sphere('shoe tongue '+side,[x,.098,z-.055],[.043,.024,.055],mats.shoe));}
  if(seated){root.add(sphere('opaque seated trouser pelvis',[0,.48,.025],[.17,.125,.125],mats.pants));for(const side of ['l','r']){const knee=transform(marker('joint-'+side+'-knee').map((v,a)=>a===1?(v-minY)*scale:v*scale),false);const ankle=transform(marker('joint-'+side+'-ankle').map((v,a)=>a===1?(v-minY)*scale:v*scale),false);const thigh=curve('fully covered seated thigh '+side,[[knee[0],.48,.045],[knee[0],.49,knee[2]*.55],[knee[0],.475,knee[2]]],.078,mats.pants);root.add(thigh);root.add(curve('fully covered seated shin '+side,[[knee[0],.475,knee[2]],[ankle[0],.29,ankle[2]],[ankle[0],.10,ankle[2]]],.059,mats.pants));root.add(sphere('rounded trouser knee '+side,[knee[0],.475,knee[2]],[.078,.077,.08],mats.pants));}}
  if(preset.elder){const glasses=new THREE.MeshStandardMaterial({color:'#625d52',roughness:.45,metalness:.55});const ey=transform(marker('joint-l-eye').map((v,a)=>a===1?(v-minY)*scale:v*scale),false);for(const s of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.023,.0012,7,28),glasses);ring.name='reading glasses';ring.position.set(s*Math.abs(ey[0]),ey[1],ey[2]+.017);ring.scale.y=.78;root.add(ring);}root.add(curve('glasses bridge',[[-.01,ey[1]+.003,ey[2]+.018],[0,ey[1]+.006,ey[2]+.019],[.01,ey[1]+.003,ey[2]+.018]],.0012,glasses));}
  root.updateMatrixWorld(true);return root;
}
const stats=[];
for(const preset of presets)for(const seated of [false,true]){
  const scene=create(preset,seated);const buffer=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});const filename=preset.id+(seated?'-seated':'')+'.glb';fs.writeFileSync(path.join(dir,filename),Buffer.from(buffer));let meshes=0,triangles=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});const b=new THREE.Box3().setFromObject(scene),size=b.getSize(new THREE.Vector3());stats.push({filename,bytes:buffer.byteLength,meshes,triangles,height:size.y,width:size.x,depth:size.z,sourceBodyVertices:sourceBodyIds.length,sourceBodyTriangles:faces.length,fullyClothed:true});
}
fs.writeFileSync(path.join(dir,'character-build-report.json'),JSON.stringify({builtAt:new Date().toISOString(),source:'MakeHuman hm08 CC0 official mesh + official Asian male/female young/old targets',variants:stats},null,2));console.log(JSON.stringify(stats,null,2));
