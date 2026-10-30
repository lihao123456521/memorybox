/** Independent MHCLO asset fitting. Graphical inputs are MakeHuman Community CC0 assets. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import {GLTFExporter} from '../../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from '../../../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

const dir=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(dir,'source','system-cc0');
globalThis.FileReader=class{
  result=null;onloadend=null;onerror=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();}).catch(e=>this.onerror?.(e));}
  readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+blob.type+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}
};

function readObj(filename){
  const vertices=[],uvs=[],faces=[],groups=new Map();let group='';
  for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/)){
    const p=line.trim().split(/\s+/);
    if(p[0]==='v')vertices.push(p.slice(1,4).map(Number));
    if(p[0]==='vt')uvs.push(p.slice(1,3).map(Number));
    if(p[0]==='g'){group=p[1];if(!groups.has(group))groups.set(group,[]);}
    if(p[0]==='f'){
      const corners=p.slice(1).map(c=>{const [v,t]=c.split('/').map(Number);return [v<0?vertices.length+v:v-1,t<0?uvs.length+t:t-1];});
      if(!groups.has(group))groups.set(group,[]);groups.get(group).push(...corners.map(c=>c[0]));
      for(let i=1;i<corners.length-1;i++)faces.push({corners:[corners[0],corners[i],corners[i+1]],group});
    }
  }
  return {vertices,uvs,faces,groups};
}
const base=readObj(path.join(dir,'makehuman-base.obj'));
base.faces=base.faces.filter(f=>f.group==='body');
const bodyIds=[...new Set(base.faces.flatMap(f=>f.corners.map(c=>c[0])))];

// Split exported vertices at actual OBJ UV seams; reuse smooth normals across those seams.
function geometry(obj,coordinates,faces=obj.faces,restCoordinates){
  const smoothGeometry=new THREE.BufferGeometry();
  smoothGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates.flat(),3));
  smoothGeometry.setIndex(obj.faces.flatMap(f=>f.corners.map(c=>c[0])));smoothGeometry.computeVertexNormals();
  const sourceNormals=smoothGeometry.attributes.normal;
  const positions=[],uvs=[],normals=[],indices=[],restPositions=[],lookup=new Map();
  for(const face of faces)for(const [vertex,uv]of face.corners){
    const key=vertex+'/'+uv;let id=lookup.get(key);
    if(id===undefined){
      id=lookup.size;lookup.set(key,id);positions.push(...coordinates[vertex]);uvs.push(...(obj.uvs[uv]||[0,0]));
      if(restCoordinates)restPositions.push(...restCoordinates[vertex]);
      normals.push(sourceNormals.getX(vertex),sourceNormals.getY(vertex),sourceNormals.getZ(vertex));
    }
    indices.push(id);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
  // Preserve anatomical identity before the exported arms are folded beside the torso.
  // This custom glTF attribute is invisible and only used to calculate smooth skin weights.
  // Exporter adds the required glTF underscore; loader lowercases _HUMAN_REST.
  if(restCoordinates)g.setAttribute('human_rest',new THREE.Float32BufferAttribute(restPositions,3));
  smoothGeometry.dispose();return g;
}

function refineHead(coordinates,visibleFaces,neckY){
  const edges=new Map(),neighbors=coordinates.map(()=>new Set());
  const visible=new Set(visibleFaces),uvs=base.uvs.map(v=>[...v]);
  const edgeKey=(a,b)=>a<b?a+'/'+b:b+'/'+a;
  for(const face of base.faces){
    const ids=face.corners.map(c=>c[0]);
    for(let j=0;j<3;j++){
      const a=ids[j],b=ids[(j+1)%3],c=ids[(j+2)%3],key=edgeKey(a,b);
      neighbors[a].add(b);neighbors[b].add(a);
      if(!edges.has(key))edges.set(key,{a,b,opposites:[]});edges.get(key).opposites.push(c);
    }
  }
  const boundaries=coordinates.map(()=>[]);
  for(const edge of edges.values())if(edge.opposites.length===1){boundaries[edge.a].push(edge.b);boundaries[edge.b].push(edge.a);}
  const coords=coordinates.map((p,id)=>{
    const weight=smooth(neckY+.015,neckY+.07,p[1]);const adjacent=[...neighbors[id]];
    if(!weight||!adjacent.length)return [...p];
    let target;
    if(boundaries[id].length===2)target=p.map((v,axis)=>v*.75+(coordinates[boundaries[id][0]][axis]+coordinates[boundaries[id][1]][axis])*.125);
    else{const beta=adjacent.length===3?3/16:3/(8*adjacent.length);target=p.map((v,axis)=>v*(1-adjacent.length*beta)+beta*adjacent.reduce((sum,i)=>sum+coordinates[i][axis],0));}
    return p.map((v,axis)=>THREE.MathUtils.lerp(v,target[axis],weight));
  });
  for(const edge of edges.values()){
    const a=coordinates[edge.a],b=coordinates[edge.b],mid=a.map((v,axis)=>(v+b[axis])*.5),weight=smooth(neckY+.015,neckY+.07,mid[1]);
    const loop=edge.opposites.length===2?a.map((v,axis)=>(v+b[axis])*.375+(coordinates[edge.opposites[0]][axis]+coordinates[edge.opposites[1]][axis])*.125):mid;
    edge.index=coords.length;coords.push(mid.map((v,axis)=>THREE.MathUtils.lerp(v,loop[axis],weight)));
  }
  const midpointUV=new Map();
  function middle(a,b){
    const key=edgeKey(a[1],b[1]);let uv=midpointUV.get(key);
    if(uv===undefined){uv=uvs.length;uvs.push([0,1].map(axis=>((uvs[a[1]]||[0,0])[axis]+(uvs[b[1]]||[0,0])[axis])*.5));midpointUV.set(key,uv);}
    return [edges.get(edgeKey(a[0],b[0])).index,uv];
  }
  const faces=[],shown=[];
  for(const parent of base.faces){
    const [a,b,c]=parent.corners,ab=middle(a,b),bc=middle(b,c),ca=middle(c,a);
    for(const corners of [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]]){
      const face={corners,group:'body'};faces.push(face);if(visible.has(parent))shown.push(face);
    }
  }
  return {obj:{uvs,faces},coordinates:coords,visible:shown};
}

function readProxy(fragment){
  const filename=path.join(source,fragment+'.mhclo');
  const header={},mapping=[],deleted=new Set();let state='header';
  for(const original of fs.readFileSync(filename,'utf8').split(/\r?\n/)){
    const line=original.trim();if(!line||line.startsWith('#'))continue;const p=line.split(/\s+/);
    if(p[0]==='verts'){state='verts';continue;}
    if(p[0]==='delete_verts'){state='deleted';continue;}
    if(state==='deleted'){
      for(let i=0;i<p.length;i++){
        if(p[i+1]==='-'){const end=Number(p[i+2]);for(let v=Number(p[i]);v<=end;v++)deleted.add(v);i+=2;}
        else if(/^\d+$/.test(p[i]))deleted.add(Number(p[i]));
      }
    }else if(state==='verts'&&/^\d/.test(line))mapping.push(p.map(Number));
    else header[p[0]]=p.slice(1);
  }
  const obj=readObj(path.join(path.dirname(filename),header.obj_file.join(' ')));
  if(obj.vertices.length!==mapping.length)throw Error('MHCLO/OBJ vertex count mismatch: '+fragment);
  return {fragment,obj,header,mapping,deleted};
}
const assets={
  casual:readProxy('clothes/male_casualsuit01/male_casualsuit01'),
  shirt:readProxy('clothes/male_casualsuit03/male_casualsuit03'),
  blouse:readProxy('clothes/female_elegantsuit01/female_elegantsuit01'),
  shoes:readProxy('clothes/shoes04/shoes04'),
  short:readProxy('hair/short04/short04'),
  silver:readProxy('hair/short02/short02'),
  ponytail:readProxy('hair/ponytail01/ponytail01'),
  braid:readProxy('hair/braid01/braid01'),
  eyes:readProxy('eyes/high-poly/high-poly'),
  brows:readProxy('eyebrows/eyebrow001/eyebrow001'),
  lashes:readProxy('eyelashes/eyelashes01/eyelashes01'),
};
const presets=[
  {id:'young-man',target:'asian-male-young',height:1.78,outfit:'casual',hair:'short',outfitColor:'#c7d2df',elder:false},
  {id:'elder-man',target:'asian-male-old',height:1.72,outfit:'shirt',hair:'silver',outfitColor:'#bfc1bb',elder:true},
  {id:'young-woman',target:'asian-female-young',height:1.66,outfit:'blouse',hair:'ponytail',outfitColor:'#d6bab5',elder:false},
  {id:'elder-woman',target:'asian-female-old',height:1.64,outfit:'shirt',hair:'braid',outfitColor:'#9caf9c',elder:true},
];
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
function surface(name,color,roughness=.82){return new THREE.MeshStandardMaterial({name,color,roughness,metalness:0});}
function fit(proxy,points){
  const scale=[0,1,2].map((axis)=>{
    const p=proxy.header[['x_scale','y_scale','z_scale'][axis]];
    return p?Math.abs(points[Number(p[1])][axis]-points[Number(p[0])][axis])/Number(p[2]):1;
  });
  return proxy.mapping.map(row=>row.length===1?[...points[row[0]]]:[0,1,2].map(axis=>
    points[row[0]][axis]*row[3]+points[row[1]][axis]*row[4]+points[row[2]][axis]*row[5]+row[6+axis]*scale[axis]));
}
function lineMesh(name,points,radius,mat){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,18,radius,8,false),mat);mesh.name=name;return mesh;}

// Hand-authored parameter fitting after examining the four generated v5 turnarounds.
// This changes the continuous CC0 anatomy; it is not image reconstruction or identity capture.
function referenceShape(preset,landmarks){
  const female=preset.id.endsWith('woman'),elder=preset.elder,eye=landmarks['l-eye'],neck=landmarks.neck,head=landmarks.head;
  const fingerChains=['l','r'].flatMap(side=>[2,3,4,5].map(f=>({
    side:side==='l'?1:-1,a:landmarks[side+'-finger-'+f+'-1'],b:landmarks[side+'-finger-'+f+'-4'],
  })));
  const gaussian=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
  return original=>{
    let [x,y,z]=original;const ax=Math.abs(x),front=smooth(head[2]-.02,eye[2]+.015,z),headWeight=smooth(neck[1]-.015,neck[1]+.035,y);
    const jaw=gaussian(y,eye[1]-.082,.039)*headWeight,cheek=gaussian(y,eye[1]-.034,.035)*headWeight;
    // Softer jaw corners and rounded cheek volume instead of the old angular lower face.
    x*=1+(female?-.057:-.043)*jaw+(elder?.035:.018)*cheek;
    z+=(elder?.0032:.0018)*cheek*front;
    const orbit=gaussian(ax,eye[0],.023)*gaussian(y,eye[1]-.004,.022)*front;
    y+=(y-(eye[1]-.005))*.045*orbit;
    // Nose alae stay within a millimetre of their UV landmarks; preserve the full profile.
    const nose=gaussian(ax,.017,.017)*gaussian(y,eye[1]-.035,.021)*front;
    x-=Math.sign(x)*.00085*nose;
    // A small, closed-mouth corner lift. Texture projection still uses the same UVs.
    const smile=gaussian(ax,.022,.011)*gaussian(y,eye[1]-.068,.015)*front;
    y+=(elder?.0015:.0012)*smile;z+=.0005*smile;
    const ear=gaussian(ax,.078,.018)*gaussian(y,eye[1]-.012,.045)*(1-smooth(eye[2]-.04,eye[2],z))*headWeight;
    x+=Math.sign(x)*.0018*ear;
    // Gentle trapezius slope and a relaxed wrist-to-finger curve, not straight mannequin hands.
    const shoulder=gaussian(ax,landmarks['l-shoulder'][0]*.73,.075)*gaussian(y,landmarks['l-shoulder'][1]+.035,.045);
    y-=.003*shoulder;
    if(y<landmarks['l-hand'][1]+.025&&ax>Math.abs(landmarks['l-hand'][0])-.025){
      let influence=0;
      for(const {a,b,side}of fingerChains){
        if(Math.sign(x)!==side)continue;const d=b.map((v,i)=>v-a[i]),length=d.reduce((n,v)=>n+v*v,0);
        const t=THREE.MathUtils.clamp(original.reduce((n,v,i)=>n+(v-a[i])*d[i],0)/length,0,1);
        const distance=Math.hypot(...original.map((v,i)=>v-a[i]-t*d[i]));
        influence=Math.max(influence,smooth(.22,.92,t)*(1-smooth(.006,.022,distance)));
      }
      x-=Math.sign(x)*.010*influence;y+=.004*influence;z-=.004*influence;
    }
    return [x,y,z];
  };
}

const clothTopology=new WeakMap();
function garmentTopology(obj){
  if(clothTopology.has(obj))return clothTopology.get(obj);
  const parent=obj.vertices.map((_,i)=>i),root=i=>parent[i]===i?i:parent[i]=root(parent[i]);
  const uvParent=obj.uvs.map((_,i)=>i),uvRoot=i=>uvParent[i]===i?i:uvParent[i]=uvRoot(uvParent[i]);
  for(const f of obj.faces){for(const[v,t]of f.corners){parent[root(v)]=root(f.corners[0][0]);uvParent[uvRoot(t)]=uvRoot(f.corners[0][1]);}}
  const parts=new Map(),islands=new Map();
  for(let i=0;i<obj.vertices.length;i++){const key=root(i);if(!parts.has(key))parts.set(key,[]);parts.get(key).push(i);}
  for(const f of obj.faces){const key=uvRoot(f.corners[0][1]);if(!islands.has(key))islands.set(key,[]);islands.get(key).push(f);}
  const ordered=[...parts.values()].sort((a,b)=>a.reduce((s,i)=>s+obj.vertices[i][1],0)/a.length-b.reduce((s,i)=>s+obj.vertices[i][1],0)/b.length);
  const result={bottom:new Set(ordered.length>1?ordered[0]:[]),uvIslands:[...islands.values()]};clothTopology.set(obj,result);return result;
}

function referenceGarment(preset,points,joints,obj){
  const female=preset.id.endsWith('woman'),hip=joints.pelvis[1],shoulder=joints['l-shoulder'][1];
  const {bottom}=garmentTopology(obj);
  const shaped=points.map((original,id)=>{
    let[x,y,z]=original;const centre=joints['spine-1'][2],upper=smooth(hip-.02,hip+.12,y)*(1-smooth(shoulder+.03,shoulder+.10,y));
    if(female){
      // Cardigan ease across the torso, while preserving separately fitted sleeves and collar.
      const torso=1-smooth(Math.abs(joints['l-shoulder'][0])*.82,Math.abs(joints['l-shoulder'][0])*1.2,Math.abs(x));
      x*=1+.025*upper*torso;z=centre+(z-centre)*(1+.045*upper*torso);
      const waist=Math.exp(-(((y-hip-.14)/.13)**2))*torso;
      x*=1+(preset.elder?.065:.025)*waist;z=centre+(z-centre)*(1+(preset.elder?.075:.035)*waist);
      if(bottom.has(id))y-=.058*smooth(hip-.10,hip+.10,y);
      else if(Math.abs(x)<.27)y-=.025*(1-smooth(hip-.02,hip+.13,y));
    }
    if(preset.id==='young-woman'&&bottom.has(id)&&y<hip-.025){
      const flare=1-smooth(hip-.30,hip-.025,y);
      x*=1+.32*flare;z=joints.pelvis[2]+(z-joints.pelvis[2])*(1+.30*flare);
      y-=.12*flare;
      const angle=Math.atan2(x,z-joints.pelvis[2]);
      const pleat=Math.sin(angle*14)*.003*flare;
      x+=Math.sin(angle)*pleat;z+=Math.cos(angle)*pleat;
    }
    return [x,y,z];
  });
  if(female){
    const neighbors=shaped.map(()=>new Set());for(const f of obj.faces)for(const[a]of f.corners)for(const[b]of f.corners)if(a!==b)neighbors[a].add(b);
    const mask=shaped.map(([x,y,z],id)=>bottom.has(id)?0:smooth(joints['spine-1'][2]+.035,joints['spine-1'][2]+.105,z)*(1-smooth(Math.abs(joints['l-shoulder'][0])*.82,Math.abs(joints['l-shoulder'][0]),Math.abs(x)))*smooth(hip+.10,hip+.21,y)*(1-smooth(shoulder-.035,shoulder+.035,y)));
    for(let n=0;n<8;n++){
      const z=shaped.map(p=>p[2]);for(let i=0;i<shaped.length;i++)if(mask[i]&&neighbors[i].size){const average=[...neighbors[i]].reduce((sum,j)=>sum+z[j],0)/neighbors[i].size;shaped[i][2]=THREE.MathUtils.lerp(z[i],average,mask[i]*.52);}
    }
    for(let i=0;i<shaped.length;i++)shaped[i][2]+=.006*mask[i];
  }
  return shaped;
}

// Clip an actual 3D garment against an opening volume, interpolating all UV/normal/rest
// attributes at every cut edge. This avoids the jagged face-centre deletion used in v1.
function cutGarmentOpening(g,planes){
  const attributes=Object.entries(g.attributes),out=Object.fromEntries(attributes.map(([name])=>[name,[]])),p=new THREE.Vector3();
  const get=id=>Object.fromEntries(attributes.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,i)=>a.array[id*a.itemSize+i])]));
  const interpolate=(a,b,t)=>Object.fromEntries(attributes.map(([name])=>[name,a[name].map((v,i)=>THREE.MathUtils.lerp(v,b[name][i],t))]));
  function clip(poly,plane,inside){
    const result=[];if(!poly.length)return result;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=plane(...a.human_rest),db=plane(...b.human_rest),keepA=inside?da>=0:da<=0,keepB=inside?db>=0:db<=0;
      if(keepA)result.push(a);if(keepA!==keepB)result.push(interpolate(a,b,da/(da-db)));
    }return result;
  }
  function emit(poly){for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]])for(const[name]of attributes)out[name].push(...v[name]);}
  const index=g.index;
  for(let i=0;i<(index?.count??g.attributes.position.count);i+=3){
    let remaining=[0,1,2].map(n=>get(index?index.getX(i+n):i+n));
    for(const plane of planes){emit(clip(remaining,plane,false));remaining=clip(remaining,plane,true);if(!remaining.length)break;}
  }
  const result=new THREE.BufferGeometry();
  for(const[name,a]of attributes)result.setAttribute(name,new THREE.Float32BufferAttribute(out[name],a.itemSize));
  const normal=result.attributes.normal;for(let i=0;i<normal.count;i++){p.fromBufferAttribute(normal,i).normalize();normal.setXYZ(i,p.x,p.y,p.z);}
  const indexed=mergeVertices(result,.000001);result.dispose();g.dispose();return indexed;
}

function create(preset,seated){
  const points=base.vertices.map(v=>[...v]);
  for(const line of fs.readFileSync(path.join(dir,'source',preset.target+'.target'),'utf8').split(/\r?\n/)){
    if(!/^\d/.test(line))continue;const [id,x,y,z]=line.trim().split(/\s+/).map(Number);points[id][0]+=x;points[id][1]+=y;points[id][2]+=z;
  }
  const marker=name=>{const ids=[...new Set(base.groups.get(name))];return [0,1,2].map(axis=>ids.reduce((sum,i)=>sum+points[i][axis],0)/ids.length);};
  const minimum=Math.min(...bodyIds.map(i=>points[i][1]));const scale=preset.height/(Math.max(...bodyIds.map(i=>points[i][1]))-minimum);
  const normalize=([x,y,z])=>[x*scale,(y-minimum)*scale,z*scale];
  const referenceMarkers=['neck','head','pelvis','spine-1','l-eye','r-eye','l-shoulder','r-shoulder','l-hand','r-hand',...['l','r'].flatMap(s=>[2,3,4,5].flatMap(f=>[s+'-finger-'+f+'-1',s+'-finger-'+f+'-4']))];
  const before=Object.fromEntries(referenceMarkers.map(name=>[name,normalize(marker('joint-'+name))]));
  const sculpt=referenceShape(preset,before);
  for(let i=0;i<points.length;i++){
    const [x,y,z]=sculpt(normalize(points[i]));points[i]=[x/scale,y/scale+minimum,z/scale];
  }
  const shoulders=[marker('joint-r-shoulder'),marker('joint-l-shoulder')].map(normalize);
  const armChains=['r','l'].map(s=>['shoulder','elbow','hand','finger-3-4'].map(k=>normalize(marker('joint-'+s+'-'+k))));
  const hip=normalize(marker('joint-pelvis'))[1]-.025,knee=normalize(marker('joint-l-knee'))[1];
  const seatOffset=seated?hip-.465:0;
  function pose(original){
    let [x,y,z]=original;const shoulder=shoulders[x>=0?1:0];
    // Blend arm rotation smoothly into the deltoid without moving the chest or face.
    const lateral=smooth(Math.abs(shoulder[0])-.035,Math.abs(shoulder[0])+.085,Math.abs(x));
    const vertical=1-smooth(shoulder[1]+.015,shoulder[1]+.12,y);
    const lower=Math.abs(x)>Math.abs(shoulder[0])+.12?1:smooth(hip-.06,hip+.08,y);
    const arm=armChains[x>=0?1:0];let armDistance=Infinity;
    for(let i=0;i<arm.length-1;i++){const a=arm[i],d=arm[i+1].map((v,k)=>v-a[k]),length=d.reduce((sum,v)=>sum+v*v,0),t=THREE.MathUtils.clamp(original.reduce((sum,v,k)=>sum+(v-a[k])*d[k],0)/length,0,1);armDistance=Math.min(armDistance,Math.hypot(...original.map((v,k)=>v-a[k]-t*d[k])));}
    const influence=lateral*vertical*lower*smooth(hip-.14,hip-.07,y)*(1-smooth(.085,.155,armDistance));
    if(influence>0){const angle=(x>=0?-.64:.64)*influence,dx=x-shoulder[0],dy=y-shoulder[1];x=shoulder[0]+dx*Math.cos(angle)-dy*Math.sin(angle);y=shoulder[1]+dx*Math.sin(angle)+dy*Math.cos(angle);z+=.012*influence;}
    const isLeg=original[1]<hip+.06&&Math.abs(original[0])<.33;
    if(isLeg)x*=1-(1-smooth(hip-.10,hip+.04,y))*.16;
    if(seated){
      const w=isLeg?1-smooth(hip-.025,hip+.06,y):0;
      if(w>0){
        // Rotate the thigh, preserving its depth as vertical volume instead of flattening it.
        const kneeZ=normalize(marker('joint-l-knee'))[2];
        const hipZ=normalize(marker('joint-pelvis'))[2];
        const fold=1-smooth(knee-.035,knee+.035,original[1]);
        const thighY=hip+(original[2]-hipZ),thighZ=hipZ+hip-original[1];
        const shinY=hip+original[1]-knee,shinZ=hipZ+hip-knee+original[2]-kneeZ;
        y=THREE.MathUtils.lerp(y,THREE.MathUtils.lerp(thighY,shinY,fold),w);
        z=THREE.MathUtils.lerp(z,THREE.MathUtils.lerp(thighZ,shinZ,fold),w);
      }
      // Bend the forearms forward; a seated pose is a separate exported asset.
      if(influence>.5){const hand=smooth(.21,.43,Math.abs(original[0]))*influence;z+=.15*hand;y+=.08*hand;}
      y-=seatOffset;
    }
    return [x,y,z];
  }
  const root=new THREE.Group();root.name=preset.id+(seated?'-seated':'');
  root.userData={source:'MakeHuman CC0 hm08 body + MHCLO fitted system garments and hair',unit:'meter',height:preset.height,pose:seated?'seated':'standing',fullyClothed:true,uvSeams:'split per face corner'};
  const jointNames=['pelvis','spine-3','spine-1','neck','head',...['l','r'].flatMap(s=>['clavicle','shoulder','elbow','hand','upper-leg','knee','ankle','foot-2'].map(k=>s+'-'+k))];
  root.userData.humanRestJoints=Object.fromEntries(jointNames.map(name=>[name,normalize(marker('joint-'+name))]));
  root.userData.humanBindJoints=Object.fromEntries(jointNames.map(name=>[name,pose(normalize(marker('joint-'+name)))]));
  root.userData.referenceFitting={version:5,reference:'docs/character-references/v5/'+preset.id+'-turnaround.png',method:'hand-authored reference-guided parametric fitting, not photogrammetric identity reconstruction',uvTopology:'original body and clothing UVs retained; new opening edge UVs interpolated'};
  const selected=[assets[preset.outfit],assets.shoes,assets[preset.hair],assets.eyes,assets.brows,...(preset.id.endsWith('woman')?[assets.lashes]:[])];
  const ankleHeight=normalize(marker('joint-l-ankle'))[1];
  const hidden=new Set(selected.flatMap(a=>[...a.deleted].filter(id=>!(preset.id==='young-woman'&&a===assets.shoes&&normalize(points[id])[1]>ankleHeight+.01))));
  // The added ivory front covers the original open-shirt chest. Hide only that covered
  // skin, as the CC0 garment proxies already do elsewhere, instead of letting it pierce
  // a thin shirt at animated/interpolated triangles.
  if(['young-man','young-woman'].includes(preset.id))for(const id of bodyIds){
    const [x,y,z]=normalize(points[id]),neckY=normalize(marker('joint-neck'))[1];
    if(y>hip+.01&&y<neckY-.04&&Math.abs(x)<(preset.id==='young-man'?.085:.067)&&z>root.userData.humanRestJoints['spine-1'][2]+.055)hidden.add(id);
  }
  const visibleFaces=base.faces.filter(f=>!f.corners.some(([vertex])=>hidden.has(vertex)));
  const skin=surface('skin','#d2ac92',.67);
  const refined=refineHead(points.map(p=>pose(normalize(p))),visibleFaces,normalize(marker('joint-neck'))[1]-seatOffset);
  const restRefined=refineHead(points.map(normalize),visibleFaces,normalize(marker('joint-neck'))[1]);
  const body=new THREE.Mesh(geometry(refined.obj,refined.coordinates,refined.visible,restRefined.coordinates),skin);
  body.name='smooth human anatomy with per-corner UV seams';root.add(body);
  let outfitRest=[];
  for(const asset of selected){
    const isHair=asset===assets[preset.hair],isEye=asset===assets.eyes,isDetail=asset===assets.brows||asset===assets.lashes;
    const id=isEye?'brown':asset===assets[preset.outfit]&&preset.id==='elder-woman'?'elder-shirt':path.basename(asset.fragment);
    const mat=surface('cc0:'+id,isHair||isDetail||isEye?'#ffffff':asset===assets[preset.outfit]?preset.outfitColor:'#d5d1c5',isHair?.75:isEye?.24:.88);
    if(isHair||isDetail){mat.alphaTest=.35;mat.side=THREE.DoubleSide;mat.depthWrite=true;}
    if(isEye){mat.alphaTest=.1;mat.roughness=.2;}
    let fitted=fit(asset,points).map(normalize);
    if(asset===assets[preset.outfit])fitted=referenceGarment(preset,fitted,root.userData.humanRestJoints,asset.obj);
    if(asset===assets[preset.outfit])outfitRest=fitted;
    if(isHair){
      const neckY=normalize(marker('joint-neck'))[1],eye=normalize(marker('joint-l-eye'));
      fitted=fitted.map(([x,y,z])=>{
        if(preset.id==='elder-woman'){
          // Preserve the existing complete CC0 hair surface, shorten the trailing braid
          // and lift the front sweep off the eye into a short, rounded silver bob.
          const trailing=1-smooth(neckY-.02,neckY+.055,y);
          if(y<neckY+.035)y=Math.max(neckY+.020,neckY+.035+(y-neckY-.035)*.07);
          z=THREE.MathUtils.lerp(z,normalize(marker('joint-head'))[2]-.115,trailing*.82);x*=1-trailing*.25;
          const fringe=smooth(eye[2]-.035,eye[2]+.035,z)*(1-smooth(eye[1]+.025,eye[1]+.075,y));
          y+=.040*fringe;x*=1+.045*(1-smooth(eye[1]+.03,eye[1]+.12,y));
        }
        if(preset.id==='young-man'){
          const crown=smooth(eye[1]+.045,eye[1]+.11,y);
          y+=.012*crown+(Math.sin(x*173+z*119)+Math.sin(x*97-z*157))*.0018*crown;
          z+=.003*crown*Math.cos(x*93);
        }
        return [x,y,z];
      });
    }
    if(isEye){
      const centers=[normalize(marker('joint-r-eye')),normalize(marker('joint-l-eye'))];
      fitted.forEach(p=>{const center=centers[p[0]>=0?1:0];for(let axis=0;axis<3;axis++)p[axis]=center[axis]+(p[axis]-center[axis])*.985;p[2]-=.0011;});
    }
    const seatedSkirt=seated&&preset.outfit==='blouse'&&asset===assets[preset.outfit];
    let garmentFaces=seatedSkirt?asset.obj.faces.filter(f=>f.corners.reduce((sum,[v])=>sum+fitted[v][1],0)/3>hip+.11):asset.obj.faces;
    if(asset===assets.shoes&&preset.id==='young-woman')garmentFaces=garmentFaces.filter(f=>f.corners.reduce((sum,[v])=>sum+fitted[v][1],0)/3<ankleHeight+.035);
    const collarFaces=new Set();
    if(asset===assets[preset.outfit]&&preset.id.endsWith('woman'))for(const island of garmentTopology(asset.obj).uvIslands){
      const ids=[...new Set(island.flatMap(f=>f.corners.map(c=>c[0])))],minY=Math.min(...ids.map(i=>fitted[i][1])),maxX=Math.max(...ids.map(i=>Math.abs(fitted[i][0])));
      if(minY>shoulders[1][1]-.045&&maxX<Math.abs(shoulders[1][0])*.86)for(const f of island)collarFaces.add(f);
    }
    if(collarFaces.size){
      garmentFaces=garmentFaces.filter(f=>!collarFaces.has(f));
      const collar=new THREE.Mesh(geometry(asset.obj,fitted.map(pose),[...collarFaces],fitted),surface('reference:ivory-knit','#eee7d9',.94));
      collar.name='reference fitted original CC0 ivory collar';collar.material.side=THREE.DoubleSide;root.add(collar);root.userData.referenceFitting.nativeCollarTriangles=collarFaces.size;
    }
    let clothGeometry=geometry(asset.obj,fitted.map(pose),garmentFaces,fitted);
    if(['young-man','young-woman'].includes(preset.id)&&asset===assets[preset.outfit]){
      const low=hip+.04,high=normalize(marker('joint-neck'))[1]-.035;
      const width=y=>(preset.id==='young-man'?.045:.026)+(y-low)/(high-low)*.020;
      clothGeometry=cutGarmentOpening(clothGeometry,[(x,y,z)=>z-.043,(x,y)=>y-low,(x,y)=>high-y,(x,y)=>x+width(y),(x,y)=>width(y)-x]);
      mat.side=THREE.DoubleSide;
    }
    const mesh=new THREE.Mesh(clothGeometry,mat);
    mesh.name='CC0 fitted '+asset.fragment;mesh.castShadow=!isDetail;mesh.receiveShadow=true;root.add(mesh);
  }
  if(preset.id==='young-man'||preset.id.endsWith('woman')){
    const neckY=normalize(marker('joint-neck'))[1],width=Math.abs(shoulders[1][0])*.92;
    const spineZ=root.userData.humanRestJoints['spine-1'][2];
    // The underlayer follows the source garment's actual folds and sits inside it.
    // A body-derived inflated shell can pierce a close-fitting outer shirt at the chest.
    const under=outfitRest.map(([x,y,z])=>[x*.89,y,spineZ+(z-spineZ)*.87]);
    const faces=assets[preset.outfit].obj.faces.filter(f=>{
      const p=[0,1,2].map(a=>f.corners.reduce((sum,[v])=>sum+under[v][a],0)/3);
      return p[1]>(preset.id==='elder-woman'?shoulders[1][1]:hip+.038)&&p[1]<neckY-.022&&Math.abs(p[0])<.055&&p[2]>spineZ+.08;
    });
    const inner=new THREE.Mesh(geometry(assets[preset.outfit].obj,under.map(pose),faces,under),surface('reference:ivory-knit','#eee7d9',.96));
    inner.name='reference fitted continuous ivory knit underlayer';inner.material.side=THREE.DoubleSide;root.add(inner);
  }
  function frontSurface(x,y){
    const front=outfitRest.filter(p=>p[1]>hip&&p[2]>root.userData.humanRestJoints['spine-1'][2]+.04)
      .sort((a,b)=>(Math.abs(a[0]-x)+Math.abs(a[1]-y)*2)-(Math.abs(b[0]-x)+Math.abs(b[1]-y)*2)).slice(0,5);
    return front.reduce((sum,p)=>sum+p[2],0)/front.length;
  }
  function patchMesh(name,patches,material,clearance){
    const positions=[],uv=[],index=[],steps=8;
    for(const corners of patches){const start=positions.length/3;
      for(let y=0;y<=steps;y++)for(let x=0;x<=steps;x++){
        const u=x/steps,v=y/steps,p=[0,1,2].map(a=>(1-v)*THREE.MathUtils.lerp(corners[0][a],corners[1][a],u)+v*THREE.MathUtils.lerp(corners[3][a],corners[2][a],u));
        if(preset.id==='young-man')p[1]-=.014*Math.sin(Math.PI*u)*((1-v)**8);
        p[2]+=.0015*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);if(clearance)p[2]=Math.max(p[2],clearance(p[0],p[1]));positions.push(...p);uv.push(u,v);
      }
      for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){const a=start+y*(steps+1)+x,b=a+steps+1;index.push(a,b,a+1,b,b+1,a+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions.map((_,i)=>pose(positions.slice(Math.floor(i/3)*3,Math.floor(i/3)*3+3))[i%3]),3));
    g.setAttribute('human_rest',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.material.side=THREE.DoubleSide;root.add(mesh);
  }
  if(['young-man','young-woman'].includes(preset.id)){
    const neckY=normalize(marker('joint-neck'))[1],low=hip+.036,high=neckY-(preset.id==='young-man'?.010:.019);
    const bodyFront=bodyIds.map(i=>normalize(points[i])).filter(p=>Math.abs(p[0])<.13&&p[1]>hip&&p[1]<neckY+.025&&p[2]>root.userData.humanRestJoints['spine-1'][2]+.04);
    const clearance=(x,y)=>bodyFront.map(p=>({p,cost:Math.abs(p[0]-x)+Math.abs(p[1]-y)*1.5})).sort((a,b)=>a.cost-b.cost).slice(0,4).reduce((sum,v)=>sum+v.p[2],0)/4+.0065;
    const top=preset.id==='young-man'?.067:.048,bottom=preset.id==='young-man'?.049:.030;
    patchMesh('reference fitted ivory crew-neck centre',[[[-top,high,frontSurface(-.035,high)-.012],[top,high,frontSurface(.035,high)-.012],[bottom,low,frontSurface(.025,low)-.013],[-bottom,low,frontSurface(-.025,low)-.013]]],surface('reference:ivory-knit','#eee7d9',.96),clearance);
  }
  {
    const parts=[],top=shoulders[1][1]-.07,bottom=hip+.06,count=preset.elder?5:4;
    for(let n=0;n<count;n++){
      const y=THREE.MathUtils.lerp(top,bottom,n/(count-1)),x=preset.id==='young-man'?.061:preset.id==='young-woman'?.042:0;
      const front=outfitRest.filter(p=>p[1]>hip&&p[2]>root.userData.humanRestJoints['spine-1'][2]+.04)
        .sort((a,b)=>(Math.abs(a[0]-x)+Math.abs(a[1]-y)*2)-(Math.abs(b[0]-x)+Math.abs(b[1]-y)*2)).slice(0,4);
      const z=front.reduce((sum,p)=>sum+p[2],0)/front.length+.003;
      parts.push(new THREE.CylinderGeometry(.0036,.0036,.0018,12).rotateX(Math.PI/2).translate(x,y,z));
    }
    const g=mergeGeometries(parts),p=g.attributes.position,rest=Array.from(p.array);
    for(let i=0;i<p.count;i++)p.setXYZ(i,...pose([p.getX(i),p.getY(i),p.getZ(i)]));
    g.setAttribute('human_rest',new THREE.Float32BufferAttribute(rest,3));g.computeVertexNormals();
    const buttons=new THREE.Mesh(g,surface('reference:cardigan-buttons','#776754',.76));buttons.name='reference fitted cardigan and shirt buttons';root.add(buttons);parts.forEach(p=>p.dispose());
  }
  if(preset.id==='young-man'){
    const eye=normalize(marker('joint-l-eye')),parts=[];
    for(let i=0;i<17;i++){
      const x=(i-8)*.0077,rootY=eye[1]+.107-Math.abs(x)*.15,endY=eye[1]+.037+.009*Math.sin(i*2.6);
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,rootY,eye[2]-.025),new THREE.Vector3(x+.006*Math.sin(i),eye[1]+.075,eye[2]+.004),new THREE.Vector3(x+.004*Math.cos(i),endY,eye[2]+.014)]);
      const g=new THREE.TubeGeometry(curve,10,.0035,6,false),p=g.attributes.position;
      for(let ring=0;ring<=10;ring++){
        const t=ring/10,centre=curve.getPointAt(t),taper=1-.91*t*t;
        for(let a=0;a<=6;a++){const index=ring*7+a,v=new THREE.Vector3().fromBufferAttribute(p,index).sub(centre).multiplyScalar(taper).add(centre);p.setXYZ(index,v.x,v.y,v.z);}
      }
      parts.push(g);
    }
    const g=mergeGeometries(parts),p=g.attributes.position,rest=Array.from(p.array);
    for(let i=0;i<p.count;i++)p.setXYZ(i,...pose([p.getX(i),p.getY(i),p.getZ(i)]));
    g.setAttribute('human_rest',new THREE.Float32BufferAttribute(rest,3));g.computeVertexNormals();
    const strands=new THREE.Mesh(g,surface('reference:hair-strands','#201b18',.87));strands.name='reference fitted hair fringe strands';root.add(strands);parts.forEach(p=>p.dispose());
  }
  if(seated&&preset.outfit==='blouse'){
    // A continuous draped skirt covers both thighs when the straight standing skirt folds.
    const positions=[],indices=[];const rings=24,sides=48;
    for(let ring=0;ring<=rings;ring++){
      const t=ring/rings,z=.015+t*.57,width=.211+.042*Math.sin(t*Math.PI*.7),height=.133-.025*t;
      for(let side=0;side<=sides;side++){
        const a=side/sides*Math.PI*2,ripple=.0018*Math.sin(a*12+t*4)*Math.sin(Math.PI*t);
        positions.push(Math.cos(a)*(width+ripple),.492+Math.sin(a)*(height+ripple),z);
      }
    }
    for(let r=0;r<rings;r++)for(let s=0;s<sides;s++){
      const a=r*(sides+1)+s,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);
    }
    const front=positions.length/3;positions.push(0,.492,.590);
    for(let s=0;s<sides;s++)indices.push(front,rings*(sides+1)+s,rings*(sides+1)+s+1);
    const cloth=new THREE.BufferGeometry();cloth.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));cloth.setIndex(indices);cloth.computeVertexNormals();
    const skirtMat=surface('opaque draped seated skirt fabric','#282822',.94);skirtMat.side=THREE.DoubleSide;
    const skirt=new THREE.Mesh(cloth,skirtMat);skirt.name='continuous seated skirt drape over both thighs';root.add(skirt);
  }
  if(preset.elder){
    const eye=pose(normalize(marker('joint-l-eye'))),frame=surface('aged bronze spectacle frames','#6b6657',.38);frame.metalness=.72;
    for(const side of [-1,1]){
      const x=side*Math.abs(eye[0]);const rim=new THREE.Mesh(new THREE.TorusGeometry(.023,.0011,8,40),frame);
      rim.name='fine oval reading glasses';rim.position.set(x,eye[1],eye[2]+.019);rim.scale.y=.79;root.add(rim);
      root.add(lineMesh('spectacle temple '+side,[[x+side*.022,eye[1],eye[2]+.017],[side*.075,eye[1]+.003,eye[2]-.013],[side*.080,eye[1]-.007,eye[2]-.053]],.0011,frame));
    }
    root.add(lineMesh('arched spectacle bridge',[[-.011,eye[1]+.004,eye[2]+.019],[0,eye[1]+.009,eye[2]+.021],[.011,eye[1]+.004,eye[2]+.019]],.0011,frame));
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);root.position.y-=box.min.y;root.updateMatrixWorld(true);
  return root;
}

const report=[],jointReport={};
for(const preset of presets)for(const seated of [false,true]){
  const model=create(preset,seated);const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  const filename=preset.id+(seated?'-seated':'')+'.glb';fs.writeFileSync(path.join(dir,filename),Buffer.from(data));
  jointReport[preset.id+(seated?'-seated':'')]=model.userData.humanBindJoints;
  let meshes=0,triangles=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  report.push({filename,bytes:data.byteLength,meshes,triangles,height:size.y,width:size.x,depth:size.z,sourceBodyVertices:bodyIds.length,sourceBodyTriangles:base.faces.length,fullyClothed:true,uvSeamsPreserved:true,garment:assets[preset.outfit].fragment,hair:assets[preset.hair].fragment});
}
fs.writeFileSync(path.join(dir,'character-build-report.json'),JSON.stringify({builtAt:new Date().toISOString(),referenceVersion:5,source:'MakeHuman Community CC0 hm08 and official system assets; reference-guided parameter fitting',variants:report},null,2));
fs.writeFileSync(path.resolve(dir,'../../../src/scenes/HumanJoints.ts'),'// Generated by public/assets/models/build-characters.mjs from the same fitted source as all 8 GLBs.\nexport const HUMAN_JOINTS:Record<string,Record<string,[number,number,number]>>='+JSON.stringify(jointReport,null,2)+';\n');
console.log(JSON.stringify(report,null,2));
