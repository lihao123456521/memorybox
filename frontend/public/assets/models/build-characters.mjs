/** Independent MHCLO asset fitting. Graphical inputs are MakeHuman Community CC0 assets. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../../node_modules/three/build/three.module.js';
import {GLTFExporter} from '../../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';

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
function geometry(obj,coordinates,faces=obj.faces){
  const smoothGeometry=new THREE.BufferGeometry();
  smoothGeometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates.flat(),3));
  smoothGeometry.setIndex(obj.faces.flatMap(f=>f.corners.map(c=>c[0])));smoothGeometry.computeVertexNormals();
  const sourceNormals=smoothGeometry.attributes.normal;
  const positions=[],uvs=[],normals=[],indices=[],lookup=new Map();
  for(const face of faces)for(const [vertex,uv]of face.corners){
    const key=vertex+'/'+uv;let id=lookup.get(key);
    if(id===undefined){
      id=lookup.size;lookup.set(key,id);positions.push(...coordinates[vertex]);uvs.push(...(obj.uvs[uv]||[0,0]));
      normals.push(sourceNormals.getX(vertex),sourceNormals.getY(vertex),sourceNormals.getZ(vertex));
    }
    indices.push(id);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
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

function create(preset,seated){
  const points=base.vertices.map(v=>[...v]);
  for(const line of fs.readFileSync(path.join(dir,'source',preset.target+'.target'),'utf8').split(/\r?\n/)){
    if(!/^\d/.test(line))continue;const [id,x,y,z]=line.trim().split(/\s+/).map(Number);points[id][0]+=x;points[id][1]+=y;points[id][2]+=z;
  }
  const marker=name=>{const ids=[...new Set(base.groups.get(name))];return [0,1,2].map(axis=>ids.reduce((sum,i)=>sum+points[i][axis],0)/ids.length);};
  const minimum=Math.min(...bodyIds.map(i=>points[i][1]));const scale=preset.height/(Math.max(...bodyIds.map(i=>points[i][1]))-minimum);
  const normalize=([x,y,z])=>[x*scale,(y-minimum)*scale,z*scale];
  const shoulders=[marker('joint-r-shoulder'),marker('joint-l-shoulder')].map(normalize);
  const hip=normalize(marker('joint-pelvis'))[1]-.025,knee=normalize(marker('joint-l-knee'))[1];
  const seatOffset=seated?hip-.465:0;
  function pose(original){
    let [x,y,z]=original;const shoulder=shoulders[x>=0?1:0];
    // Blend arm rotation smoothly into the deltoid without moving the chest or face.
    const lateral=smooth(Math.abs(shoulder[0])-.035,Math.abs(shoulder[0])+.085,Math.abs(x));
    const vertical=1-smooth(shoulder[1]+.015,shoulder[1]+.12,y);
    const lower=Math.abs(x)>Math.abs(shoulder[0])+.12?1:smooth(hip-.06,hip+.08,y);
    const influence=lateral*vertical*lower;
    if(influence>0){const angle=(x>=0?-.70:.70)*influence,dx=x-shoulder[0],dy=y-shoulder[1];x=shoulder[0]+dx*Math.cos(angle)-dy*Math.sin(angle);y=shoulder[1]+dx*Math.sin(angle)+dy*Math.cos(angle);z+=.012*influence;}
    const isLeg=original[1]<hip+.06&&Math.abs(original[0])<.33;
    if(isLeg)x*=1-(1-smooth(hip-.10,hip+.04,y))*.10;
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
  const selected=[assets[preset.outfit],assets.shoes,assets[preset.hair],assets.eyes,assets.brows,...(preset.id.endsWith('woman')?[assets.lashes]:[])];
  const hidden=new Set(selected.flatMap(a=>[...a.deleted]));
  const visibleFaces=base.faces.filter(f=>!f.corners.some(([vertex])=>hidden.has(vertex)));
  const skin=surface('skin','#d2ac92',.67);
  const refined=refineHead(points.map(p=>pose(normalize(p))),visibleFaces,normalize(marker('joint-neck'))[1]-seatOffset);
  const body=new THREE.Mesh(geometry(refined.obj,refined.coordinates,refined.visible),skin);
  body.name='smooth human anatomy with per-corner UV seams';root.add(body);
  for(const asset of selected){
    const isHair=asset===assets[preset.hair],isEye=asset===assets.eyes,isDetail=asset===assets.brows||asset===assets.lashes;
    const id=isEye?'brown':asset===assets[preset.outfit]&&preset.id==='elder-woman'?'elder-shirt':path.basename(asset.fragment);
    const mat=surface('cc0:'+id,isHair||isDetail||isEye?'#ffffff':asset===assets[preset.outfit]?preset.outfitColor:'#d5d1c5',isHair?.75:isEye?.24:.88);
    if(isHair||isDetail){mat.alphaTest=.35;mat.side=THREE.DoubleSide;mat.depthWrite=true;}
    if(isEye){mat.alphaTest=.1;mat.roughness=.2;}
    const fitted=fit(asset,points).map(normalize);
    if(isEye){
      const centers=[normalize(marker('joint-r-eye')),normalize(marker('joint-l-eye'))];
      fitted.forEach(p=>{const center=centers[p[0]>=0?1:0];for(let axis=0;axis<3;axis++)p[axis]=center[axis]+(p[axis]-center[axis])*.985;p[2]-=.0011;});
    }
    const seatedSkirt=seated&&preset.outfit==='blouse'&&asset===assets[preset.outfit];
    const garmentFaces=seatedSkirt?asset.obj.faces.filter(f=>f.corners.reduce((sum,[v])=>sum+fitted[v][1],0)/3>hip+.11):asset.obj.faces;
    const mesh=new THREE.Mesh(geometry(asset.obj,fitted.map(pose),garmentFaces),mat);
    mesh.name='CC0 fitted '+asset.fragment;mesh.castShadow=!isDetail;mesh.receiveShadow=true;root.add(mesh);
  }
  if(seated&&preset.outfit==='blouse'){
    // A continuous draped skirt covers both thighs when the straight standing skirt folds.
    const positions=[],indices=[];const rings=24,sides=48;
    for(let ring=0;ring<=rings;ring++){
      const t=ring/rings,z=.015+t*.46,width=.198+.025*Math.sin(t*Math.PI*.7),height=.123-.027*t;
      for(let side=0;side<=sides;side++){
        const a=side/sides*Math.PI*2,ripple=.0018*Math.sin(a*12+t*4)*Math.sin(Math.PI*t);
        positions.push(Math.cos(a)*(width+ripple),.492+Math.sin(a)*(height+ripple),z);
      }
    }
    for(let r=0;r<rings;r++)for(let s=0;s<sides;s++){
      const a=r*(sides+1)+s,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);
    }
    const front=positions.length/3;positions.push(0,.492,.480);
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

const report=[];
for(const preset of presets)for(const seated of [false,true]){
  const model=create(preset,seated);const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
  const filename=preset.id+(seated?'-seated':'')+'.glb';fs.writeFileSync(path.join(dir,filename),Buffer.from(data));
  let meshes=0,triangles=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  report.push({filename,bytes:data.byteLength,meshes,triangles,height:size.y,width:size.x,depth:size.z,sourceBodyVertices:bodyIds.length,sourceBodyTriangles:base.faces.length,fullyClothed:true,uvSeamsPreserved:true,garment:assets[preset.outfit].fragment,hair:assets[preset.hair].fragment});
}
fs.writeFileSync(path.join(dir,'character-build-report.json'),JSON.stringify({builtAt:new Date().toISOString(),source:'MakeHuman Community CC0 hm08 and official system assets',variants:report},null,2));
console.log(JSON.stringify(report,null,2));
