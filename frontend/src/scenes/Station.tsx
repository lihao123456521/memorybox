import {Suspense,useMemo} from 'react';
import * as THREE from 'three';
import type {SceneProps} from '../types';
import type {WorldLayout} from './navigation';
import {Character} from './Characters';
import {AnchorObject,Bench,Part,Rod,Sign,Suitcase,Wheel,useArchitectureMaterials} from './Architecture';
import type {ArchitectureMaterials} from './Architecture';

const COACH_BAYS=[-13,-8.7,-4.4,3.4,7.3];
const COACH_ROWS=COACH_BAYS.flatMap(z=>[z-1.05,z+1.05]);
export const STATION_LAYOUT:WorldLayout={
  id:'station',start:[0,1.64,9],overview:[23,21,30],target:[1,0,-3],
  zones:[{id:'concourse',label:'候车大厅',xMin:-5,xMax:5,zMin:2,zMax:12},{id:'platform',label:'站台',xMin:-5,xMax:5.2,zMin:-22,zMax:2},{id:'carriage',label:'车厢',xMin:5,xMax:8.6,zMin:-16,zMax:10}],
  anchors:{tv:[-2.65,2.3,2.35],doll:[2.5,.65,-.9],photo:[-4.55,1.4,7]},
  colliders:[
    {xMin:-5.1,xMax:-4.85,zMin:-22,zMax:12},{xMin:-5,xMax:5,zMin:11.85,zMax:12.1},
    {xMin:-5,xMax:-1.05,zMin:1.86,zMax:2.08},{xMin:1.05,xMax:5,zMin:1.86,zMax:2.08},
    {xMin:-4.16,xMax:-3.5,zMin:4,zMax:6.6},{xMin:3.5,xMax:4.16,zMin:4,zMax:6.6},
    ...[-14,-8].map(z=>({xMin:-3.96,xMax:-3.3,zMin:z-1.3,zMax:z+1.3})),
    {xMin:-4.65,xMax:-3.95,zMin:6,zMax:8},{xMin:2.1,xMax:2.9,zMin:-1.15,zMax:-.7},
    {xMin:5.03,xMax:5.4,zMin:-22,zMax:-.77},{xMin:5.03,xMax:5.4,zMin:.77,zMax:12},
    {xMin:8.45,xMax:8.75,zMin:-16.1,zMax:10.1},{xMin:5.2,xMax:8.6,zMin:-16.1,zMax:-15.85},{xMin:5.2,xMax:8.6,zMin:9.85,zMax:10.1},
    // A .75 m aisle remains between the two seat banks; the doorway bay stays open.
    ...COACH_ROWS.flatMap(z=>[{xMin:5.32,xMax:6.525,zMin:z-.49,zMax:z+.49},{xMin:7.275,xMax:8.48,zMin:z-.49,zMax:z+.49}]),
    ...COACH_BAYS.flatMap(z=>[{xMin:5.37,xMax:5.83,zMin:z-.345,zMax:z+.345},{xMin:7.97,xMax:8.43,zMin:z-.345,zMax:z+.345}]),
    {xMin:-5,xMax:5.2,zMin:-22.12,zMax:-21.92},
    ...[-17,-11,-5,1,7].flatMap(z=>[{xMin:-4.12,xMax:-3.78,zMin:z-.18,zMax:z+.18},{xMin:3.78,xMax:4.12,zMin:z-.18,zMax:z+.18}]),
  ]
};

function Canopy({m,overview}:{m:ArchitectureMaterials;overview:boolean}){
  const roof=useMemo(()=>{const shape=new THREE.Shape();shape.moveTo(-5.55,0);for(let i=1;i<=32;i++){const x=-5.55+i*11.1/32;shape.lineTo(x,1.12*(1-(x/5.55)**2));}for(let i=32;i>=0;i--){const x=-5.55+i*11.1/32;shape.lineTo(x,1.12*(1-(x/5.55)**2)-.055);}shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:35,bevelEnabled:false,steps:1});},[]);
  return <group>
    {!overview&&<mesh name="station-canopy-roof" geometry={roof} position={[0,4.55,-22]} material={m.steel} castShadow receiveShadow/>}
    {[-17,-11,-5,1,7].map(z=><group key={z}>
      {[-3.95,3.95].map(x=><group key={x}><Part p={[x,2.27,z]} s={[.14,4.54,.17]} material={m.steel}/>{[-.1,.1].map(o=><Part key={o} p={[x+o,2.27,z]} s={[.045,4.54,.29]} material={m.steel}/>)}<Part p={[x,.08,z]} s={[.5,.16,.5]} material={m.iron}/>{[-.17,.17].flatMap(a=>[-.17,.17].map(b=><mesh key={a+':'+b} position={[x+a,.175,z+b]} material={m.silver}><cylinderGeometry args={[.025,.025,.027,6]}/></mesh>))}</group>)}
      <Rod a={[-5.3,4.55,z]} b={[5.3,4.55,z]} r={.035} material={m.steel}/>
      {[-4,-2,0,2,4].map(x=><group key={x}><Rod a={[x,4.55,z]} b={[x,4.55+1.12*(1-(x/5.55)**2),z]} r={.026} material={m.steel}/><Rod a={[x-1,4.55,z]} b={[x+1,4.55+1.12*(1-(x/5.55)**2),z]} r={.024} material={m.steel}/></group>)}
      <Part p={[0,4.48,z]} s={[1.5,.08,.2]} color="#596560"/><mesh position={[0,4.43,z]} rotation={[Math.PI/2,0,0]}><planeGeometry args={[1.3,.14]}/><meshStandardMaterial color="#fff5ce" emissive="#ffe5aa" emissiveIntensity={2}/></mesh>
    </group>)}
  </group>;
}

function CoachSeat({x,z,facing,m}:{x:number;z:number;facing:number;m:ArchitectureMaterials}){
  return <group position={[x,0,z]}>
    <Part p={[0,.49,0]} s={[1.2,.23,.86]} material={m.coachFabric} radius={.09}/>
    <Part p={[0,.97,-facing*.39]} s={[1.2,.87,.18]} material={m.coachFabric} radius={.08}/>
    <Part p={[0,1.31,-facing*.4]} s={[1.12,.22,.18]} color="#d9d0b8" radius={.04}/>
    {/* Narrow piping and the split cushion give the plain green cloth its sewn construction. */}
    {[-.57,.57].map(side=><group key={side}>
      <Part p={[side,.594,0]} s={[.014,.014,.7]} material={m.coachPiping} radius={.005}/>
      <Part p={[side,.97,-facing*.287]} s={[.014,.7,.014]} material={m.coachPiping} radius={.005}/>
      <Rod a={[side,.23,-.27]} b={[side,.7,-.27]} r={.022} material={m.silver}/>
      <Rod a={[side,.23,.27]} b={[side,.7,.27]} r={.022} material={m.silver}/>
      <Part p={[side,.735,0]} s={[.055,.07,.69]} color="#393f35" radius={.025}/>
    </group>)}
    {[-.3,.3].map(side=><Part key={side} p={[side,.607,0]} s={[.012,.01,.69]} material={m.coachPiping} radius={.004}/>)}
    <Part p={[0,.59,facing*.393]} s={[1.1,.014,.014]} material={m.coachPiping} radius={.005}/>
    <Part p={[0,.31,0]} s={[1.05,.055,.64]} material={m.silver}/>
    {[-.44,.44].map(side=><Part key={side} p={[side,.18,0]} s={[.055,.27,.49]} material={m.iron}/>)}
  </group>;
}

function LuggageRacks({m}:{m:ArchitectureMaterials}){
  return <>{[5.72,8.08].map((x,i)=><group key={x}>
    {[-.29,.29].map(side=><Part key={side} p={[x+side,2.27,-3]} s={[.025,.03,24]} material={m.silver}/>)}
    {Array.from({length:61},(_,n)=><Part key={n} p={[x,2.265,-15+n*.4]} s={[.59,.018,.024]} material={m.silver} radius={.004}/>)}
    {[-14,-10,-6,-2,2,6,9].map(z=><group key={z}>
      <Rod a={[i?8.43:5.37,2.47,z]} b={[i?7.77:6.03,2.27,z]} r={.017} material={m.silver}/>
      <Part p={[i?8.43:5.37,2.42,z]} s={[.025,.24,.085]} material={m.coachLining}/>
    </group>)}
  </group>)}</>;
}

function Train({m,overview}:{m:ArchitectureMaterials;overview:boolean}){
  const windowZ=[-14,-11,-8,-5,-2,2.9,5.9,8.9];
  return <group name="detailed-passenger-coach">
    <Part p={[6.9,-.09,-3]} s={[3.4,.18,26]} material={m.iron} radius={.08}/>
    {!overview&&<Part p={[6.9,3.03,-3]} s={[3.46,.65,26]} material={m.silver} radius={.28}/>}
    <Part p={[8.56,.57,-3]} s={[.1,1.1,26]} material={m.green}/>
    <Part p={[8.56,2.83,-3]} s={[.1,.39,26]} material={m.green}/>
    <Part p={[8.56,1.86,.2]} s={[.1,1.53,2.25]} material={m.green}/>
    {[5.25,8.56].map(x=><Part key={x} p={[x,1.86,-15.8]} s={[.14,1.53,.4]} material={m.green}/>)}
    <Part p={[6.9,.035,-3]} s={[3.15,.06,25.8]} color="#877d64"/>
    {!overview&&<Part p={[6.9,2.685,-3]} s={[3.12,.045,25.7]} material={m.coachLining}/>}
    {[5.4,8.41].map(x=><Part key={x} p={[x,2.54,-3]} s={[.055,.12,25.7]} material={m.coachLining}/>)}
    {[[-16,-.8],[.8,10]].map(([from,to])=><group key={from}><Part p={[5.25,.57,(from+to)/2]} s={[.14,1.1,to-from]} material={m.green}/><Part p={[5.20,1.09,(from+to)/2]} s={[.03,.085,to-from]} color="#d7c69a"/></group>)}
    <Part p={[5.25,2.83,-3]} s={[.14,.39,26]} material={m.green}/><Part p={[5.16,2.58,-3]} s={[.025,.095,26]} color="#c9b98d"/>
    {windowZ.map(z=><group key={z}>
      <Part p={[5.25,1.8,z-1.32]} s={[.14,1.5,.55]} material={m.green}/>
      {[1.22,2.52].map(y=><Part key={y} p={[5.22,y,z]} s={[.07,.06,2.16]} material={m.silver}/>)}
      {[-1.05,1.05].map(side=><Part key={side} p={[5.22,1.87,z+side]} s={[.07,1.3,.06]} material={m.silver}/>)}
      <mesh position={[5.23,1.87,z]} rotation={[0,Math.PI/2,0]} material={m.glass}><planeGeometry args={[2.04,1.24]}/></mesh>
      <Part p={[5.23,1.93,z]} s={[.1,.035,2]} material={m.silver}/>
      {[-.75,.75].map(side=><Part key={side} p={[5.31,1.88,z+side]} s={[.025,1.12,.3]} color="#c1b596" radius={.025}/>)}
      <Part p={[5.34,1.2,z]} s={[.16,.07,2.11]} material={m.coachLining}/>
      <Part p={[8.56,1.8,z-1.32]} s={[.1,1.5,.55]} material={m.green}/>
      {[1.22,2.52].map(y=><Part key={y} p={[8.51,y,z]} s={[.07,.06,2.16]} material={m.coachLining}/>)}
      <mesh position={[8.52,1.87,z]} rotation={[0,Math.PI/2,0]} material={m.glass}><planeGeometry args={[2.04,1.24]}/></mesh>
      <Part p={[8.46,1.93,z]} s={[.035,.035,2]} material={m.silver}/>
      <Part p={[8.44,1.2,z]} s={[.15,.07,2.11]} material={m.coachLining}/>
      {[-1.04,1.04].map(side=><Part key={side} p={[8.47,1.87,z+side]} s={[.06,1.26,.045]} material={m.silver}/>)}
    </group>)}
    {[-15.95,9.95].map(z=><group key={z}><Part p={[6.9,1.47,z]} s={[3.35,2.96,.12]} material={m.green} radius={.18}/><Part p={[6.9,1.45,z+.08]} s={[.8,2.35,.06]} material={m.iron}/><Part p={[6.9,1.93,z+.12]} s={[.58,.71,.04]} material={m.glass}/></group>)}
    {/* A real opening with a level bridge leads into the furnished coach. */}
    <Part p={[5.11,1.27,1.28]} s={[.1,2.52,.88]} material={m.green} radius={.06}/><Part p={[5.045,1.87,1.28]} s={[.018,.85,.57]} material={m.glass}/>
    <Part p={[5.08,.012,0]} s={[.55,.04,1.5]} material={m.silver}/><Part p={[5.24,2.68,0]} s={[.2,.16,1.7]} color="#cfbea1"/>
    {[-.81,.81].map(z=><group key={z}><Part p={[5.25,1.31,z]} s={[.2,2.65,.09]} material={m.silver}/><Rod a={[5.08,.53,z]} b={[5.08,1.65,z]} r={.018} material={m.silver}/></group>)}
    <Sign text="3 号车厢" small="A SEAT TOWARDS TOMORROW" p={[5.14,2.36,0]} s={[1.32,.22,.02]} rotation={[0,-Math.PI/2,0]} background="#294d42"/>
    {[-11,5].map(z=><group key={z}>
      <Part p={[6.9,-.49,z]} s={[2.9,.26,2.3]} material={m.iron}/>
      {[-.75,.75].map(o=><group key={o}><Rod a={[5.5,-.63,z+o]} b={[8.3,-.63,z+o]} r={.09} material={m.iron}/>{[5.45,8.35].map(x=><Wheel key={x} p={[x,-.63,z+o]} material={m.iron}/>)}</group>)}
      {[-.75,.75].map(o=><Part key={o} p={[5.35,-.42,z+o]} s={[.24,.16,.6]} material={m.silver}/>)}
    </group>)}
    {COACH_BAYS.map(z=><group key={z}>
      {[5.925,7.875].flatMap(x=>[-1,1].map(side=><CoachSeat key={x+':'+side} x={x} z={z+side*1.05} facing={-side} m={m}/>))}
      {[5.6,8.2].map(x=><group key={x}><Part p={[x,.82,z]} s={[.46,.055,.69]} material={m.coachLining} radius={.018}/><Part p={[x,.45,z]} s={[.045,.69,.045]} material={m.silver}/></group>)}
    </group>)}
    {[-13.2,-8.4,-3.6,1.2,6].map(z=><group key={z}>
      <Part p={[6.9,2.63,z]} s={[.35,.055,1.17]} material={m.iron}/>
      <Part p={[6.9,2.594,z]} s={[.24,.04,1.04]} material={m.coachLamp} radius={.018}/>
      {[-.54,.54].map(side=><Part key={side} p={[6.9,2.58,z+side]} s={[.32,.035,.045]} material={m.silver}/>)}
    </group>)}
    <LuggageRacks m={m}/>
  </group>;
}

function PlatformEnd({m}:{m:ArchitectureMaterials}){
  const trees=useMemo(()=>Array.from({length:22},(_,i)=>({x:-29+i*2.85,z:-35-(i%4)*3.8,h:4.5+(i%5)*.65})),[]);
  return <group name="station-landscape-and-platform-end">
    <Part p={[0,-.19,-28]} s={[10.5,.32,12]} material={m.floor}/>
    <Part p={[0,.055,-21.98]} s={[10.5,.13,.22]} material={m.stone}/>
    {[.43,1.02].map(y=><Part key={y} p={[0,y,-21.98]} s={[10.3,.045,.045]} material={m.steel}/>)}
    {[-4.95,-3.3,-1.65,0,1.65,3.3,4.95].map(x=><group key={x}><Part p={[x,.59,-21.98]} s={[.055,1.1,.055]} material={m.steel}/><Part p={[x,.1,-21.98]} s={[.16,.1,.16]} material={m.iron}/></group>)}
    <Sign text="站台尽头 · 请勿通行" small="END OF PLATFORM" p={[0,.76,-21.91]} s={[1.5,.43,.025]} background="#d2c39c" color="#5b5947"/>
    <Part p={[0,-1.32,-39]} s={[95,.28,42]} color="#7d8868"/>
    <Part p={[-17,-.8,-33]} s={[28,.7,6]} color="#83916e"/>
    {trees.map(({x,z,h},i)=><group key={i}>
      <Part p={[x,h*.23-1,z]} s={[.23,h*.5,.23]} color="#625d44"/>
      <mesh position={[x,h*.58-1,z]} castShadow><coneGeometry args={[1.7,h*.75,7]}/><meshStandardMaterial color={i%3===0?'#596f55':i%3===1?'#6d805d':'#778363'} roughness={1}/></mesh>
      <mesh position={[x,h*.84-1,z]} castShadow><coneGeometry args={[1.27,h*.58,7]}/><meshStandardMaterial color={i%2?'#617b58':'#70805b'} roughness={1}/></mesh>
    </group>)}
    {[-20,-9,4].map((x,i)=><group key={x}><Part p={[x,1.6,-48-i*3]} s={[8,5.4,5]} color={i%2?'#a5aa99':'#b5b2a1'}/><Part p={[x,4.34,-48-i*3]} s={[8.3,.13,5.25]} color="#7a8271"/>{[-2.6,0,2.6].flatMap(dx=>[.4,2.1,3.6].map(y=><Part key={dx+':'+y} p={[x+dx,y,-45.46-i*3]} s={[1.3,.74,.025]} color="#657973"/>))}</group>)}
    {[10.2,11,11.8].flatMap(x=>Array.from({length:5},(_,i)=>{const z=-25+i*9;return <group key={x+':'+i}><Rod a={[x,5.45,z]} b={[x,5.15,z+4.5]} r={.011} color="#5b6053"/><Rod a={[x,5.15,z+4.5]} b={[x,5.45,z+9]} r={.011} color="#5b6053"/></group>;}))}
  </group>;
}

export default function Station(props:SceneProps){
  const m=useArchitectureMaterials();const explore=props.phase==='exploration',overview=props.viewMode==='overview';
  return <group name="station-world-v3">
    <Part p={[0,-.17,-5]} s={[10.5,.32,34]} radius={.025} material={m.floor}/>
    <Part p={[5.015,.012,-5]} s={[.28,.025,34]} color="#c2a456" radius={.003}/>
    {Array.from({length:34},(_,i)=><Part key={i} p={[4.58,.022,-21.5+i]} s={[.33,.025,.92]} color="#b2a15f" radius={.002}/>)}
    <Part p={[7,-1.15,-5]} s={[5,.14,45]} color="#6e7369"/>
    {Array.from({length:56},(_,i)=><Part key={i} p={[6.9,-1.05,-28+i*.77]} s={[3.8,.14,.21]} color="#695e4d" radius={.01}/>)}
    {[5.46,8.34].map(x=><Part key={x} p={[x,-.94,-6]} s={[.085,.19,45]} material={m.silver} radius={.015}/>)}
    <Canopy m={m} overview={overview}/>
    <PlatformEnd m={m}/>
    <group name="full-scale-interior-shell">
      <Part p={[-5.06,1.9,-5]} s={[.17,3.8,34]} material={m.stone}/><Part p={[-4.94,.71,-5]} s={[.025,1.42,34]} color="#45655c"/>
      <Part p={[0,2,12]} s={[10.2,4,.18]} material={m.stone}/>
      <Part p={[-3,1.15,1.98]} s={[4,.12,.17]} material={m.steel}/><Part p={[3,1.15,1.98]} s={[4,.12,.17]} material={m.steel}/>
      {[-4,-3,-2,2,3,4].map(x=><Rod key={x} a={[x,0,1.98]} b={[x,1.15,1.98]} r={.018} material={m.steel}/>)}
    </group>
    <Train m={m} overview={overview}/>
    {[-3.8,3.8].map(x=><Bench key={x} p={[x,0,5.3]} rotation={x>0?-Math.PI/2:Math.PI/2} m={m}/>)}
    {[-14,-8].map(z=><Bench key={z} p={[-3.6,0,z]} rotation={Math.PI/2} m={m}/>)}
    <Sign text="青 山 站" small="QINGSHAN · EVERY JOURNEY BEGINS WITH A GOODBYE" p={[0,3.18,11.86]} s={[5.3,1,.06]}/>
    <Sign text="1 站台  →" small="PLATFORM 01" p={[0,3.75,1.96]} s={[2.7,.65,.08]}/>
    <Sign text="请在黄线内等候" small="MIND THE PLATFORM EDGE" p={[3.95,2.9,-5]} s={[1.7,.48,.04]} rotation={[0,-Math.PI/2,0]}/>
    {[
      {z:-4.5,text:'铁路旅客乘车须知',small:'凭票乘车 · 文明出行',background:'#d2c9af'},
      {z:-10.5,text:'注意脚下 · 平安出行',small:'请照看同行儿童与随身行李',background:'#c9c8ad'},
      {z:-17,text:'青山站列车时刻表',small:'K2008  16:20     K126  18:05',background:'#d9d0b5'},
    ].map(({z,text,small,background})=><group key={z} position={[-4.87,1.94,z]} rotation={[0,Math.PI/2,0]}><Part s={[1.9,1.25,.065]} material={m.wood}/><Sign text={text} small={small} p={[0,0,.043]} s={[1.78,1.13,.025]} background={background} color="#526052"/></group>)}
    <AnchorObject id="tv" onAnchor={id=>explore&&props.onAnchor(id)}><Sign text="开往远方 · 16:20" small="K 2008    BOARDING    1 站台" p={[-2.65,2.3,2.35]} s={[3.4,.82,.09]} background="#252f2f" color="#e4bc6c"/></AnchorObject>
    <AnchorObject id="doll" onAnchor={id=>explore&&props.onAnchor(id)}><Suitcase p={[2.5,0,-.9]} rotation={-.2} m={m}/></AnchorObject>
    <group position={[-4.67,0,7]} rotation={[0,Math.PI/2,0]}><Part p={[0,1.26,0]} s={[1.7,2.52,.15]} material={m.steel}/><Part p={[0,1.64,.09]} s={[1.42,1.23,.025]} material={m.glass}/><Part p={[0,.98,.22]} s={[1.58,.08,.44]} material={m.wood}/><Sign text="售票 / 问询" small="TICKETS & INFORMATION" p={[0,2.31,.1]} s={[1.51,.3,.03]}/><AnchorObject id="photo" onAnchor={id=>explore&&props.onAnchor(id)}><Sign text="青山 → 远方" small="一张被认真保存的车票 · 2008" p={[0,1.37,.15]} s={[1.04,.42,.02]} background="#d8c7a5" color="#4e5346"/></AnchorObject></group>
    <Suspense fallback={null}><Character preset={props.companion||'elder-woman'} position={[-2.35,0,-1.6]} rotation={props.branch==='real'&&props.realDeparture?Math.PI:.5}/></Suspense>
    {props.branch==='imagined'&&<><Suitcase p={[-1.35,0,-2]} m={m}/><pointLight position={[-1,2,0]} color="#ffe1a6" intensity={2} distance={7}/></>}
    {/* Beyond the canopy: layered geometric buildings, telegraph poles and terrain. */}
    <Part p={[18,-1.3,-10]} s={[18,.2,65]} color="#7d8b6c"/>
    {[0,1,2,3,4,5].map(i=><group key={i}><Part p={[19+(i%2)*3,2.7,-25+i*9]} s={[5,7,5.5]} color={i%2?'#aab0a2':'#c1b8a3'} radius={.02}/>{[1,2,3].map(y=><Part key={y} p={[16.45+(i%2)*3,y*1.8-.2,-25+i*9]} s={[.02,.9,3.4]} color="#637b79"/>)}<Rod a={[11,-1,-25+i*9]} b={[11,5.7,-25+i*9]} r={.07} color="#66664e"/><Rod a={[10,5.4,-25+i*9]} b={[12,5.4,-25+i*9]} r={.045} color="#66664e"/></group>)}
  </group>;
}
