import {useMemo} from 'react';
import type {ReactNode} from 'react';
import {useThree} from '@react-three/fiber';
import {RoundedBox} from '@react-three/drei';
import * as THREE from 'three';
import type {AnchorId} from '../types';

export type V3=[number,number,number];
export function Part({p=[0,0,0],s=[1,1,1],color='#bdb7a8',radius=.025,rotation=[0,0,0],material,cast=true}:{p?:V3;s?:V3;color?:string;radius?:number;rotation?:V3;material?:THREE.Material;cast?:boolean}){
  const rounded=radius>=.035||(Math.min(...s)>.09&&Math.max(...s)<4&&s[0]*s[1]*s[2]>.015);
  const surface=!material?<meshStandardMaterial color={color} roughness={.68}/>:null;
  return rounded?<RoundedBox args={s} position={p} rotation={rotation} radius={Math.min(radius,...s.map(n=>n/3))} smoothness={2} castShadow={cast} receiveShadow material={material}>{surface}</RoundedBox>:<mesh position={p} rotation={rotation} castShadow={cast} receiveShadow material={material}><boxGeometry args={s}/>{surface}</mesh>;
}
export function Rod({a,b,r=.02,color='#52605c',material}:{a:V3;b:V3;r?:number;color?:string;material?:THREE.Material}){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);
  return <mesh position={from.add(to).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize())} castShadow material={material}><cylinderGeometry args={[r,r,direction.length(),12]}/>{!material&&<meshStandardMaterial color={color} metalness={.55} roughness={.35}/>}</mesh>;
}
export function Wheel({p,r=.43,w=.18,material}:{p:V3;r?:number;w?:number;material:THREE.Material}){
  return <group position={p} rotation={[0,0,Math.PI/2]}><mesh material={material} castShadow><cylinderGeometry args={[r,r,w,40]}/></mesh><mesh position={[0,w*.56,0]} material={material}><cylinderGeometry args={[r*.4,r*.4,.05,32]}/></mesh><mesh position={[0,-w*.5,0]} material={material}><cylinderGeometry args={[r*1.05,r*1.05,.025,40]}/></mesh></group>;
}
function surface(kind:'stone'|'wood'|'terrazzo'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d')!;c.fillStyle=kind==='wood'?'#a99b7f':kind==='stone'?'#b5b4aa':'#bfbfb3';c.fillRect(0,0,1024,1024);
  let seed=12491;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<15000;i++){const x=random()*1024,y=random()*1024,v=Math.floor(80+random()*150);c.fillStyle=`rgba(${v},${v},${v-8},${kind==='wood'?.11:.25})`;c.fillRect(x,y,kind==='wood'?random()*55+8:random()*5+1,random()*2+.5);}
  c.strokeStyle=kind==='wood'?'#65564455':'#666a6540';c.lineWidth=kind==='wood'?2:3;
  for(let i=0;i<8;i++){c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,1024);c.stroke();if(kind!=='wood'){c.beginPath();c.moveTo(0,i*128);c.lineTo(1024,i*128);c.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}
function wovenSeatSurface(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d')!;c.fillStyle='#acb4a5';c.fillRect(0,0,256,256);
  // Fine alternating warp and weft keep the coach upholstery visibly matte up close.
  for(let n=0;n<256;n+=3){c.fillStyle=n%2?'#d0d3c025':'#40544732';c.fillRect(n,0,1,256);c.fillRect(0,n,256,1);}
  let seed=3081;for(let i=0;i<6500;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%256;seed=(seed*1664525+1013904223)>>>0;const y=seed%256;c.fillStyle=i%2?'#e0dfc315':'#253e3025';c.fillRect(x,y,1,1);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.anisotropy=8;return texture;
}
export function useArchitectureMaterials(){
  return useMemo(()=>{
    const stone=surface('stone'),wood=surface('wood'),floor=surface('terrazzo'),seat=wovenSeatSurface();floor.repeat.set(2,4);stone.repeat.set(1,2);
    return {
      floor:new THREE.MeshStandardMaterial({map:floor,color:'#c7c9bc',roughness:.53,metalness:.04}),
      stone:new THREE.MeshStandardMaterial({map:stone,color:'#d5d2bc',roughness:.76}),
      wood:new THREE.MeshStandardMaterial({map:wood,color:'#8b6946',roughness:.48}),
      steel:new THREE.MeshStandardMaterial({color:'#526b65',metalness:.68,roughness:.34}),
      silver:new THREE.MeshStandardMaterial({color:'#b6bfc0',metalness:.88,roughness:.28}),
      iron:new THREE.MeshStandardMaterial({color:'#353c3c',metalness:.8,roughness:.48}),
      green:new THREE.MeshStandardMaterial({color:'#285748',metalness:.4,roughness:.38}),
      coachFabric:new THREE.MeshStandardMaterial({map:seat,bumpMap:seat,bumpScale:.018,color:'#718b65',roughness:.94,metalness:0}),
      coachPiping:new THREE.MeshStandardMaterial({color:'#425945',roughness:.88}),
      coachLining:new THREE.MeshStandardMaterial({color:'#c4baa0',roughness:.76}),
      coachLamp:new THREE.MeshStandardMaterial({color:'#f2ebcc',emissive:'#ffeac0',emissiveIntensity:.65,roughness:.5}),
      glass:new THREE.MeshPhysicalMaterial({color:'#8dafa8',metalness:.08,roughness:.1,transparent:true,opacity:.27,envMapIntensity:1.8,clearcoat:1,side:THREE.DoubleSide}),
      brass:new THREE.MeshStandardMaterial({color:'#a48e55',metalness:.76,roughness:.31}),
    };
  },[]);
}
export type ArchitectureMaterials=ReturnType<typeof useArchitectureMaterials>;
export function Sign({text,small='',p,s=[2,.65,.035],color='#e7dfc1',background='#234d49',rotation=[0,0,0]}:{text:string;small?:string;p:V3;s?:V3;color?:string;background?:string;rotation?:V3}){
  const map=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const c=canvas.getContext('2d')!;
    c.fillStyle=background;c.fillRect(0,0,1024,384);c.strokeStyle=color+'88';c.lineWidth=3;c.strokeRect(12,12,1000,360);
    c.fillStyle=color;c.textAlign='center';c.font=`500 ${text.length>12?62:92}px "Microsoft YaHei",sans-serif`;c.fillText(text,512,small?180:228);if(small){c.globalAlpha=.75;c.font='32px Georgia';c.fillText(small,512,277);}return new THREE.CanvasTexture(canvas);
  },[text,small,color,background]);
  map.colorSpace=THREE.SRGBColorSpace;
  return <group position={p} rotation={rotation}><Part s={s} color={background} radius={.012}/><mesh position={[0,0,s[2]/2+.001]}><planeGeometry args={[s[0]-.025,s[1]-.025]}/><meshStandardMaterial map={map} roughness={.63}/></mesh></group>;
}
export function AnchorObject({id,onAnchor,children}:{id:AnchorId;onAnchor:(id:AnchorId)=>void;children:ReactNode}){
  const {gl}=useThree();return <group name={`memory-anchor-${id}`} onClick={e=>{e.stopPropagation();gl.domElement.dataset.lastAnchorSource=`mesh:${id}`;onAnchor(id);}}>{children}</group>;
}
export function Bench({p,rotation=0,m}:{p:V3;rotation?:number;m:ArchitectureMaterials}){
  return <group position={p} rotation={[0,rotation,0]}>
    {[0,1,2,3].map(i=><Part key={'s'+i} p={[0,.46,-.21+i*.14]} s={[2.6,.06,.105]} radius={.025} material={m.wood}/>)}
    {[0,1,2].map(i=><Part key={'b'+i} p={[0,.72+i*.12,-.25-i*.018]} s={[2.6,.085,.055]} radius={.025} material={m.wood}/>)}
    {[-1,1].map(x=><group key={x}><Rod a={[x,.08,-.2]} b={[x,.96,-.32]} r={.035} material={m.iron}/><Rod a={[x,.08,.24]} b={[x,.47,.18]} r={.035} material={m.iron}/><Rod a={[x,.44,-.22]} b={[x,.44,.28]} r={.035} material={m.iron}/><Rod a={[x,.65,-.2]} b={[x,.65,.27]} r={.025} material={m.iron}/><Rod a={[x,.45,.25]} b={[x,.65,.25]} r={.025} material={m.iron}/></group>)}
  </group>;
}
export function Suitcase({p,rotation=0,m}:{p:V3;rotation?:number;m:ArchitectureMaterials}){
  return <group position={p} rotation={[0,rotation,0]}>
    <Part p={[0,.34,0]} s={[.72,.65,.25]} color="#76513b" radius={.065}/><Part p={[0,.36,.134]} s={[.65,.54,.013]} color="#664733" radius={.04}/>
    {[-.23,.23].map(x=><group key={x}><Part p={[x,.34,.135]} s={[.044,.61,.014]} color="#9b7751"/><Part p={[x,.44,.152]} s={[.055,.08,.015]} material={m.brass} radius={.008}/></group>)}
    <Rod a={[-.14,.67,0]} b={[-.1,.75,0]} r={.026} color="#4b3f30"/><Rod a={[.14,.67,0]} b={[.1,.75,0]} r={.026} color="#4b3f30"/><Rod a={[-.1,.75,0]} b={[.1,.75,0]} r={.026} color="#4b3f30"/>
    {[-1,1].flatMap(x=>[-1,1].map(y=><Part key={x+':'+y} p={[x*.32,.34+y*.27,.139]} s={[.08,.07,.02]} material={m.brass} radius={.018}/>))}
    <Part p={[.21,.59,.16]} s={[.11,.16,.006]} color="#cbb891" rotation={[0,0,-.22]}/>
  </group>;
}
