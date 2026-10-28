import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AnchorId, Branch, SceneProps } from '../types';

const palette = { wood:'#a7734c', dark:'#65462f', edge:'#8b5c3d', cream:'#e9dfca', sage:'#899e89', red:'#ae4f42', gold:'#bd9755' };
type V3 = [number,number,number];

function woodTexture() {
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const x=c.getContext('2d')!;
  x.fillStyle='#bcb3a4'; x.fillRect(0,0,256,256);
  for(let i=0;i<120;i++) {
    x.strokeStyle=`rgba(68,39,20,${.025+(i%7)*.008})`;x.lineWidth=.4+(i%3)*.4;x.beginPath();
    for(let j=0;j<=16;j++) { const xx=j*16, yy=i*2.2+Math.sin(j*.6+i*.9)*2.8; if(!j)x.moveTo(xx,yy);else x.lineTo(xx,yy); } x.stroke();
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}

function portraitTexture() {
  const c=document.createElement('canvas');c.width=512;c.height=384;const ctx=c.getContext('2d')!;
  const g=ctx.createLinearGradient(0,0,0,384);g.addColorStop(0,'#c8c3a3');g.addColorStop(1,'#e8d8b4');ctx.fillStyle=g;ctx.fillRect(0,0,512,384);
  ctx.fillStyle='#8c9a78';for(let i=0;i<15;i++){ctx.beginPath();ctx.arc(25+i*38,90+Math.sin(i)*30,55,0,Math.PI*2);ctx.fill();}
  const people=[{x:175,y:180,s:1.1,shirt:'#898f86',hair:'#d4cec1'},{x:295,y:220,s:.75,shirt:'#b65e4c',hair:'#483e34'}];
  for(const p of people){ctx.fillStyle=p.shirt;ctx.beginPath();ctx.ellipse(p.x,p.y+92*p.s,57*p.s,78*p.s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.hair;ctx.beginPath();ctx.arc(p.x,p.y,40*p.s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dfbb92';ctx.beginPath();ctx.ellipse(p.x,p.y+10*p.s,33*p.s,36*p.s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5d4b3c';for(const dx of [-10,10]){ctx.beginPath();ctx.arc(p.x+dx*p.s,p.y+8*p.s,2.4*p.s,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#997b65';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y+18*p.s,9*p.s,.2,Math.PI-.2);ctx.stroke();}
  ctx.fillStyle='rgba(255,243,216,.14)';ctx.fillRect(0,0,512,384);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function usePortrait() {
  const fallback=useMemo(portraitTexture,[]);const [texture,setTexture]=useState<THREE.Texture>(fallback);
  useEffect(()=>{let active=true;let loaded:THREE.Texture|undefined;new THREE.TextureLoader().load('/assets/images/family-photo.png',t=>{loaded=t;t.colorSpace=THREE.SRGBColorSpace;if(active)setTexture(t);else t.dispose();},undefined,()=>{});return()=>{active=false;loaded?.dispose();fallback.dispose();};},[fallback]);return texture;
}

function Block({p=[0,0,0],s=[1,1,1],c=palette.wood,r=.035,rotation=[0,0,0],map,emissive}:{p?:V3;s?:V3;c?:string;r?:number;rotation?:V3;map?:THREE.Texture;emissive?:string}) {
  return <RoundedBox args={s} radius={Math.min(r,...s.map(n=>n/3))} smoothness={2} position={p} rotation={rotation} castShadow receiveShadow><meshStandardMaterial color={c} map={map} roughness={.84} emissive={emissive||'#000'} emissiveIntensity={.25}/></RoundedBox>;
}
function Sphere({p=[0,0,0],s=[1,1,1],c=palette.cream}:{p?:V3;s?:V3;c?:string}) {return <mesh position={p} scale={s} castShadow><sphereGeometry args={[1,20,16]}/><meshStandardMaterial color={c} roughness={.86}/></mesh>;}
function Tube({p=[0,0,0],s=[.1,.4,.1],c=palette.dark,rotation=[0,0,0],top}:{p?:V3;s?:V3;c?:string;rotation?:V3;top?:number}) {return <mesh position={p} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[top??s[0],s[2],s[1],20]}/><meshStandardMaterial color={c} roughness={.8}/></mesh>;}

function Plant({p=[0,0,0],scale=1}:{p?:V3;scale?:number}) {return <group position={p} scale={scale}>
  <Tube p={[0,.25,0]} s={[.3,.5,.24]} top={.34} c="#ad7654"/><Tube p={[0,.505,0]} s={[.29,.025,.29]} c="#69563c"/>
  {[0,1,2,3,4,5,6].map(i=><group key={i} rotation={[0,i*2.4,0]}><Tube p={[.08,.8+i*.025,0]} s={[.018,.7,.018]} c="#697b52" rotation={[0,0,-.25]}/><Sphere p={[.23,1.02+i*.035,0]} s={[.16,.38,.065]} c={i%2?'#82956b':'#657d57'}/></group>)}
  </group>;}

function Books({p=[0,0,0],count=5}:{p?:V3;count?:number}) {return <group position={p}>{Array.from({length:count},(_,i)=><group key={i} position={[i*.16,.3+(i%3)*.025,0]} rotation={[0,0,i===count-1?-.1:0]}><Block s={[.13,.6+(i%3)*.05,.36]} c={['#798e80','#b47c60','#d1b58a','#879399','#a7866a'][i%5]} r={.012}/><Block p={[0,.16,.184]} s={[.08,.018,.008]} c="#e0d0af" r={.002}/></group>)}</group>;}

function Frame({p=[0,0,0],scale=1,rotation=[0,0,0],texture}:{p?:V3;scale?:number;rotation?:V3;texture:THREE.Texture}) {return <group position={p} scale={scale} rotation={rotation}>
  <Block s={[1.04,.83,.09]} c="#7d523b" r={.025}/><Block p={[0,0,.051]} s={[.92,.72,.025]} c="#ecdebe" r={.006}/>
  <mesh position={[0,0,.068]}><planeGeometry args={[.77,.56]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>
  <Block p={[0,-.44,-.07]} s={[.5,.08,.27]} c="#7d523b"/>
  </group>;}

function Doll({p=[0,0,0],scale=1,rotation=[0,0,0]}:{p?:V3;scale?:number;rotation?:V3}) {return <group position={p} scale={scale} rotation={rotation}>
  <Sphere p={[0,.49,0]} s={[.27,.34,.19]} c="#b95546"/>
  <mesh position={[0,.48,0]} castShadow><coneGeometry args={[.36,.64,24]}/><meshStandardMaterial color="#ac4d40" roughness={.99}/></mesh>
  <Sphere p={[0,.99,0]} s={[.25,.26,.21]} c="#e7be92"/>
  <Sphere p={[0,1.13,-.04]} s={[.265,.17,.2]} c="#65402d"/>
  {[-1,1].map(i=><group key={i}><Sphere p={[i*.26,1.08,-.02]} s={[.11,.13,.12]} c="#65402d"/><Sphere p={[i*.08,.99,.204]} s={[.03,.033,.012]} c="#3d3028"/><Sphere p={[i*.28,.57,.025]} s={[.12,.27,.11]} c="#c56855"/><Sphere p={[i*.17,.12,.07]} s={[.12,.23,.12]} c="#d2a07b"/><Sphere p={[i*.17,.035,.13]} s={[.135,.07,.16]} c="#7a4937"/></group>)}
  <Block p={[0,.64,.19]} s={[.18,.18,.016]} c="#e8c9a3" r={.018} rotation={[0,0,.1]}/>
  <Sphere p={[.09,.93,.19]} s={[.042,.025,.009]} c="#ce8d79"/>
  </group>;}

function Person({p=[0,0,0],scale=1,grandma=false,rotation=0,seated=false}:{p?:V3;scale?:number;grandma?:boolean;rotation?:number;seated?:boolean}) {return <group position={p} scale={scale} rotation={[0,rotation,0]}>
  <mesh position={[0,seated?.69:.88,0]} castShadow><coneGeometry args={[.38,1.1,16]}/><meshStandardMaterial color={grandma?'#8d9b8e':'#c4b27d'} roughness={1}/></mesh>
  <Block p={[0,seated?.65:.8,.26]} s={[.43,.7,.035]} c={grandma?'#d6c8ac':'#e7ddc5'} r={.025}/>
  <Sphere p={[0,seated?1.37:1.58,0]} s={[.25,.3,.24]} c="#d9b38f"/>
  <Sphere p={[0,seated?1.52:1.73,-.035]} s={[.26,.18,.24]} c={grandma?'#d0cbc0':'#443a2f'}/>
  {grandma&&<Sphere p={[0,seated?1.49:1.7,-.21]} s={[.15,.14,.13]} c="#c4bfb3"/>}
  {[-1,1].map(i=><group key={i}><Sphere p={[i*.083,seated?1.38:1.59,.222]} s={[.018,.023,.012]} c="#5b4c3f"/>
  <Tube p={[i*.31,seated?.85:1.01,.05]} s={[.09,.68,.085]} c={grandma?'#8d9b8e':'#c4b27d'} rotation={[seated?-.7:0,0,i*.12]}/><Sphere p={[i*.34,seated?.61:.66,seated?.22:.05]} s={[.09,.11,.08]} c="#d9b38f"/>
  <Tube p={[i*.15,seated?.2:.31,seated?.19:0]} s={[.085,seated?.38:.62,.08]} c="#67665a"/><Sphere p={[i*.15,.04,seated?.3:.07]} s={[.11,.07,.18]} c="#564b3e"/></group>)}
  {grandma&&<group position={[0,seated?1.4:1.61,.231]}>{[-1,1].map(i=><mesh key={i} position={[i*.09,0,0]} rotation={[0,0,0]}><torusGeometry args={[.064,.008,6,20]}/><meshStandardMaterial color="#897e6b"/></mesh>)}<Block s={[.045,.012,.016]} c="#897e6b" r={.003}/></group>}
  </group>;}

function TeaCup({p=[0,0,0],c='#e6dfca'}:{p?:V3;c?:string}) {return <group position={p}><Tube p={[0,.09,0]} s={[.095,.18,.075]} c={c}/><Tube p={[0,.182,0]} s={[.077,.008,.077]} c="#8d7048"/><mesh position={[.093,.1,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.055,.018,8,16]}/><meshStandardMaterial color={c}/></mesh><Tube s={[.15,.023,.15]} c={c}/></group>;}

function Envelope({p=[0,0,0],scale=1,rotation=[0,0,0]}:{p?:V3;scale?:number;rotation?:V3}) {return <group position={p} scale={scale} rotation={rotation}><Block s={[1,.035,.66]} c="#ead9b6" r={.01}/><mesh position={[0,.025,.05]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.085,24]}/><meshStandardMaterial color="#a95c48" roughness={1}/></mesh><mesh position={[0,.02,-.12]} rotation={[-Math.PI/2,0,0]}><coneGeometry args={[.42,.32,3]}/><meshStandardMaterial color="#f3e6cc" side={THREE.DoubleSide}/></mesh></group>;}

function DeskLamp({p=[0,0,0]}:{p?:V3}) {return <group position={p}><Tube s={[.35,.1,.35]} c="#5a7065"/><Tube p={[0,.75,0]} s={[.045,1.45,.045]} c="#b3a17a" rotation={[0,0,-.18]}/><mesh position={[.2,1.5,0]} castShadow><coneGeometry args={[.48,.57,24,1,true]}/><meshStandardMaterial color="#7d9681" roughness={.85} side={THREE.DoubleSide}/></mesh><Sphere p={[.2,1.32,0]} s={[.13,.1,.13]} c="#fce7b2"/><pointLight position={[.2,1.25,0]} intensity={3} color="#ffdf9d" distance={4} decay={2}/></group>;}

function MemoryBox({open,collected,onBox,wood}:{open:boolean;collected:boolean;onBox:()=>void;wood:THREE.Texture}) {
  const lid=useRef<THREE.Group>(null);const [hover,setHover]=useState(false);
  useFrame((_,dt)=>{if(lid.current)lid.current.rotation.x=THREE.MathUtils.damp(lid.current.rotation.x,open?-.92:hover?-.12:0,5,dt);});
  return <group position={[.55,1.68,.1]} rotation={[0,-.13,0]} onClick={(e)=>{e.stopPropagation();onBox();}} onPointerOver={(e)=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHover(false);document.body.style.cursor='auto';}}>
    <Block p={[0,.06,0]} s={[2.55,.18,1.83]} c="#7e5235" map={wood}/><Block p={[0,.42,-.84]} s={[2.55,.69,.14]} c="#87603e" map={wood}/><Block p={[0,.42,.84]} s={[2.55,.69,.14]} c="#87603e" map={wood}/>{[-1,1].map(i=><Block key={i} p={[i*1.2,.42,0]} s={[.15,.69,1.7]} c="#87603e" map={wood}/>)}
    <Block p={[0,.17,0]} s={[2.22,.05,1.5]} c="#8d7755"/>
    <group ref={lid} position={[0,.78,-.88]}><Block p={[0,.045,.88]} s={[2.62,.18,1.85]} c="#a2744b" map={wood} r={.07}/><Block p={[0,.145,.88]} s={[2.15,.035,1.42]} c="#aa8158" map={wood}/>
      <Block p={[0,.171,.88]} s={[1.06,.012,.5]} c="#cfba8b" r={.025}/><Block p={[0,.181,.88]} s={[.84,.007,.016]} c="#9c8252" r={.001}/><Block p={[0,.183,.75]} s={[.34,.007,.01]} c="#9c8252" r={.001}/><Block p={[0,.183,1.02]} s={[.34,.007,.01]} c="#9c8252" r={.001}/>
    </group>
    <Block p={[0,.62,.931]} s={[.24,.27,.05]} c="#c7a465" r={.02}/><Tube p={[0,.59,.97]} s={[.027,.05,.027]} c="#755b3c" rotation={[Math.PI/2,0,0]}/>
    {[-1,1].map(i=><group key={i}><Block p={[i*1.12,.13,.94]} s={[.22,.19,.035]} c="#ba985b"/><Block p={[i*1.12,.13,-.94]} s={[.22,.19,.035]} c="#ba985b"/></group>)}
    {collected&&<><Doll p={[-.48,.19,-.05]} scale={.52} rotation={[0,.08,.15]}/><Envelope p={[.49,.24,.17]} scale={.8} rotation={[0,.12,0]}/><Block p={[.58,.21,-.45]} s={[.75,.03,.48]} c="#f3e4c3" rotation={[0,-.1,0]}/></>}
    {hover&&<pointLight position={[0,1,.5]} intensity={1.2} color="#ffe5b1" distance={3}/>}
  </group>;
}

function PresentRoom({collected,phase,onBox,wood,portrait}:{collected:boolean;phase:SceneProps['phase'];onBox:()=>void;wood:THREE.Texture;portrait:THREE.Texture}) {
  return <group>
    <Block p={[0,-.26,0]} s={[9.8,.48,7.1]} c="#c8bda9" r={.16}/>
    {Array.from({length:14},(_,i)=><Block key={i} p={[-4.5+i*.69,.002,0]} s={[.68,.09,6.94]} c={i%3===0?'#bcac95':'#cbbda8'} map={wood} r={.004}/>)}
    <Block p={[0,1.9,-3.45]} s={[9.8,3.9,.16]} c="#d9d5c2" r={.02}/><Block p={[-4.82,1.9,0]} s={[.16,3.9,7]} c="#d1d0bd" r={.02}/>
    <Block p={[0,.12,-3.28]} s={[9.6,.22,.12]} c="#aaa18b"/>
    <group position={[-4.7,2.35,-.9]} rotation={[0,Math.PI/2,0]}><Window/></group>
    <group position={[.35,0,.35]}>
      <Block p={[0,1.53,0]} s={[6.7,.2,3.55]} c="#a3896a" map={wood} r={.07}/><Block p={[0,1.37,0]} s={[6.42,.18,3.31]} c="#8d7559" map={wood}/>
      {[-2.9,2.9].flatMap(x=>[-1.3,1.3].map(z=><Block key={`${x}${z}`} p={[x,.72,z]} s={[.19,1.4,.19]} c="#7d5c41" map={wood}/>))}
      <MemoryBox open={collected||phase==='transition-in'||phase==='memory-room'} collected={collected} onBox={onBox} wood={wood}/>
      <DeskLamp p={[-2.32,1.65,-.91]}/><Frame p={[-1.7,2.03,-.65]} scale={.67} rotation={[0,.13,0]} texture={portrait}/>
      <Block p={[-.15,1.657,.92]} s={[.91,.025,.7]} c="#eee0c1" rotation={[0,.2,0]}/><mesh position={[-.15,1.676,.92]} rotation={[-Math.PI/2,0,.2]}><planeGeometry args={[.72,.49]}/><meshStandardMaterial map={portrait} roughness={1}/></mesh>
      <Block p={[-1.26,1.65,.76]} s={[.8,.025,.6]} c="#eee0c1" rotation={[0,-.25,0]}/>
      <Books p={[2.41,1.65,-1.02]} count={3}/><TeaCup p={[2.58,1.65,.9]} c="#b7c3ae"/>
      <Block p={[-.65,1.66,-1.18]} s={[1.35,.07,.56]} c="#cfb794" rotation={[0,.05,0]}/><Block p={[-.65,1.706,-1.18]} s={[1.27,.012,.5]} c="#dfcba6" rotation={[0,.05,0]}/>
    </group>
    <Plant p={[3.8,.08,-2.4]} scale={1.35}/>
    <Block p={[-2.72,1.15,-3.24]} s={[1.8,1.32,.12]} c="#b39e7b"/><Block p={[-2.72,1.16,-3.16]} s={[1.62,1.12,.05]} c="#e4d8bb"/>
    <Frame p={[-2.72,1.18,-3.1]} scale={1.3} texture={portrait}/>
    <Block p={[1.17,2.72,-3.3]} s={[1.37,.96,.1]} c="#a9987a"/><Block p={[1.17,2.72,-3.23]} s={[1.17,.76,.05]} c="#c1c6ad"/>
    <mesh position={[1.17,2.72,-3.197]}><planeGeometry args={[1.02,.61]}/><meshStandardMaterial color="#a4b296" roughness={1}/></mesh>
  </group>;
}

function Window() {return <group>
  <Block s={[2.46,2.38,.18]} c="#a3a58e"/><Block p={[0,0,.11]} s={[2.21,2.11,.025]} c="#d5dbbc"/>
  <mesh position={[0,0,.134]}><planeGeometry args={[2.1,2]}/><meshBasicMaterial color="#edf0ce"/></mesh>
  {[-.53,.53].flatMap(x=>[-.5,.5].map(y=><group key={`${x}${y}`} position={[x,y,.15]}><mesh><planeGeometry args={[.98,.92]}/><meshBasicMaterial color={x<0?'#cbd4b4':'#e4e6c9'}/></mesh><Sphere p={[.2,-.2,.02]} s={[.32,.24,.002]} c="#a7bd90"/></group>))}
  <Block p={[0,0,.2]} s={[.075,2.1,.07]} c="#d3d1b9"/><Block p={[0,0,.2]} s={[2.2,.07,.07]} c="#d3d1b9"/>
  <Block p={[0,-1.25,.13]} s={[2.8,.15,.5]} c="#c8bea4"/>
  <Tube p={[0,1.3,.29]} s={[.035,3.05,.035]} c="#9b8b6a" rotation={[0,0,Math.PI/2]}/>
  {[-1,1].map(side=><group key={side} position={[side*1.08,-.02,.3]}>
    {[0,1,2,3].map(i=><mesh key={i} position={[(i-1.5)*.11,0,Math.sin(i)*.03]} castShadow><cylinderGeometry args={[.09,.105,2.38,8,1,true,.0,Math.PI]}/><meshStandardMaterial color={i%2?'#e5ddc1':'#eee6ce'} roughness={1} side={THREE.DoubleSide}/></mesh>)}
  </group>)}
  </group>;}

const anchorPositions:Record<AnchorId,V3>={tv:[-3.27,2.45,-1.55],doll:[1.78,2.45,-2.2],photo:[3.55,2.64,-2.82]};
const anchorNames:Record<AnchorId,string>={tv:'旧电视',doll:'布娃娃',photo:'旧相框'};

function Anchor({id,p,visited,hint,selected,onAnchor,interactive,children}:{id:AnchorId;p:V3;visited:boolean;hint:boolean;selected:boolean;onAnchor:(id:AnchorId)=>void;interactive:boolean;children:React.ReactNode}) {
  const {gl}=useThree();
  const [hover,setHover]=useState(false);const ref=useRef<THREE.Group>(null);
  useEffect(()=>{if(!interactive){setHover(false);document.body.style.cursor='auto';}},[interactive]);
  useFrame((state)=>{if(ref.current)ref.current.position.y=p[1]+(hover||selected?Math.sin(state.clock.elapsedTime*2)*.015:0);});
  const click=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();gl.domElement.dataset.lastAnchorSource=`mesh:${id}`;onAnchor(id);};
  return <group ref={ref} position={p} onClick={interactive?click:undefined} onPointerOver={interactive?(e)=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer';}:undefined} onPointerOut={interactive?()=>{setHover(false);document.body.style.cursor='auto';}:undefined}>
    {children}
    {(hover||hint||visited||selected)&&<pointLight position={[0,.6,.4]} intensity={hover||selected?1.4:.55} color={visited?'#c4e3ad':'#ffdfa7'} distance={2.1}/>}
    {interactive&&<Html position={[0,1.05,.05]} center zIndexRange={[25,10]} style={{pointerEvents:'auto'}}>
      <button type="button" className={`anchor-hotspot ${visited?'visited':''}`} data-testid={`anchor-${id}`} aria-label={`触摸${anchorNames[id]}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();gl.domElement.dataset.lastAnchorSource=`hotspot:${id}`;onAnchor(id);}} style={{display:'flex',alignItems:'center',gap:7,border:'1px solid rgba(255,255,240,.7)',borderRadius:30,background:visited?'rgba(92,118,91,.92)':'rgba(249,242,224,.94)',color:visited?'#fff9e8':'#64513b',padding:'8px 12px',fontFamily:'inherit',fontSize:12,whiteSpace:'nowrap',cursor:'pointer',boxShadow:'0 3px 15px #392e2215',transform:hover?'translateY(-3px)':'none',transition:'transform .2s'}}><span style={{fontSize:15}}>{visited?'✓':hint?'✧':'+'}</span>{anchorNames[id]}</button>
    </Html>}
  </group>;
}

function TV() {return <group rotation={[0,.32,0]}>
  <Block s={[1.5,1.03,.9]} c="#6b624e" r={.11}/><Block p={[-.1,.04,.47]} s={[1.12,.81,.11]} c="#403f37" r={.12}/><Block p={[-.1,.04,.539]} s={[.98,.67,.055]} c="#9aa993" r={.12} emissive="#b7bfa3"/>
  <mesh position={[-.1,.04,.573]}><planeGeometry args={[.78,.44]}/><meshBasicMaterial color="#afb7a0" transparent opacity={.4}/></mesh>
  {Array.from({length:7},(_,i)=><Block key={i} p={[.61,-.28+i*.05,.48]} s={[.13,.015,.025]} c="#454b3f" r={.003}/>)}
  <Tube p={[.59,.22,.51]} s={[.075,.05,.075]} c="#3e453e" rotation={[Math.PI/2,0,0]}/><Block p={[-.4,-.58,0]} s={[.14,.17,.4]} c="#66523a"/><Block p={[.4,-.58,0]} s={[.14,.17,.4]} c="#66523a"/>
  <Tube p={[0,.78,-.2]} s={[.014,.68,.014]} c="#8f927d" rotation={[0,0,.5]}/><Tube p={[.28,.79,-.2]} s={[.014,.68,.014]} c="#8f927d" rotation={[0,0,-.5]}/>
  <Block p={[0,.58,-.2]} s={[.38,.14,.25]} c="#6c6b59"/>
  </group>;}

function Sofa() {return <group position={[1.4,0,-2.59]}>
  {[-1,1].flatMap(x=>[-.36,.36].map(z=><Block key={`${x}${z}`} p={[x*1.45,.27,z]} s={[.15,.49,.15]} c="#71583d"/>))}
  <Block p={[0,.66,0]} s={[3.58,.5,1.3]} c="#8c9b87" r={.15}/><Block p={[0,1.23,-.49]} s={[3.57,1.09,.39]} c="#929e89" r={.16}/>
  {[-1,0,1].map(i=><group key={i}><Block p={[i*1.02,.98,.03]} s={[.99,.25,1.05]} c={i%2?'#a7af97':'#a1aa94'} r={.11}/><Block p={[i*1.02,1.42,-.4]} s={[.98,.72,.24]} c="#a8af98" r={.14}/><Sphere p={[i*1.02,1.43,-.26]} s={[.025,.025,.009]} c="#8c9c82"/></group>)}
  {[-1,1].map(i=><Block key={i} p={[i*1.8,1.02,0]} s={[.33,.69,1.35]} c="#8e9c85" r={.14}/>)}
  <Block p={[-1.05,1.35,-.1]} s={[.53,.5,.2]} c="#d7bc8c" r={.11} rotation={[.12,0,.15]}/>
  <Block p={[.33,1.12,.33]} s={[.74,.15,.72]} c="#d3ba94" r={.04} rotation={[0,.1,0]}/>
  </group>;}

function Door({branch,realDeparture}:{branch:Branch|null;realDeparture:boolean}) {return <group position={[-.72,0,-3.37]}>
  <Block p={[0,1.51,-.03]} s={[1.45,3.02,.07]} c="#a09373"/>
  <Block p={[0,1.52,.022]} s={[1.25,2.82,.03]} c={branch==='real'?'#c9b2a0':'#a39b7c'}/>
  {[-1,1].map(i=><Block key={i} p={[i*.75,1.54,.08]} s={[.15,3.1,.18]} c="#8c7654"/>)}<Block p={[0,3.08,.08]} s={[1.65,.16,.18]} c="#8c7654"/>
  <group position={[-.64,1.5,.1]} rotation={[0,branch==='real'&&realDeparture?-.85:-.12,0]}><Block p={[.64,0,0]} s={[1.28,2.88,.11]} c="#a18b66"/><Block p={[.64,.52,.06]} s={[1.03,1.33,.035]} c="#ae9874"/><Block p={[.64,-.77,.06]} s={[1.03,.83,.035]} c="#ae9874"/><Sphere p={[1.12,-.1,.12]} s={[.055,.055,.055]} c="#a9a283"/></group>
  <Block p={[0,.015,.38]} s={[1.45,.02,.7]} c="#b6a58a"/>
  {branch==='real'&&<pointLight position={[0,1.7,.4]} color="#9daab8" intensity={3} distance={4}/>}
  </group>;}

function OldHome({visited,selected,hint,onAnchor,branch,wood,portrait,realDeparture=false,interactive}:{visited:AnchorId[];selected:AnchorId|null;hint:boolean;onAnchor:(id:AnchorId)=>void;branch:Branch|null;wood:THREE.Texture;portrait:THREE.Texture;realDeparture?:boolean;interactive:boolean}) {
  return <group>
    <Block p={[0,-.25,0]} s={[10.14,.52,7.2]} c="#c1b29b" r={.15}/>
    {Array.from({length:19},(_,i)=><Block key={i} p={[-4.77+i*.53,.03,0]} s={[.52,.06,7]} c={i%4===0?'#b8a88e':'#c7b598'} map={wood} r={.003}/>)}
    <Block p={[0,1.8,-3.5]} s={[10.1,3.65,.13]} c="#e4dcc2"/><Block p={[-5,1.8,0]} s={[.13,3.65,7.1]} c="#d8d7bf"/>
    <Block p={[0,.11,-3.39]} s={[10,.2,.12]} c="#a89978"/><Block p={[-4.9,.11,0]} s={[.13,.2,7]} c="#a89978"/>
    <Block p={[0,2.96,-3.4]} s={[10,.04,.035]} c="#c8b99c"/><Block p={[-4.9,2.96,0]} s={[.035,.04,7]} c="#c8b99c"/>
    <group position={[-4.88,2.05,.1]} rotation={[0,Math.PI/2,0]}><Window/></group>
    <group position={[-3.48,0,-1.66]} rotation={[0,.25,0]}><Block p={[0,.6,0]} s={[2.2,1,.87]} c="#92724e" map={wood}/><Block p={[0,1.15,0]} s={[2.4,.12,1.02]} c="#96704d" map={wood}/>{[-1,1].map(i=><group key={i}><Block p={[i*.54,.68,.452]} s={[.92,.61,.045]} c="#a07e55" map={wood}/><Sphere p={[i*.14,.7,.49]} s={[.035,.035,.018]} c="#c2af77"/><Block p={[i*.8,.15,0]} s={[.13,.3,.65]} c="#7f6040"/></group>)}<Books p={[-.8,1.23,0]} count={2}/></group>
    <Anchor id="tv" p={[-3.32,1.8,-1.55]} visited={visited.includes('tv')} hint={hint} selected={selected==='tv'} onAnchor={onAnchor} interactive={interactive}><TV/></Anchor>
    <Sofa/>
    <Anchor id="doll" p={[1.79,1.12,-2.22]} visited={visited.includes('doll')} hint={hint} selected={selected==='doll'} onAnchor={onAnchor} interactive={interactive}><Doll scale={.8} rotation={[0,.03,-.06]}/></Anchor>
    <group position={[3.72,0,-2.75]}><Block p={[0,.84,0]} s={[1.43,1.52,.93]} c="#97744f" map={wood}/><Block p={[0,1.64,0]} s={[1.55,.11,1.04]} c="#a17d57" map={wood}/>{[.45,1.02].map(y=><group key={y}><Block p={[0,y,.49]} s={[1.23,.43,.045]} c="#a48259"/><Sphere p={[0,y,.53]} s={[.06,.025,.018]} c="#c6b07b"/></group>)}</group>
    <Anchor id="photo" p={[3.7,2.12,-2.7]} visited={visited.includes('photo')} hint={hint} selected={selected==='photo'} onAnchor={onAnchor} interactive={interactive}><Frame scale={.99} rotation={[0,-.12,0]} texture={portrait}/></Anchor>
    <Door branch={branch} realDeparture={realDeparture}/>
    <group position={[.7,0,.25]}><Block p={[0,.78,0]} s={[2.63,.13,1.49]} c="#b08c62" map={wood} r={.08}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Block key={`${x}${z}`} p={[x*1.05,.39,z*.5]} s={[.12,.76,.12]} c="#96754e"/>))}<Block p={[0,.29,0]} s={[2.22,.07,1.13]} c="#aa8962"/><TeaCup p={[-.44,.86,-.12]}/>{branch==='imagined'&&<TeaCup p={[.62,.86,.18]} c="#c3cfb4"/>}<Tube p={[.42,.9,-.29]} s={[.23,.08,.23]} c="#dfcfac"/>{[0,1,2].map(i=><Sphere key={i} p={[.36+(i%2)*.15,.99,-.35+(i>1?.16:0)]} s={[.09,.09,.08]} c="#c4a454"/>)}<Block p={[-.6,.88,.37]} s={[.55,.03,.32]} c="#e0d1b1" rotation={[0,.18,0]}/></group>
    <group position={[-1.95,0,1.25]}><Tube p={[0,.49,0]} s={[.41,.13,.41]} c="#af8f66"/>{[-1,1].flatMap(x=>[-1,1].map(z=><Tube key={`${x}${z}`} p={[x*.25,.22,z*.25]} s={[.035,.46,.035]} c="#96774f" rotation={[z*.13,0,-x*.13]}/>))}</group>
    <Person grandma p={branch==='imagined'?[-.65,0,.58]:[-2.1,0,-.3]} seated={branch==='imagined'} scale={.92} rotation={branch==='imagined'?.8:.4}/>
    <Person p={branch==='real'&&realDeparture?[-.7,0,-2.25]:[2.9,0,.9]} scale={.58} rotation={branch==='real'&&realDeparture?Math.PI:.1}/>
    <Plant p={[-4.11,.08,2.55]} scale={1.05}/><Plant p={[4.15,.08,-.8]} scale={.77}/>
    <group position={[-4.23,0,-3.04]}><Block p={[0,1.45,0]} s={[1.25,2.76,.58]} c="#a2835a" map={wood}/>{[.25,.92,1.62,2.29].map((y,i)=><group key={y}><Block p={[0,y,.32]} s={[1.11,.055,.07]} c="#c2a476"/><Books p={[-.43,y+.05,.02]} count={i===3?3:5}/></group>)}</group>
    <group position={[1.73,2.65,-3.36]}><Block s={[.7,.85,.055]} c="#e7dfc9"/><Block p={[0,.3,.036]} s={[.7,.2,.02]} c="#b7644e"/>{Array.from({length:20},(_,i)=><Block key={i} p={[-.25+(i%5)*.12,.06-Math.floor(i/5)*.13,.033]} s={[.035,.045,.008]} c={i%7===0?'#ba6c53':'#99896a'} r={.003}/>)}</group>
    <group position={[3.6,3.09,-3.38]}><Tube s={[.26,.07,.26]} c="#837d66" rotation={[Math.PI/2,0,0]}/><Tube p={[0,0,.05]} s={[.225,.008,.225]} c="#e0d9bb" rotation={[Math.PI/2,0,0]}/><Block p={[.045,.06,.06]} s={[.018,.14,.008]} c="#685f4c" rotation={[0,0,-.5]}/><Block p={[-.055,.005,.062]} s={[.14,.015,.008]} c="#685f4c" rotation={[0,0,.1]}/></group>
    <Block p={[.9,.083,1.8]} s={[4.6,.023,1.45]} c="#bcb9a0" r={.1}/>{Array.from({length:13},(_,i)=><Block key={i} p={[-1.2+i*.34,.099,1.8]} s={[.025,.005,1.3]} c="#d1cbb3" r={.001}/>)}
    <mesh position={[-1.6,.1,.9]} rotation={[-Math.PI/2,0,-.47]}><planeGeometry args={[4.7,2.2]}/><meshBasicMaterial color="#fff0bd" transparent opacity={branch==='real'?.07:.2} depthWrite={false}/></mesh>
    <mesh position={[-2.7,.102,.85]} rotation={[-Math.PI/2,0,-.47]}><planeGeometry args={[3.9,.045]}/><meshBasicMaterial color="#fff2cb" transparent opacity={.3} depthWrite={false}/></mesh>
  </group>;
}

function CameraRig({world,selected,resetKey,phase,reducedMotion}:{world:SceneProps['world'];selected:AnchorId|null;resetKey:number;phase:SceneProps['phase'];reducedMotion:boolean}) {
  const {camera,size}=useThree();const controls=useRef<OrbitControlsImpl>(null);const destination=useRef<{eye:THREE.Vector3;target:THREE.Vector3}|null>(null);const previous=useRef<{eye:THREE.Vector3;target:THREE.Vector3}|null>(null);const lastWorld=useRef(world);const lastSelected=useRef<AnchorId|null>(null);
  const setView=(eye:V3,target:V3)=>{destination.current={eye:new THREE.Vector3(...eye),target:new THREE.Vector3(...target)};};
  useEffect(()=>{
    const mobile=size.width<700;const fit=mobile?Math.max(1.05,.9/(size.width/size.height)):1;
    const eye:V3=world==='present'?[11*fit,(mobile?9:8.5)*fit,(mobile?13:12)*fit]:[12*fit,10.2*fit,14*fit];
    const target:V3=world==='present'?[mobile?0:-1.8,1.3,0]:[0,1.1,0];
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=mobile?40:36;camera.updateProjectionMatrix();}
    if(lastWorld.current!==world){lastWorld.current=world;previous.current=null;lastSelected.current=null;}
    setView(eye,target);
  },[world,resetKey,size.width,size.height,camera]);
  useEffect(()=>{
    if(selected&&world==='memory') {
      if(!lastSelected.current)previous.current={eye:camera.position.clone(),target:controls.current?.target.clone()??new THREE.Vector3(0,1,0)};
      const a=anchorPositions[selected];setView([a[0]+4.9,a[1]+2.7,a[2]+6.5],[a[0],a[1]-.45,a[2]]);
    } else if(lastSelected.current&&previous.current) {destination.current=previous.current;previous.current=null;}
    lastSelected.current=selected;
  },[selected,world,camera]);
  useEffect(()=>{
    if(phase==='transition-in')setView([2.3,4,4.4],[.9,2.1,.35]);
    if(phase==='transition-out'&&world==='memory')setView([16,14,18],[0,1.1,0]);
  },[phase,world]);
  useFrame((_,dt)=>{
    if(destination.current&&controls.current){const alpha=reducedMotion?1:1-Math.exp(-dt*2.7);camera.position.lerp(destination.current.eye,alpha);controls.current.target.lerp(destination.current.target,alpha);controls.current.update();if(camera.position.distanceTo(destination.current.eye)<.015)destination.current=null;}
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.07} minDistance={phase.startsWith('transition')?1.5:world==='present'?7:6} maxDistance={size.width<700?60:world==='present'?22:24} minPolarAngle={.48} maxPolarAngle={1.25} minAzimuthAngle={.12} maxAzimuthAngle={1.45} target={world==='present'?[-1.8,1.3,0]:[0,1.1,0]} enabled={!selected&&!phase.startsWith('transition')} onStart={()=>{destination.current=null;}}/>;
}

function Lights({branch}:{branch:Branch|null}) {
  const light=useRef<THREE.DirectionalLight>(null);
  useFrame((_,dt)=>{if(light.current){light.current.color.lerp(new THREE.Color(branch==='real'?'#e5d7c8':branch==='imagined'?'#ffe0a8':'#fff0d4'),1-Math.exp(-dt*2));light.current.intensity=THREE.MathUtils.damp(light.current.intensity,branch==='real'?1.9:2.7,2,dt);}});
  return <><ambientLight intensity={1.15} color="#fff7e8"/><hemisphereLight args={['#f4ead6','#b6b1a1',1.9]}/><directionalLight ref={light} position={[-5,9,4]} intensity={2.7} color="#fff0d4" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.035} shadow-bias={-.0003}/><directionalLight position={[6,6,-4]} intensity={.7} color="#e6e4ce"/></>;
}

function SceneDiagnostics({world}:{world:SceneProps['world']}) {
  const {camera,gl,scene,size}=useThree();const last=useRef(-1);
  useFrame(({clock})=>{if(clock.elapsedTime-last.current<.4)return;last.current=clock.elapsedTime;
    const rect=gl.domElement.getBoundingClientRect();
    const anchors:Record<string,{x:number;y:number}>={};
    const centers:Record<AnchorId,V3>={tv:[-3.32,1.85,-1.55],doll:[1.79,1.87,-2.22],photo:[3.7,2.12,-2.7]};
    for(const [id,p]of Object.entries(centers)){const v=new THREE.Vector3(...p).project(camera);anchors[id]={x:rect.left+(v.x+1)*size.width/2,y:rect.top+(-v.y+1)*size.height/2};}
    let meshes=0;scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});
    gl.domElement.dataset.world=world;gl.domElement.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(3)).join(',');gl.domElement.dataset.anchorScreen=JSON.stringify(anchors);gl.domElement.dataset.meshCount=String(meshes);gl.domElement.dataset.triangles=String(gl.info.render.triangles);
  });return null;
}

function World(props:SceneProps) {
  const wood=useMemo(woodTexture,[]);const portrait=usePortrait();
  useEffect(()=>()=>wood.dispose(),[wood]);
  useEffect(()=>{props.onReady?.();},[]);
  return <>
    <color attach="background" args={['#ece5d5']}/><fog attach="fog" args={['#ece5d5',28,100]}/>
    <Lights branch={props.world==='memory'?props.branch:null}/>
    <mesh position={[0,-.56,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color="#e4ddcd" roughness={1}/></mesh>
    {props.world==='present'?<PresentRoom collected={props.collected} phase={props.phase} onBox={props.onBox} wood={wood} portrait={portrait}/>:<OldHome visited={props.visited} selected={props.selected} hint={props.hint} onAnchor={props.onAnchor} branch={props.branch} realDeparture={props.realDeparture} wood={wood} portrait={portrait} interactive={props.phase==='exploration'}/>}
    {!props.reducedMotion&&<Sparkles count={65} scale={[9,4.7,7]} position={[0,2.2,0]} size={1.8} speed={.12} opacity={.35} color="#fff5d4"/>}
    <CameraRig world={props.world} selected={props.selected} resetKey={props.resetKey} phase={props.phase} reducedMotion={props.reducedMotion}/>
    <SceneDiagnostics world={props.world}/>
  </>;
}

export default function Scene(props:SceneProps) {
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[11,8.5,12],fov:36,near:.1,far:120}} gl={{antialias:true,powerPreference:'high-performance',alpha:false}} fallback={null} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.05;gl.outputColorSpace=THREE.SRGBColorSpace;gl.shadowMap.type=THREE.PCFSoftShadowMap;}}><Suspense fallback={null}><World {...props}/></Suspense></Canvas>;
}
