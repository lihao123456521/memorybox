import {useEffect,useMemo} from 'react';
import {RoundedBox} from '@react-three/drei';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {RoomMaterials} from '../materials';
import {ChineseArmchair} from '../ScannedProps';

export type V3=[number,number,number];
export function Block({p=[0,0,0],s=[1,1,1],m,r=.008,rot=[0,0,0],name}:{p?:V3;s?:V3;m:THREE.Material;r?:number;rot?:V3;name?:string}){
  if(r<.025||Math.min(...s)<.055)return <mesh name={name} position={p} rotation={rot} castShadow receiveShadow><boxGeometry args={s}/><primitive object={m} attach="material"/></mesh>;
  return <RoundedBox name={name} args={s} position={p} rotation={rot} radius={Math.min(r,...s.map(v=>v*.32))} smoothness={2} castShadow receiveShadow><primitive object={m} attach="material"/></RoundedBox>;
}
export function Cylinder({p=[0,0,0],radius=.025,bottom,depth=.1,m,rot=[0,0,0]}:{p?:V3;radius?:number;bottom?:number;depth?:number;m:THREE.Material;rot?:V3}){
  return <mesh position={p} rotation={rot} castShadow receiveShadow><cylinderGeometry args={[radius,bottom??radius,depth,24]}/><primitive object={m} attach="material"/></mesh>;
}
export function Ellipse({p,s,m}:{p:V3;s:V3;m:THREE.Material}){return <mesh position={p} scale={s} castShadow receiveShadow><sphereGeometry args={[1,28,20]}/><primitive object={m} attach="material"/></mesh>;}
export function Curve({points,r=.003,m}:{points:V3[];r?:number;m:THREE.Material}){
  const geometry=useMemo(()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*5),r,6,false),[points,r]);
  return <mesh geometry={geometry} castShadow><primitive object={m} attach="material"/></mesh>;
}

function roundedPath(w:number,h:number,z:number,r=.055):V3[]{
  const points:V3[]=[];for(const [cx,cy,start]of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]])for(let j=0;j<=6;j++){const a=start+j/6*Math.PI/2;points.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r,z]);}points.push(points[0]);return points;
}
export function Cushion({p,s,m,trim,rot=[0,0,0]}:{p:V3;s:V3;m:THREE.Material;trim:THREE.Material;rot?:V3}){
  return <group position={p} rotation={rot}><Block s={s} m={m} r={Math.min(s[2]*.42,.095)}/><Curve points={roundedPath(s[0]-.035,s[1]-.035,s[2]/2-.006,Math.min(.065,s[1]*.22))} r={.0025} m={trim}/></group>;
}

export function SofaFine({m}:{m:RoomMaterials}){return <group position={[-3.35,0,-.55]} rotation={[0,Math.PI/2,0]} name="joinery-sofa-with-piped-cushions">
  {[-1.22,1.22].flatMap(x=>[-.35,.35].map(z=><group key={`${x}${z}`} position={[x,0,z]}><Cylinder p={[0,.1,0]} radius={.035} bottom={.043} depth={.2} m={m.darkWood}/><Cylinder p={[0,.012,0]} radius={.044} depth={.018} m={m.darkMetal}/></group>))}
  <Block p={[0,.28,0]} s={[2.82,.23,.91]} m={m.darkWood} r={.022}/><Block p={[0,.382,.025]} s={[2.76,.032,.88]} m={m.wood}/>
  <Block p={[0,.245,.468]} s={[2.66,.08,.035]} m={m.wood}/><Block p={[0,.18,.455]} s={[2.64,.025,.024]} m={m.brass}/>
  {Array.from({length:16},(_,i)=><Block key={i} p={[-1.29+i*.172,.72,-.4]} s={[.065,.7,.055]} m={m.wood} r={.011}/>)}
  <Block p={[0,1.08,-.41]} s={[2.91,.1,.12]} m={m.darkWood} r={.035}/>
  {[-.88,0,.88].map(x=><group key={x}><Cushion p={[x,.492,.045]} s={[.856,.79,.206]} m={m.fabric} trim={m.linen} rot={[-Math.PI/2,0,0]}/><Cushion p={[x,.84,-.305]} s={[.852,.62,.21]} m={m.fabric} trim={m.linen} rot={[-.075,0,0]}/><Block p={[x,.4,.46]} s={[.83,.018,.028]} m={m.linen}/></group>)}
  {[-1,1].map(i=><group key={i}><Block p={[i*1.43,.66,0]} s={[.14,.09,1.04]} m={m.darkWood} r={.039}/><Block p={[i*1.43,.48,-.37]} s={[.09,.45,.1]} m={m.wood} r={.02}/><Block p={[i*1.43,.45,.37]} s={[.09,.39,.1]} m={m.wood} r={.02}/><Block p={[i*1.43,.31,0]} s={[.07,.06,.88]} m={m.wood}/>{[0,1,2].map(j=><Block key={j} p={[i*1.43,.48,-.22+j*.22]} s={[.043,.25,.045]} m={m.wood}/>)}</group>)}
  <Cushion p={[-1.05,.77,-.02]} s={[.42,.43,.15]} m={m.redFabric} trim={m.linen} rot={[.1,.12,.22]}/><Cushion p={[1.07,.76,-.035]} s={[.36,.4,.15]} m={m.linen} trim={m.fabric} rot={[.09,-.12,-.2]}/>
  <Block p={[.48,.615,.25]} s={[.59,.025,.44]} m={m.blanket} r={.01}/>{Array.from({length:17},(_,i)=><Curve key={i} points={[[.22+i*.031,.624,.06],[.22+i*.031,.62,.42],[.22+i*.031,.48,.49],[.22+i*.031,.33,.49]]} r={.003} m={m.blanket}/>)}
  </group>;}

const TITLES=['散文选','家常菜','中国地图','辞海','植物图鉴','旅行札记','唐诗三百首','日常手记','简明词典','读书','岁月','摄影'];
function bookAtlas(count:number,seed:number){const canvas=document.createElement('canvas');canvas.width=Math.max(1,count)*100;canvas.height=512;const c=canvas.getContext('2d')!;for(let n=0;n<count;n++){const i=n+seed;c.save();c.translate(n*100+2,0);c.fillStyle=['#526665','#9b7255','#b7a880','#695a4c','#7e8a71','#7c6565'][i%6];c.fillRect(-2,0,100,512);c.fillStyle='#d6c29b';c.fillRect(15,38,66,3);c.fillRect(15,452,66,3);c.font='25px "Microsoft YaHei",sans-serif';c.textAlign='center';for(const [j,letter]of [...TITLES[i%TITLES.length]].entries())c.fillText(letter,48,104+j*36);c.font='10px serif';c.fillText('MEMORY · BOOK',48,424);c.restore();}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function mergeDetailGeometries(parts:THREE.BufferGeometry[]){const geometry=parts.length?mergeGeometries(parts,false)!:new THREE.BufferGeometry();parts.forEach(part=>part.dispose());return geometry;}
export function BooksFine({p=[0,0,0],count=10,m,seed=0}:{p?:V3;count?:number;m:RoomMaterials;seed?:number}){
  const batch=useMemo(()=>{const pages:THREE.BufferGeometry[]=[],covers:THREE.BufferGeometry[]=[],spines:THREE.BufferGeometry[]=[];const books=Array.from({length:count},(_,i)=>i),map=bookAtlas(books.length,seed);for(const i of books){const h=.21+(i%4)*.018,w=.034+(i%3)*.011,transform=new THREE.Matrix4().makeRotationZ(i===count-1?-.09:0);transform.setPosition(i*.056,h/2,0);pages.push(new THREE.BoxGeometry(w,h,.175).applyMatrix4(transform));for(const side of [-1,1])covers.push(new THREE.BoxGeometry(.004,h+.009,.184).translate(side*(w/2+.001),0,0).applyMatrix4(transform));const spine=new THREE.PlaneGeometry(w+.006,h+.009),uv=spine.getAttribute('uv');for(let j=0;j<uv.count;j++)uv.setX(j,(i*100+2+uv.getX(j)*96)/(books.length*100));spines.push(spine.translate(0,0,.094).applyMatrix4(transform));}return {pages:mergeDetailGeometries(pages),covers:mergeDetailGeometries(covers),spines:mergeDetailGeometries(spines),map};},[count,seed]);
  useEffect(()=>()=>{batch.pages.dispose();batch.covers.dispose();batch.spines.dispose();batch.map.dispose();},[batch]);
  return <group position={p}>{count>0&&<><mesh geometry={batch.pages} castShadow receiveShadow><primitive object={m.paper} attach="material"/></mesh><mesh geometry={batch.covers} castShadow receiveShadow><primitive object={m.leather} attach="material"/></mesh><mesh geometry={batch.spines} castShadow receiveShadow><meshStandardMaterial map={batch.map} roughness={.85}/></mesh></>}</group>;
}

export function Doorway({p,rotation=0,w=1.1,m,leaf=false,label}:{p:V3;rotation?:number;w?:number;m:RoomMaterials;leaf?:boolean;label?:string}){
  return <group position={p} rotation={[0,rotation,0]} name={`doorway-${label||'interior'}`}>
    {[-1,1].map(side=><group key={side}><Block p={[side*(w/2+.045),1.15,0]} s={[.095,2.3,.2]} m={m.darkWood} r={.01}/><Block p={[side*(w/2+.11),1.17,.112]} s={[.056,2.34,.035]} m={m.wood} r={.006}/><Block p={[side*(w/2+.025),1.15,.05]} s={[.018,2.25,.04]} m={m.wood}/></group>)}
    <Block p={[0,2.31,0]} s={[w+.19,.105,.2]} m={m.darkWood}/><Block p={[0,2.36,.112]} s={[w+.27,.05,.04]} m={m.wood}/>
    <Block p={[0,.012,0]} s={[w,.024,.28]} m={m.stone} r={.004}/><Block p={[0,.028,0]} s={[w,.006,.022]} m={m.brass}/>
    {leaf&&<group position={[-w/2,0,-.15]} rotation={[0,-Math.PI/2.05,0]}><Block p={[w/2,1.12,0]} s={[w,2.24,.043]} m={m.wood} r={.008}/>{[.65,1.62].map(y=><group key={y}><Block p={[w/2,y,.029]} s={[w-.17,.76,.018]} m={m.darkWood} r={.012}/><Block p={[w/2,y,.042]} s={[w-.215,.715,.012]} m={m.wood} r={.009}/></group>)}{[.35,1.78].map(y=><Cylinder key={y} p={[.015,y,0]} radius={.015} depth={.1} m={m.brass}/>)}<Block p={[w-.14,1.03,.045]} s={[.04,.14,.012]} m={m.brass}/><Curve points={[[w-.14,1.08,.06],[w-.14,1.08,.09],[w-.24,1.08,.09]]} r={.009} m={m.brass}/></group>}
    </group>;
}

export function TableLamp({p,m,green=false}:{p:V3;m:RoomMaterials;green?:boolean}){return <group position={p} name="working-local-table-lamp">
  <Ellipse p={[0,.022,0]} s={[.13,.025,.095]} m={m.darkMetal}/><Cylinder p={[0,.17,0]} radius={.012} depth={.29} m={m.brass}/><Ellipse p={[0,.31,0]} s={[.033,.04,.033]} m={m.brass}/>
  {green?<group><mesh position={[0,.365,.01]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.105,.105,.27,32,1,true,0,Math.PI]}/><primitive object={m.greenGlass} attach="material"/></mesh><Block p={[0,.362,.01]} s={[.285,.018,.19]} m={m.brass}/><Ellipse p={[0,.351,.015]} s={[.116,.018,.064]} m={m.lampShade}/></group>:<mesh position={[0,.34,0]} castShadow><cylinderGeometry args={[.075,.14,.21,40,1,true]}/><primitive object={m.lampShade} attach="material"/></mesh>}
  <Curve points={[[0,.05,-.06],[.07,.01,-.12],[.16,.008,-.17],[.25,0,-.26]]} r={.002} m={m.darkMetal}/>
  <pointLight position={[0,.33,.035]} color="#ffdab0" intensity={1.0} distance={2.7} decay={2}/>
  </group>;}

export function PaperStack({p,m}:{p:V3;m:RoomMaterials}){const batch=useMemo(()=>{const pages=Array.from({length:7},(_,i)=>new THREE.BoxGeometry(.2,.0008,.285).rotateY((i%3-1)*.018).translate((i%3)*.002,i*.0011,0)),ink=Array.from({length:13},(_,i)=>new THREE.BoxGeometry(i===0?.13:.16,.0004,.0008).translate(0,.009,-.11+i*.016));return {pages:mergeDetailGeometries(pages),ink:mergeDetailGeometries(ink)};},[]);useEffect(()=>()=>{batch.pages.dispose();batch.ink.dispose();},[batch]);return <group position={p}>
  <mesh geometry={batch.pages} castShadow receiveShadow><primitive object={m.paper} attach="material"/></mesh>
  <mesh geometry={batch.ink} castShadow receiveShadow><primitive object={m.ink} attach="material"/></mesh>
  <Cylinder p={[.115,.013,.005]} radius={.003} depth={.17} m={m.brass} rot={[Math.PI/2,0,.18]}/>
  </group>;}

function quiltGeometry(){const nx=36,nz=34,positions:number[]=[],uv:number[]=[],indices:number[]=[];for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-.98+i/nx*1.96,z=-.47+j/nz*1.62;const fall=Math.max(0,Math.abs(x)-.79)*1.25+Math.max(0,z-.965)*1.35;const y=.692-fall+.012*Math.sin(x*24+z*5)*Math.sin(z*13)+.009*Math.cos(z*19);positions.push(x,y,z);uv.push(i/nx*3,j/nz*2.5);}for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
export function Bedroom({m}:{m:RoomMaterials}){const quilt=useMemo(quiltGeometry,[]);return <group name="independent-bedroom">
  <group position={[-7.1,0,-.25]} rotation={[0,Math.PI,0]} name="full-scale-made-bed">
    {[-.72,.72].flatMap(x=>[-.88,.88].map(z=><Block key={`${x}${z}`} p={[x,.17,z]} s={[.085,.33,.085]} m={m.darkWood} r={.018}/>))}
    <Block p={[0,.32,0]} s={[1.74,.2,2.16]} m={m.darkWood} r={.025}/><Block p={[0,.47,0]} s={[1.66,.22,2.08]} m={m.linen} r={.105}/><Curve points={roundedPath(1.63,.19,1.035,.065).map(([x,y,z])=>[x,y+.47,z])} r={.003} m={m.linen}/>
    <Block p={[0,.81,-1.1]} s={[1.83,.96,.085]} m={m.wood} r={.035}/><Block p={[0,.88,-1.045]} s={[1.64,.61,.04]} m={m.fabric} r={.07}/>{[-.63,.63].map(x=><Block key={x} p={[x,.84,-1.009]} s={[.018,.53,.009]} m={m.brass}/>)}
    <Block p={[0,.395,1.07]} s={[1.81,.35,.065]} m={m.wood} r={.025}/><Block p={[0,.59,0]} s={[1.63,.035,2.03]} m={m.cotton} r={.08}/>
    {[-.4,.4].map(x=><Cushion key={x} p={[x,.68,-.73]} s={[.72,.39,.135]} m={m.cotton} trim={m.linen} rot={[-Math.PI/2+.12,0,x*.05]}/>)}
    <mesh geometry={quilt} castShadow receiveShadow><primitive object={m.blanket} attach="material"/></mesh>
    <Block p={[0,.708,-.43]} s={[1.59,.024,.16]} m={m.linen} r={.01}/>
    {Array.from({length:15},(_,i)=>{const x=-.75+i*.107;return <Curve key={i} points={[[x,.709,-.34],[x,.714,.07],[x,.704,.5],[x,.708,.91]]} r={.0012} m={m.linen}/>;})}
  </group>
  <group position={[-8.48,0,.45]}><Block p={[0,.27,0]} s={[.59,.52,.48]} m={m.wood} r={.018}/><Block p={[0,.55,0]} s={[.64,.045,.53]} m={m.darkWood}/>{[.17,.4].map(y=><group key={y}><Block p={[0,y,.25]} s={[.51,.2,.026]} m={m.wood}/><Curve points={[[-.065,y,.274],[-.065,y-.013,.292],[.065,y-.013,.292],[.065,y,.274]]} r={.005} m={m.brass}/></group>)}<TableLamp p={[-.08,.578,-.055]} m={m}/><PaperStack p={[.14,.58,.06]} m={m}/></group>
  <group position={[-8.02,0,-3.1]} name="paneled-bedroom-wardrobe"><Block p={[0,1.04,0]} s={[1.72,2.08,.57]} m={m.darkWood} r={.025}/>{[-.42,.42].map(x=><group key={x}><Block p={[x,1.14,.299]} s={[.81,1.77,.035]} m={m.wood} r={.013}/><Block p={[x,1.22,.324]} s={[.65,1.38,.025]} m={x>0?m.mirror:m.darkWood} r={.016}/><Block p={[x,1.22,.342]} s={[.58,1.29,.012]} m={x>0?m.mirror:m.wood} r={.01}/><Curve points={[[x+(x>0?-.26:.26),1.15,.36],[x+(x>0?-.26:.26),1.15,.39],[x+(x>0?-.26:.26),1.02,.39],[x+(x>0?-.26:.26),1.02,.36]]} r={.006} m={m.brass}/></group>)}<Block p={[0,2.12,.015]} s={[1.82,.09,.64]} m={m.wood} r={.019}/><Block p={[0,.15,.312]} s={[1.61,.21,.025]} m={m.wood}/></group>
  <Block p={[-6.9,.012,-.05]} s={[3.15,.016,3.3]} m={m.rug} r={.025}/>
  <group position={[-5.65,0,.56]}><Block p={[0,.43,0]} s={[.44,.085,.39]} m={m.fabric} r={.05}/>{[-1,1].flatMap(x=>[-1,1].map(z=><Block key={`${x}${z}`} p={[x*.16,.2,z*.13]} s={[.04,.41,.04]} m={m.darkWood}/>))}</group>
  <group position={[-5.48,1.65,.89]} rotation={[0,Math.PI,0]}><Block s={[.62,.78,.035]} m={m.darkWood}/><Block p={[0,0,.024]} s={[.54,.70,.008]} m={m.paper}/><Block p={[0,0,.031]} s={[.39,.52,.004]} m={m.leaf}/><Curve points={[[0,-.24,.04],[.02,0,.04],[-.03,.23,.04]]} r={.004} m={m.brass}/></group>
  <pointLight position={[-8.55,2.0,-.3]} color="#e3ecf1" intensity={.5} distance={4.5}/>
  </group>;}

export function Study({m}:{m:RoomMaterials}){return <group name="independent-study">
  <group position={[-5.98,0,-6.38]} name="study-writing-desk">
    <Block p={[0,.752,0]} s={[2.16,.067,.78]} m={m.wood} r={.034}/><Block p={[0,.713,0]} s={[2.05,.025,.72]} m={m.darkWood}/>
    {[-.88,.88].flatMap(x=>[-.27,.27].map(z=><Block key={`${x}${z}`} p={[x,.36,z]} s={[.065,.72,.065]} m={m.darkWood} r={.014}/>))}
    <Block p={[0,.61,.28]} s={[1.72,.2,.07]} m={m.wood}/>{[-.44,.44].map(x=><group key={x}><Block p={[x,.62,.329]} s={[.83,.155,.028]} m={m.darkWood}/><Curve points={[[x-.07,.65,.35],[x-.07,.64,.373],[x+.07,.64,.373],[x+.07,.65,.35]]} r={.0045} m={m.brass}/></group>)}
    <Block p={[.12,.793,.04]} s={[.79,.009,.48]} m={m.leather} r={.021}/><PaperStack p={[.14,.80,.06]} m={m}/><TableLamp p={[-.73,.79,-.11]} green m={m}/><BooksFine p={[.54,.79,-.24]} count={6} seed={3} m={m}/>
    <Cylinder p={[-.34,.833,-.2]} radius={.038} depth={.08} m={m.ceramic}/>{[-.02,.007,.023].map((x,i)=><Cylinder key={x} p={[-.34+x,.91,-.2]} radius={.0027} depth={.145+i*.01} m={i===1?m.ink:m.brass} rot={[0,0,(i-1)*.1]}/>)}
  </group>
  <ChineseArmchair/>
  <group position={[-8.0,0,-6.77]} scale={[.65,1,1]} name="study-full-height-bookcase"><Block p={[0,1.18,-.17]} s={[2.64,2.32,.035]} m={m.darkWood}/>{[-1,1].map(x=><Block key={x} p={[x*1.34,1.18,0]} s={[.055,2.35,.38]} m={m.wood}/>)}{[.12,.54,.96,1.38,1.8,2.23].map((y,i)=><group key={y}><Block p={[0,y,0]} s={[2.67,.045,.39]} m={m.wood}/>{i<5&&<><BooksFine p={[-1.23,y+.029,.055]} count={15} seed={i*4} m={m}/><BooksFine p={[-.14,y+.029,.055]} count={i===3?7:16} seed={i*2+5} m={m}/></>}</group>)}<Block p={[0,2.4,0]} s={[2.81,.095,.44]} m={m.darkWood} r={.014}/></group>
  <group position={[-4.8,1.78,-6.87]}><Block s={[.51,.68,.035]} m={m.darkWood}/><Block p={[0,0,.026]} s={[.44,.6,.008]} m={m.paper}/>{Array.from({length:8},(_,i)=><Block key={i} p={[0,.23-i*.061,.034]} s={[i%3===0?.28:.34,.009,.003]} m={m.ink} r={0}/>)}</group>
  <Block p={[-6.48,.009,-5.08]} s={[2.6,.013,1.9]} m={m.rug} r={.022}/>
  <pointLight position={[-8.55,2.15,-5.32]} intensity={.8} color="#e5edf5" distance={5}/>
  </group>;}

export function CeilingRose({p,m}:{p:V3;m:RoomMaterials}){return <group position={p}>
  <Cylinder radius={.145} depth={.024} m={m.ceiling}/><Cylinder p={[0,-.025,0]} radius={.08} depth={.028} m={m.brass}/><Cylinder p={[0,-.12,0]} radius={.009} depth={.17} m={m.darkMetal}/>
  <mesh position={[0,-.25,0]} castShadow><sphereGeometry args={[.18,32,20,0,Math.PI*2,0,Math.PI*.72]}/><primitive object={m.lampShade} attach="material"/></mesh><Cylinder p={[0,-.35,0]} radius={.126} depth={.012} m={m.brass}/>
  </group>;}
