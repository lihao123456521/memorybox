import { Suspense, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { AnchorId, Branch, CharacterPreset, NavigationMode, Phase } from '../types';
import type { Collider } from './navigation';
import { Character } from './Characters';
import { useRoomMaterials } from './materials';
import type { RoomMaterials } from './materials';

type V3=[number,number,number];
export const ANCHOR_POSITIONS:Record<AnchorId,V3>={tv:[3.38,1.15,-2.15],doll:[-3.0,.8,-.5],photo:[.25,1.4,-3.0]};
export const SCENE_ZONES=[
  {id:'living',label:'客厅',xMin:-4,xMax:4,zMin:-3.5,zMax:3.5},
  {id:'kitchen',label:'厨房',xMin:-4,xMax:4,zMin:-6.8,zMax:-3.5},
  {id:'balcony',label:'阳台',xMin:4,xMax:6.8,zMin:-2.8,zMax:2.8}
] as const;
export const WALK_COLLIDERS:Collider[]=[
  {xMin:-4.1,xMax:-2.1,zMin:-3.59,zMax:-3.41},{xMin:-.9,xMax:4.1,zMin:-3.59,zMax:-3.41},
  {xMin:3.91,xMax:4.09,zMin:-3.5,zMax:-.9},{xMin:3.91,xMax:4.09,zMin:.9,zMax:3.5},
  {xMin:-3.98,xMax:-2.73,zMin:-2.05,zMax:.95},
  {xMin:-.9,xMax:.9,zMin:-.8,zMax:.3},
  {xMin:3.0,xMax:3.94,zMin:-3.03,zMax:-1.26},
  {xMin:-.56,xMax:1.06,zMin:-3.38,zMax:-2.75},
  {xMin:-3.97,xMax:-2.85,zMin:2.55,zMax:3.4},
  {xMin:-2.55,xMax:-2.15,zMin:-1.8,zMax:-1.4},
  {xMin:-3.93,xMax:1.35,zMin:-6.75,zMax:-6.02},
  {xMin:2.58,xMax:3.8,zMin:-6.73,zMax:-5.65},
  {xMin:.62,xMax:2.17,zMin:-5.52,zMax:-4.62},
  {xMin:.5,xMax:.9,zMin:-4.4,zMax:-4.0},
  {xMin:2.55,xMax:3.15,zMin:2.35,zMax:2.95},
  {xMin:6.13,xMax:6.65,zMin:-2.4,zMax:-1.75},
  {xMin:5.95,xMax:6.65,zMin:1.48,zMax:2.35}
];

export interface RoomProps {phase:Phase;branch:Branch|null;visited:AnchorId[];selected:AnchorId|null;hint:boolean;viewMode:NavigationMode;companion:CharacterPreset;realDeparture?:boolean;onAnchor:(id:AnchorId)=>void}

function Box({p=[0,0,0],s=[1,1,1],m,c,r=0,rotation=[0,0,0],name}:{p?:V3;s?:V3;m?:THREE.Material;c?:string;r?:number;rotation?:V3;name?:string}) {
  const surface=m?<primitive object={m} attach="material"/>:<meshStandardMaterial color={c||'#d9d4c9'} roughness={.75}/>;
  return r?<RoundedBox name={name} position={p} rotation={rotation} args={s} radius={Math.min(r,...s.map(n=>n/3))} smoothness={2} castShadow receiveShadow>{surface}</RoundedBox>:<mesh name={name} position={p} rotation={rotation} castShadow receiveShadow><boxGeometry args={s}/>{surface}</mesh>;
}
function Cyl({p=[0,0,0],radius=.05,bottom,depth=.1,m,c,rotation=[0,0,0]}:{p?:V3;radius?:number;bottom?:number;depth?:number;m?:THREE.Material;c?:string;rotation?:V3}) {return <mesh position={p} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[radius,bottom??radius,depth,24]}/>{m?<primitive object={m} attach="material"/>:<meshStandardMaterial color={c||'#8b7760'} roughness={.65}/>}</mesh>;}
function Ellipsoid({p,s,c,m}:{p:V3;s:V3;c?:string;m?:THREE.Material}) {return <mesh position={p} scale={s} castShadow><sphereGeometry args={[1,20,16]}/>{m?<primitive object={m} attach="material"/>:<meshStandardMaterial color={c||'#5f794b'} roughness={.8}/>}</mesh>;}

function WindowFrame({p=[0,0,0],rotation=0,w=2,h=1.65,m}:{p?:V3;rotation?:number;w?:number;h?:number;m:RoomMaterials}) {return <group position={p} rotation={[0,rotation,0]}>
  {[-1,1].map(i=><group key={i}><Box p={[i*(w/2+.025),0,0]} s={[.09,h+.15,.15]} c="#e6e6dd"/><Box p={[0,i*(h/2+.025),0]} s={[w+.15,.09,.15]} c="#e6e6dd"/></group>)}
  <mesh position={[0,0,.095]}><planeGeometry args={[w-.1,h-.1]}/><primitive object={m.glass} attach="material"/></mesh>
  <Box p={[0,0,.11]} s={[.045,h,.065]} c="#dfdfd5"/><Box p={[0,0,.11]} s={[w,.045,.065]} c="#dfdfd5"/>
  <Box p={[0,-h/2-.09,.035]} s={[w+.22,.11,.35]} c="#d9d4c9"/>
  <Box p={[.075,-.03,.16]} s={[.027,.14,.035]} m={m.metal}/>
  </group>;}

function Curtains({p,rotation=0,m}:{p:V3;rotation?:number;m:RoomMaterials}) {return <group position={p} rotation={[0,rotation,0]}>
  <Cyl p={[0,1.04,.2]} radius={.018} depth={2.85} m={m.darkMetal} rotation={[0,0,Math.PI/2]}/>
  {[-1,1].map(side=><group key={side} position={[side*1.11,0,.18]}>{Array.from({length:7},(_,i)=><mesh key={i} position={[(i-3)*.07,0,Math.sin(i*1.7)*.045]} castShadow><cylinderGeometry args={[.055,.068,2.02,8,1,true,0,Math.PI]}/><primitive object={m.linen} attach="material"/></mesh>)}<Box p={[0,-.25,.06]} s={[.47,.045,.03]} c="#c3b795" r={.01}/></group>)}
  </group>;}

function Shell({m,walk}:{m:RoomMaterials;walk:boolean}) {return <group name="full-scale-interior-shell">
  <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[8,7]}/><primitive object={m.floor} attach="material"/></mesh>
  <Box p={[0,-.11,0]} s={[8.2,.2,7.15]} c="#887d6b"/>
  <Box p={[0,.0,-5.15]} s={[8,.035,3.3]} m={m.tile}/><Box p={[5.4,.0,0]} s={[2.8,.035,5.6]} m={m.tile}/>
  <Box p={[-3.05,1.45,-3.5]} s={[1.9,2.9,.16]} m={m.wall}/><Box p={[1.55,1.45,-3.5]} s={[4.9,2.9,.16]} m={m.wall}/><Box p={[-1.5,2.58,-3.5]} s={[1.2,.64,.16]} m={m.wall}/>
  <Box p={[-4,1.45,-3.9]} s={[.16,2.9,5.8]} m={m.wall}/><Box p={[-4,1.45,2.25]} s={[.16,2.9,2.5]} m={m.wall}/>
  <Box p={[-4,.415,0]} s={[.16,.83,2]} m={m.wall}/><Box p={[-4,2.66,0]} s={[.16,.48,2]} m={m.wall}/>
  <Box p={[0,1.45,-6.8]} s={[8.16,2.9,.16]} m={m.wall}/>
  <Box p={[4,1.45,-5.15]} s={[.16,2.9,3.3]} m={m.wall}/>
  {walk&&<>
    <Box p={[0,1.45,3.5]} s={[8.16,2.9,.16]} m={m.wall}/>
    <Box p={[4,1.45,-2.2]} s={[.16,2.9,2.6]} m={m.wall}/><Box p={[4,1.45,2.2]} s={[.16,2.9,2.6]} m={m.wall}/><Box p={[4,2.57,0]} s={[.16,.66,1.8]} m={m.wall}/>
    <Box p={[0,2.95,-1.65]} s={[8.1,.13,10.4]} m={m.ceiling}/>
    <Box p={[5.4,2.95,0]} s={[2.85,.13,5.7]} m={m.ceiling}/>
  </>}
  <Box p={[5.4,.47,-2.8]} s={[2.8,.95,.12]} m={m.wall}/><Box p={[5.4,.47,2.8]} s={[2.8,.95,.12]} m={m.wall}/>
  <Box p={[6.8,.47,0]} s={[.12,.95,5.6]} m={m.wall}/>
  <Box p={[6.8,2.65,0]} s={[.12,.5,5.6]} m={m.wall}/>
  {[-2.8,2.8].map(z=><Box key={z} p={[5.4,2.65,z]} s={[2.8,.5,.12]} m={m.wall}/>)}
  <group position={[6.76,1.72,0]} rotation={[0,Math.PI/2,0]}>
    {[-1.84,0,1.84].map(x=><WindowFrame key={x} p={[x,0,0]} w={1.78} h={1.42} m={m}/>)}
  </group>
  {[-1,1].map(side=><group key={side}><Box p={[5.4,1.72,side*2.77]} s={[2.72,1.42,.025]} m={m.glass}/><Box p={[5.4,1.72,side*2.77]} s={[.05,1.55,.06]} c="#d6d5cb"/></group>)}
  <group position={[-1.5,0,-3.46]}>
    {[-.64,.64].map(x=><Box key={x} p={[x,1.14,0]} s={[.1,2.28,.23]} m={m.darkWood}/>)}<Box p={[0,2.28,0]} s={[1.38,.1,.23]} m={m.darkWood}/>
    <Box p={[0,.015,0]} s={[1.2,.03,.25]} c="#a5a18e"/>
    <group position={[-.64,0,-.18]} rotation={[0,-1.48,0]}><Box p={[.6,1.12,0]} s={[1.2,2.24,.045]} m={m.wood}/><Box p={[1.05,1.03,.055]} s={[.12,.025,.045]} m={m.metal}/></group>
  </group>
  <group position={[3.98,0,0]} rotation={[0,Math.PI/2,0]}>{[-.94,.94].map(x=><Box key={x} p={[x,1.16,0]} s={[.09,2.32,.14]} c="#d5d5cb"/>)}<Box p={[0,2.31,0]} s={[1.98,.09,.14]} c="#d5d5cb"/><Box p={[0,.025,0]} s={[1.8,.05,.2]} m={m.metal}/></group>
  {[-3.9,3.9].map(x=><Box key={x} p={[x,.055,-5.15]} s={[.045,.11,3.22]} m={m.darkWood}/>)}
  <Box p={[-3.9,.055,.0]} s={[.045,.11,6.9]} m={m.darkWood}/><Box p={[0,.055,3.39]} s={[7.8,.11,.045]} m={m.darkWood}/>
  <Box p={[-3.02,.055,-3.39]} s={[1.85,.11,.045]} m={m.darkWood}/><Box p={[1.52,.055,-3.39]} s={[4.8,.11,.045]} m={m.darkWood}/>
  <Box p={[0,.055,-6.69]} s={[7.8,.11,.045]} m={m.darkWood}/>
  </group>;}

function Socket({p,rotation=0,m}:{p:V3;rotation?:number;m:RoomMaterials}) {return <group position={p} rotation={[0,rotation,0]}><Box s={[.11,.12,.016]} m={m.ceramic} r={.009}/>{[-1,1].map(i=><Box key={i} p={[i*.021,.012,.011]} s={[.009,.027,.008]} c="#6c6c62"/>)}<Box p={[0,-.025,.011]} s={[.009,.02,.008]} c="#6c6c62"/></group>;}
function Switch({p,rotation=0,m}:{p:V3;rotation?:number;m:RoomMaterials}) {return <group position={p} rotation={[0,rotation,0]}><Box s={[.095,.105,.018]} m={m.ceramic} r={.006}/><Box p={[0,0,.014]} s={[.057,.07,.012]} c="#e0ded2" r={.004}/></group>;}

function BookRow({p,m,count=6}:{p:V3;m:RoomMaterials;count?:number}) {return <group position={p}>{Array.from({length:count},(_,i)=><group key={i} position={[i*.055,0,0]} rotation={[0,0,i===count-1?-.08:0]}><Box p={[0,.12+(i%3)*.01,0]} s={[.045,.24+(i%3)*.02,.18]} c={['#696f61','#75664d','#ad8667','#506469','#aba38e'][i%5]} r={.003}/><Box p={[0,.18,.093]} s={[.025,.008,.003]} m={m.linen}/></group>)}</group>;}

function Plant({p=[0,0,0],scale=1,m}:{p?:V3;scale?:number;m:RoomMaterials}) {return <group position={p} scale={scale}>
  <Cyl p={[0,.16,0]} radius={.21} bottom={.15} depth={.32} c="#99745b"/><Cyl p={[0,.324,0]} radius={.192} depth={.015} c="#4d4231"/>
  {Array.from({length:10},(_,i)=><group key={i} rotation={[0,i*2.4,0]}><Cyl p={[.035,.56+i*.018,0]} radius={.008} depth={.54+i*.035} c="#526442" rotation={[0,0,-.18]}/><group position={[.17,.65+i*.035,0]} rotation={[0,0,-.48]}><Ellipsoid p={[0,0,0]} s={[.075,.24,.02]} m={m.leaf}/><Box p={[0,0,.021]} s={[.004,.35,.004]} c="#9aaf76"/></group></group>)}
  </group>;}

function CurtainTie({m}:{m:RoomMaterials}) {return <group><Curtains p={[-3.89,1.69,.1]} rotation={Math.PI/2} m={m}/><WindowFrame p={[-3.98,1.62,0]} rotation={Math.PI/2} w={1.9} h={1.55} m={m}/></group>;}

function Sofa({m}:{m:RoomMaterials}) {return <group position={[-3.35,0,-.55]} rotation={[0,Math.PI/2,0]}>
  {[-1.22,1.22].flatMap(x=>[-.36,.36].map(z=><Box key={`${x}${z}`} p={[x,.12,z]} s={[.08,.23,.08]} m={m.darkWood}/>))}
  <Box p={[0,.29,0]} s={[2.84,.26,.93]} m={m.darkWood} r={.025}/><Box p={[0,.75,-.37]} s={[2.83,.87,.23]} m={m.fabric} r={.08}/>
  {[-1,0,1].map(i=><group key={i}><Box p={[i*.86,.48,.05]} s={[.84,.21,.78]} m={m.fabric} r={.07}/><Box p={[i*.86,.83,-.26]} s={[.83,.64,.19]} m={m.fabric} r={.09} rotation={[-.04,0,0]}/></group>)}
  {[-1,1].map(i=><Box key={i} p={[i*1.43,.57,0]} s={[.15,.48,1.0]} m={m.darkWood} r={.025}/>)}
  <Box p={[-1.0,.69,-.05]} s={[.4,.4,.14]} m={m.redFabric} r={.07} rotation={[.1,.05,.22]}/>
  <Box p={[.6,.6,.31]} s={[.65,.07,.5]} m={m.linen} r={.02}/>
  </group>;}

function Doll({m}:{m:RoomMaterials}) {return <group scale={.43} rotation={[0,Math.PI/2,0]}>
  <Ellipsoid p={[0,.39,0]} s={[.22,.3,.17]} m={m.redFabric}/><mesh position={[0,.27,0]} castShadow><coneGeometry args={[.32,.55,24]}/><primitive object={m.redFabric} attach="material"/></mesh>
  <Ellipsoid p={[0,.83,0]} s={[.23,.25,.2]} c="#c59c7e"/><Ellipsoid p={[0,.98,-.025]} s={[.24,.14,.21]} c="#574334"/>
  {[-1,1].map(i=><group key={i}><Ellipsoid p={[i*.25,.97,-.025]} s={[.1,.115,.1]} c="#574334"/><Cyl p={[i*.08,.83,.194]} radius={.025} depth={.012} m={m.black} rotation={[Math.PI/2,0,0]}/><Ellipsoid p={[i*.24,.4,.02]} s={[.09,.23,.085]} m={m.redFabric}/><Ellipsoid p={[i*.14,.025,.03]} s={[.105,.16,.11]} c="#b8987c"/></group>)}
  <Box p={[0,.43,.17]} s={[.16,.16,.014]} m={m.linen} r={.015}/><Ellipsoid p={[0,.77,.195]} s={[.04,.015,.006]} c="#8d6253"/>
  </group>;}

function TV({m}:{m:RoomMaterials}) {
  const screen=useMemo(()=>new THREE.MeshPhysicalMaterial({color:'#627b74',roughness:.18,metalness:.18,clearcoat:.85,clearcoatRoughness:.14}),[]);
  return <group rotation={[0,-Math.PI/2,0]}>
  <Box s={[.83,.63,.53]} c="#343b38" r={.065}/><Box p={[-.06,.035,.278]} s={[.61,.47,.05]} m={m.black} r={.055}/>
  <Box p={[-.06,.035,.31]} s={[.55,.40,.035]} m={screen} r={.015}/>
  <Box p={[-.06,-.245,.315]} s={[.13,.012,.006]} c="#a5aca1"/>
  {Array.from({length:7},(_,i)=><Box key={i} p={[.327,-.06+i*.025,.28]} s={[.11,.006,.012]} c="#1c2521"/>)}
  <Cyl p={[.32,.19,.29]} radius={.037} depth={.035} c="#7e8479" rotation={[Math.PI/2,0,0]}/>
  <Box p={[0,-.35,0]} s={[.55,.09,.35]} m={m.black}/><Box p={[0,.36,-.08]} s={[.2,.09,.17]} c="#5b6155"/>
  {[-1,1].map(i=><Cyl key={i} p={[i*.15,.55,-.08]} radius={.007} depth={.46} m={m.metal} rotation={[0,0,i*-.55]}/>)}
  <pointLight position={[-.02,.03,.5]} intensity={.24} color="#b5cec9" distance={2}/>
  </group>;}

function Frame({m,texture}:{m:RoomMaterials;texture:THREE.Texture}) {return <group>
  <Box s={[.62,.48,.045]} m={m.darkWood} r={.008}/><Box p={[0,0,.026]} s={[.55,.415,.01]} c="#dbd0b5"/>
  <mesh position={[0,0,.033]}><planeGeometry args={[.49,.35]}/><meshStandardMaterial map={texture} roughness={.74}/></mesh><Box p={[0,-.248,-.04]} s={[.28,.035,.15]} m={m.darkWood}/>
  </group>;}

function useFamilyPhoto() {
  const fallback=useMemo(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d')!;x.fillStyle='#a9b5a0';x.fillRect(0,0,320,240);x.fillStyle='#c8b798';x.fillRect(0,130,320,110);for(const [px,py,r]of [[110,90,28],[200,112,23]]){x.fillStyle='#ddd3bb';x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();x.fillStyle=px===110?'#6d7c77':'#997753';x.fillRect(px-r,py+r,r*2,95);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;},[]);
  const [photo,setPhoto]=useState<THREE.Texture>(fallback);
  useEffect(()=>{let active=true;const texture=new THREE.TextureLoader().load('/assets/images/family-photo.png',t=>{t.colorSpace=THREE.SRGBColorSpace;if(active)setPhoto(t);},undefined,()=>{});return()=>{active=false;texture.dispose();};},[]);return photo;
}

function Anchor({id,p,children,interactive,visited,hint,selected,onAnchor}:{id:AnchorId;p:V3;children:React.ReactNode;interactive:boolean;visited:boolean;hint:boolean;selected:boolean;onAnchor:(id:AnchorId)=>void;viewMode:NavigationMode}) {
  const {gl}=useThree();const [hover,setHover]=useState(false);
  useEffect(()=>{if(!interactive){setHover(false);document.body.style.cursor='auto';}},[interactive]);
  const visit=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();gl.domElement.dataset.lastAnchorSource=`mesh:${id}`;onAnchor(id);};
  return <group position={p} name={`memory-anchor-${id}`} onClick={interactive?visit:undefined} onPointerOver={interactive?(e)=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer';}:undefined} onPointerOut={interactive?()=>{setHover(false);document.body.style.cursor='auto';}:undefined}>
    {children}
    {(hover||hint||visited||selected)&&<pointLight position={[0,.3,.1]} color={visited?'#b9d9a8':'#f8dfb1'} intensity={hover?.7:.16} distance={1.25}/>}
  </group>;
}

function Cup({p,m,blue=false}:{p:V3;m:RoomMaterials;blue?:boolean}) {return <group position={p}><Cyl radius={.075} depth={.012} m={m.ceramic}/><Cyl p={[0,.049,0]} radius={.052} bottom={.043} depth={.09} c={blue?'#adc2bf':'#e5decd'}/><Cyl p={[0,.095,0]} radius={.044} depth={.005} c="#715b38"/><mesh position={[.055,.05,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.025,.008,8,20]}/><primitive object={m.ceramic} attach="material"/></mesh></group>;}

function LivingFurniture({m,photo,props}:{m:RoomMaterials;photo:THREE.Texture;props:RoomProps}) {
  const interactive=props.phase==='exploration';
  return <group name="living-room-furnishings">
    <Sofa m={m}/>
    <Anchor id="doll" p={ANCHOR_POSITIONS.doll} interactive={interactive} visited={props.visited.includes('doll')} hint={props.hint} selected={props.selected==='doll'} onAnchor={props.onAnchor} viewMode={props.viewMode}><group position={[0,-.28,0]}><Doll m={m}/></group></Anchor>
    <group position={[3.5,0,-2.15]} rotation={[0,-Math.PI/2,0]}><Box p={[0,.38,0]} s={[1.7,.68,.67]} m={m.darkWood} r={.015}/><Box p={[0,.76,0]} s={[1.81,.085,.74]} m={m.wood} r={.015}/>{[-.5,.5].map(x=><group key={x}><Box p={[x,.43,.344]} s={[.62,.45,.025]} m={m.wood}/><Box p={[x,.47,.365]} s={[.16,.018,.025]} m={m.metal}/></group>)}<Box p={[0,.07,0]} s={[1.56,.14,.5]} m={m.black}/><Box p={[0,.14,.366]} s={[.54,.09,.025]} c="#38413b"/></group>
    <Anchor id="tv" p={ANCHOR_POSITIONS.tv} interactive={interactive} visited={props.visited.includes('tv')} hint={props.hint} selected={props.selected==='tv'} onAnchor={props.onAnchor} viewMode={props.viewMode}><TV m={m}/></Anchor>
    <group position={[.25,0,-3.04]}><Box p={[0,.53,0]} s={[1.6,.96,.61]} m={m.wood} r={.012}/><Box p={[0,1.04,0]} s={[1.69,.07,.68]} m={m.darkWood}/>{[-.38,.38].map(x=><group key={x}><Box p={[x,.61,.317]} s={[.72,.63,.035]} m={m.wood}/><Cyl p={[x,.66,.35]} radius={.022} depth={.02} m={m.metal} rotation={[Math.PI/2,0,0]}/></group>)}<BookRow p={[-.64,1.08,.0]} count={4} m={m}/></group>
    <Anchor id="photo" p={ANCHOR_POSITIONS.photo} interactive={interactive} visited={props.visited.includes('photo')} hint={props.hint} selected={props.selected==='photo'} onAnchor={props.onAnchor} viewMode={props.viewMode}><Frame m={m} texture={photo}/></Anchor>
    <group position={[0,0,-.25]}><Box p={[0,.44,0]} s={[1.8,.07,1.1]} m={m.wood} r={.025}/>{[-.75,.75].flatMap(x=>[-.4,.4].map(z=><Box key={`${x}${z}`} p={[x,.22,z]} s={[.055,.43,.055]} m={m.darkWood}/>))}<Box p={[0,.16,0]} s={[1.55,.04,.85]} m={m.wood}/><Cup p={[-.43,.485,-.12]} m={m}/>{props.branch==='imagined'&&<Cup p={[.4,.485,.15]} blue m={m}/>}<Cyl p={[.12,.49,-.15]} radius={.16} depth={.02} m={m.ceramic}/>{[0,1,2].map(i=><Ellipsoid key={i} p={[.04+i*.065,.55,-.14+(i%2)*.07]} s={[.047,.047,.04]} c="#c7a25b"/>)}<Box p={[-.45,.487,.27]} s={[.42,.01,.27]} c="#e7e0cb" rotation={[0,.14,0]}/><Box p={[.1,.2,.22]} s={[.28,.04,.16]} c="#898c7d"/></group>
    <group position={[-3.4,0,2.98]}><Box p={[0,.86,0]} s={[1.05,1.65,.7]} m={m.wood}/>{[.3,.78,1.25].map((y,i)=><group key={y}><Box p={[0,y,.365]} s={[.95,.04,.045]} m={m.darkWood}/><BookRow p={[-.41,y+.03,.12]} count={i===2?7:12} m={m}/></group>)}<Box p={[0,1.72,0]} s={[1.13,.08,.77]} m={m.darkWood}/></group>
    <Plant p={[2.85,0,2.65]} scale={1.3} m={m}/><Plant p={[-3.34,0,-2.7]} scale={.8} m={m}/>
    <Socket p={[3.89,.34,-1.1]} rotation={-Math.PI/2} m={m}/><Socket p={[-3.89,.34,1.5]} rotation={Math.PI/2} m={m}/><Switch p={[-.77,1.26,-3.39]} m={m}/>
    <CurtainTie m={m}/>
    <group position={[1.75,2.15,-3.39]}><Cyl radius={.18} depth={.04} m={m.darkWood} rotation={[Math.PI/2,0,0]}/><Cyl p={[0,0,.025]} radius={.16} depth={.008} m={m.ceramic} rotation={[Math.PI/2,0,0]}/><Box p={[.025,.045,.035]} s={[.009,.11,.007]} c="#474c43" rotation={[0,0,-.4]}/><Box p={[-.04,.0,.036]} s={[.10,.008,.007]} c="#474c43"/></group>
    <group position={[2.6,1.65,-3.39]}><Box s={[.36,.52,.016]} c="#e5dece"/><Box p={[0,.18,.013]} s={[.36,.14,.01]} c="#a65b4c"/>{Array.from({length:20},(_,i)=><Box key={i} p={[-.125+(i%5)*.062,.055-Math.floor(i/5)*.065,.012]} s={[.016,.021,.006]} c="#8d8270"/>)}</group>
    <Box p={[.15,.013,.4]} s={[2.5,.018,2.5]} c="#b5b0a0" r={.04}/>
    <group position={[0,2.88,0]}><Cyl radius={.14} depth={.025} m={m.darkMetal}/><mesh position={[0,-.018,0]}><sphereGeometry args={[.13,28,14,0,Math.PI*2,Math.PI/2,Math.PI/2]}/><meshStandardMaterial color="#e9e2cc" roughness={.35} emissive="#e8d7b2" emissiveIntensity={props.branch==='imagined'?.25:.04} side={THREE.DoubleSide}/></mesh></group>
  </group>;
}

function Kitchen({m,branch}:{m:RoomMaterials;branch:Branch|null}) {return <group name="connected-kitchen">
  <group position={[-1.3,0,-6.39]}>
    <Box p={[0,.44,0]} s={[5.25,.87,.65]} c="#9ba99d" r={.01}/><Box p={[0,.91,0]} s={[5.38,.07,.73]} c="#c7c7b9" r={.015}/>
    {Array.from({length:7},(_,i)=><group key={i} position={[-2.25+i*.75,0,0]}><Box p={[0,.45,.337]} s={[.71,.73,.03]} c={i%2?'#9aa79c':'#a9b4a9'}/><Box p={[.24,.66,.365]} s={[.018,.13,.025]} m={m.metal}/></group>)}
    <Box p={[0,1.22,-.30]} s={[5.3,.58,.02]} m={m.tile}/>
    <Box p={[1.7,1.97,-.17]} s={[1.63,.87,.37]} c="#d1d6ca"/>{[1.31,2.08].map(x=><group key={x}><Box p={[x,1.97,.024]} s={[.73,.81,.025]} c="#dbe0d5"/><Box p={[x-.23,1.78,.046]} s={[.018,.13,.025]} m={m.metal}/></group>)}
    <Box p={[-.9,.956,0]} s={[1.0,.016,.5]} m={m.metal} r={.06}/><Box p={[-.9,.964,0]} s={[.74,.018,.36]} c="#858f88" r={.075}/><Box p={[-.9,.975,0]} s={[.61,.009,.26]} c="#687a73" r={.07}/>
    <Cyl p={[-.93,1.13,-.23]} radius={.016} depth={.34} m={m.metal}/><Cyl p={[-.93,1.28,-.17]} radius={.015} depth={.14} m={m.metal} rotation={[Math.PI/2,0,0]}/><Box p={[-.75,1.0,-.23]} s={[.07,.035,.04]} c="#b5b9b1" r={.01}/>
    <Box p={[.8,.96,0]} s={[.73,.025,.5]} m={m.darkMetal} r={.015}/>{[.58,1.03].map(x=><group key={x}><Cyl p={[x,.98,0]} radius={.12} depth={.025} m={m.black}/><Box p={[x,.999,0]} s={[.27,.02,.03]} m={m.darkMetal}/><Box p={[x,.999,0]} s={[.03,.02,.27]} m={m.darkMetal}/></group>)}
    <Cyl p={[.57,1.08,0]} radius={.105} depth={.16} m={m.metal}/><Cyl p={[.57,1.17,0]} radius={.11} depth={.025} m={m.metal}/><Cyl p={[.57,1.19,0]} radius={.025} depth={.035} m={m.black}/>
    <Box p={[.8,2.41,-.1]} s={[.9,.18,.5]} m={m.metal} r={.03}/><Box p={[.8,2.66,-.24]} s={[.35,.4,.19]} m={m.metal}/>
    <Box p={[-2.05,.98,.0]} s={[.44,.03,.3]} m={m.wood} r={.03}/><Box p={[-2.0,1.15,-.13]} s={[.22,.31,.02]} m={m.wood} r={.015}/>
  </group>
  <group position={[3.18,0,-6.13]}><Box p={[0,.91,0]} s={[1.15,1.82,1.05]} c="#d3d8cf" r={.045}/><Box p={[0,1.49,.54]} s={[1.08,.52,.025]} c="#e1e4dc" r={.025}/><Box p={[0,.63,.54]} s={[1.08,1.13,.025]} c="#dce1d9" r={.025}/><Box p={[-.39,1.47,.58]} s={[.035,.3,.055]} c="#919d91" r={.01}/><Box p={[-.39,.87,.58]} s={[.035,.39,.055]} c="#919d91" r={.01}/><Box p={[.2,1.35,.565]} s={[.18,.18,.01]} c="#c4ac78"/><Box p={[.11,1.54,.565]} s={[.08,.055,.01]} c="#a76e58"/></group>
  <group position={[1.4,0,-5.07]}><Box p={[0,.75,0]} s={[1.55,.065,.9]} m={m.wood} r={.018}/>{[-.65,.65].flatMap(x=>[-.33,.33].map(z=><Box key={`${x}${z}`} p={[x,.37,z]} s={[.055,.74,.055]} m={m.darkWood}/>))}<Box p={[0,.793,0]} s={[1.4,.012,.38]} m={m.redFabric}/><Cup p={[-.35,.81,0]} m={m}/><Cyl p={[.2,.82,.05]} radius={.15} depth={.03} m={m.ceramic}/></group>
  <group position={[.7,0,-4.2]}><Box p={[0,.43,0]} s={[.37,.045,.36]} m={m.wood}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Box key={`${x}${z}`} p={[x*.14,.21,z*.14]} s={[.04,.42,.04]} m={m.darkWood}/>))}</group>
  <Switch p={[-2.27,1.25,-3.61]} rotation={Math.PI} m={m}/><Socket p={[-.18,1.22,-6.68]} m={m}/>
  <Cyl p={[-.4,2.79,-5.0]} radius={.18} depth={.06} m={m.ceramic}/><pointLight position={[-.4,2.4,-5.0]} intensity={branch?4:1.6} color={branch==='real'?'#e4d4b6':'#ffe0ac'} distance={6} decay={2}/>
  </group>;}

function Balcony({m}:{m:RoomMaterials}) {return <group name="connected-balcony">
  <Plant p={[6.35,.03,-2.09]} scale={1.5} m={m}/><Plant p={[6.3,.03,1.96]} scale={1.65} m={m}/><Plant p={[4.7,.03,2.24]} scale={.7} m={m}/>
  <group position={[5.55,2.48,.1]}><Cyl radius={.012} depth={4.8} m={m.metal} rotation={[Math.PI/2,0,0]}/>{[-1.4,0,1.1].map((z,i)=><group key={z} position={[0,-.45,z]}><Cyl p={[0,.45,0]} radius={.008} depth={.5} m={m.metal}/><Box p={[0,-.04,0]} s={[.67,.8,.018]} m={i===1?m.redFabric:m.linen}/><Box p={[0,.38,0]} s={[.69,.025,.025]} m={m.wood}/></group>)}</group>
  <group position={[4.73,0,-2.2]}><Cyl p={[0,.22,0]} radius={.27} depth={.4} c="#b1b8a5"/><Cyl p={[0,.44,0]} radius={.275} depth={.055} c="#d4d8c7"/><Box p={[0,.47,0]} s={[.42,.01,.38]} m={m.linen}/></group>
  <Cyl p={[6.6,1.0,0]} radius={.025} depth={5.4} m={m.darkMetal} rotation={[Math.PI/2,0,0]}/>{Array.from({length:18},(_,i)=><Box key={i} p={[6.6,.64,-2.6+i*.3]} s={[.025,.67,.025]} m={m.darkMetal}/>)}
  </group>;}

function Street({m}:{m:RoomMaterials}) {return <group name="actual-3d-neighborhood">
  <Box p={[14,-.35,-3]} s={[13,.5,30]} c="#9b9d8e"/>
  <Box p={[13,-.08,-3]} s={[3,.025,30]} c="#707775"/>
  {Array.from({length:9},(_,i)=><Box key={i} p={[13,-.06,-16+i*3.5]} s={[.08,.01,1.7]} c="#c8c7b0"/>)}
  {[-10,4,15].map((z,i)=><group key={z} position={[18,0,z]}><Box p={[0,3.7,0]} s={[5,7.4,6]} c={i%2?'#aba69a':'#c0b8a7'}/>{Array.from({length:5},(_,row)=>Array.from({length:3},(_,col)=><group key={`${row}${col}`} position={[-2.53,1+row*1.2,-2+col*2]}><Box s={[.025,.87,.7]} c="#626e66"/><Box p={[-.025,0,0]} s={[.018,.74,.59]} c="#94aaa7"/><Box p={[-.04,0,0]} s={[.012,.76,.025]} c="#d0cdc0"/></group>))}<Box p={[-2.5,7.48,0]} s={[.2,.16,6.2]} c="#9f9a88"/></group>)}
  {[-9,-1,7].map((z,i)=><group key={z} position={[9.5,0,z]}><Cyl p={[0,1.45,0]} radius={.15} bottom={.22} depth={2.9} c="#736d54"/>{[0,1,2,3,4].map(j=><Ellipsoid key={j} p={[Math.sin(j*2.3)*.75,3.05+j*.18,Math.cos(j*2.3)*.65]} s={[1.15,.9,1.15]} c={i%2?'#7b8f65':'#69865c'}/>)}<Cyl p={[.27,2.05,.02]} radius={.07} depth={1.4} c="#736d54" rotation={[0,0,-.5]}/></group>)}
  {[-3,2.5].map(z=><group key={z} position={[-7.0,0,z]}><Cyl p={[0,1.1,0]} radius={.12} depth={2.2} c="#7c7558"/><Ellipsoid p={[0,2.9,0]} s={[1.2,1.4,1.2]} c="#7f956c"/><Ellipsoid p={[.6,2.3,.2]} s={[.8,.9,.8]} c="#718d5d"/></group>)}
  <group position={[11,0,-4]}><Box p={[0,.45,0]} s={[1.6,.47,3.6]} c="#9baca3" r={.15}/><Box p={[0,.94,.1]} s={[1.35,.65,1.8]} c="#79938f" r={.2}/><Box p={[0,.97,.1]} s={[1.37,.43,1.46]} c="#59726e" r={.05}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Cyl key={`${x}${z}`} p={[x*.75,.33,z*1.1]} radius={.3} depth={.2} m={m.black} rotation={[0,0,Math.PI/2]}/>))}</group>
  </group>;}

export default function Room(props:RoomProps) {
  const m=useRoomMaterials();const photo=useFamilyPhoto();
  const departure=props.branch==='real'&&props.realDeparture;
  const characterPosition:V3=departure?[-1.47,0,-3.94]:props.branch==='imagined'?[-1.5,0,-.38]:[-2.35,0,-1.6];
  return <group name="memory-home-standard-scale">
    <Shell m={m} walk={props.viewMode==='walk'}/><LivingFurniture m={m} photo={photo} props={props}/><Kitchen m={m} branch={props.branch}/><Balcony m={m}/><Street m={m}/>
    <Suspense fallback={null}><Character preset={props.companion} position={characterPosition} rotation={departure?Math.PI:props.branch==='imagined'?Math.PI/2:.5} pose="standing"/></Suspense>
    {props.branch==='imagined'&&<pointLight position={[-.4,1.7,-.3]} intensity={1.0} color="#ffe3b0" distance={4}/>}
  </group>;
}
