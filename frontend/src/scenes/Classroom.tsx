import {useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {SceneProps} from '../types';
import type {WorldLayout} from './navigation';
import {companionFootprint,isStoryBranch,readStoryTime,StoryCompanion} from './StoryActions';
import {AnchorObject,Part,Rod,Sign,useArchitectureMaterials} from './Architecture';
import type {ArchitectureMaterials,V3} from './Architecture';

const desks=[-3.4,-1.9,1.9,3.4].flatMap(x=>[-4.5,-2.25,0,2.25].map(z=>({x,z})));
export const CLASSROOM_LAYOUT:WorldLayout={
  id:'classroom',start:[0,1.64,4],overview:[17,14,19],target:[.5,.4,-1],
  zones:[{id:'classroom',label:'教室',xMin:-5,xMax:5,zMin:-7,zMax:5},{id:'corridor',label:'走廊',xMin:5,xMax:7.8,zMin:-7,zMax:5}],
  anchors:{tv:[-.4,1.7,-6.78],doll:[1.9,.84,0],photo:[-4.38,1.32,1.4]},
  colliders:[
    {xMin:-5.13,xMax:-4.87,zMin:-7,zMax:5},{xMin:-5,xMax:5,zMin:-7.1,zMax:-6.83},{xMin:-5,xMax:5,zMin:4.88,zMax:5.1},
    {xMin:4.88,xMax:5.12,zMin:-7,zMax:3.25},{xMin:4.88,xMax:5.12,zMin:4.75,zMax:5},
    {xMin:7.65,xMax:7.9,zMin:-7,zMax:5},{xMin:-1.05,xMax:1.05,zMin:-6.4,zMax:-5.65},
    {xMin:-4.85,xMax:-4.15,zMin:.7,zMax:2.15},
    // Five narrow slices follow the open door, preserving the clear route at z=4.
    ...Array.from({length:5},(_,i)=>{const a=-.525+i*.21,b=a+.21,s=Math.sin(.82),c=Math.cos(.82),back=i<2?-.1:-.058;return {xMin:5.53+s*a+c*back,xMax:5.53+s*b+c*.04,zMin:4.66+c*a-s*.04,zMax:4.66+c*b-s*back};}),
    ...[3.3,4.7].map(z=>({xMin:5,xMax:5.08,zMin:z-.0375,zMax:z+.0375})),
    ...desks.map(({x,z})=>({xMin:x-.55,xMax:x+.55,zMin:z-.32,zMax:z+.8})),
    companionFootprint('classroom'),
  ]
};
function ThankyouNote({props}:{props:SceneProps}){
  const light=useRef<THREE.PointLight>(null),{gl}=useThree();
  useFrame(()=>{
    const t=readStoryTime(props),focus=isStoryBranch(props)&&props.branch==='imagined'&&t<3;
    // The original note stays on its actual desk. The imagined act is speaking
    // the gratitude aloud, rather than showing a hand-off that never occurs.
    const strength=focus?.55*Math.sin(Math.PI*Math.min(t/3,1)):.0;
    if(light.current)light.current.intensity=strength;
    gl.domElement.dataset.noteStatus='on-desk';gl.domElement.dataset.noteFocus=strength.toFixed(3);
  });
  return <group name="graduation-thankyou-note" position={[1.9,.813,0]}>
    <group rotation={[-Math.PI/2,0,-.18]}><Part s={[.24,.16,.003]} color="#e3d8b9" radius={.003}/><Sign text="谢谢你" small="一张没来得及递出的纸条" p={[0,0,.003]} s={[.23,.15,.002]} background="#e3d8b9" color="#797464"/></group>
    <pointLight ref={light} position={[0,.27,0]} color="#ffe3b1" intensity={0} distance={1.3} decay={2}/>
  </group>;
}
function Desk({p,m,index}:{p:V3;m:ArchitectureMaterials;index:number}){
  return <group position={p}>
    <Part p={[0,.76,0]} s={[1.05,.065,.62]} radius={.035} material={m.wood}/><Part p={[0,.71,.15]} s={[1,.025,.25]} color="#514b37"/>
    <Part p={[0,.6,.19]} s={[1,.18,.035]} material={m.wood}/><Part p={[-.5,.61,0]} s={[.025,.22,.59]} material={m.wood}/><Part p={[.5,.61,0]} s={[.025,.22,.59]} material={m.wood}/>
    {[-.43,.43].flatMap(x=>[-.22,.22].map(z=><group key={x+':'+z}><Rod a={[x,.045,z]} b={[x,.72,z]} r={.023} material={m.steel}/><Part p={[x,.03,z]} s={[.065,.05,.07]} color="#464b43" radius={.015}/></group>))}
    <Rod a={[-.43,.21,.2]} b={[.43,.21,.2]} r={.014} material={m.steel}/>
    <group position={[0,0,.69]}><Part p={[0,.45,0]} s={[.63,.055,.49]} material={m.wood} radius={.04}/><Part p={[0,.78,.24]} s={[.63,.22,.04]} material={m.wood} rotation={[.08,0,0]} radius={.04}/>
      {[-.24,.24].map(x=><group key={x}><Rod a={[x,.03,-.16]} b={[x,.46,-.16]} r={.02} material={m.steel}/><Rod a={[x,.03,.18]} b={[x,.89,.24]} r={.02} material={m.steel}/><Rod a={[x,.18,-.16]} b={[x,.18,.18]} r={.012} material={m.steel}/></group>)}
    </group>
    {index%3!==0&&<group rotation={[0,index*.4,0]}><Part p={[-.15,.813,0]} s={[.34,.025,.24]} color={index%2?'#536c70':'#a48b6a'} radius={.006}/><Part p={[-.15,.828,0]} s={[.31,.003,.215]} color="#d8d2b7" radius={.001}/><Rod a={[.12,.81,.04]} b={[.31,.81,-.04]} r={.004} color="#67523b"/></group>}
  </group>;
}
export default function Classroom(props:SceneProps){
  const m=useArchitectureMaterials(),explore=props.phase==='exploration',overview=props.viewMode==='overview';
  return <group name="classroom-world-v3">
    <Part p={[1.4,-.12,-1]} s={[12.8,.24,12]} material={m.floor}/>
    <group name="full-scale-interior-shell">
      <Part p={[0,1.8,-7]} s={[10.1,3.6,.18]} color="#cfccb8"/>
      {!overview&&<><Part p={[0,1.8,5]} s={[10.1,3.6,.16]} color="#d3cebc"/><Part p={[0,3.65,-1]} s={[10.2,.16,12.1]} color="#dedbca"/></>}
      {[[-7,3.25],[4.75,5]].map(([a,b])=><Part key={a} p={[5,1.8,(a+b)/2]} s={[.16,3.6,b-a]} color="#d6d1bf"/>)}
      <Part p={[5,3.23,4]} s={[.16,.8,1.55]} color="#d6d1bf"/>
      <Part p={[-5,.61,-1]} s={[.17,1.22,12]} color="#8c9f8e"/>
      <Part p={[-5,3.14,-1]} s={[.17,.93,12]} color="#d8d5c1"/>
      {[-6.8,-3.8,-.8,2.2,4.8].map(z=><Part key={z} p={[-5,2,z]} s={[.18,1.6,.18]} color="#d4d0bb"/>)}
      <Part p={[0,.08,-6.88]} s={[9.9,.15,.035]} color="#4a5b4d"/><Part p={[4.91,.55,-2.3]} s={[.035,1.1,9]} color="#91a18c"/>
    </group>
    {[-5.3,-2.3,.7,3.5].map(z=><group key={z}>
      <Part p={[-4.96,2,z]} s={[.045,1.59,2.75]} color="#72817b"/>
      <Part p={[-4.91,2,z]} s={[.025,1.45,2.59]} material={m.glass}/>
      <Part p={[-4.88,2,z]} s={[.055,1.49,.045]} color="#c3c2b0"/><Part p={[-4.88,2.13,z]} s={[.055,.035,2.62]} color="#c3c2b0"/>
      <Part p={[-4.75,1.22,z]} s={[.42,.065,2.82]} material={m.stone}/>
      <Rod a={[-4.5,2.96,z-1.4]} b={[-4.5,2.96,z+1.4]} r={.016} color="#83866d"/>
      {[-1,1].map(side=><group key={side}>{[0,1,2,3].map(i=><Part key={i} p={[-4.5+i%2*.017,2.09,z+side*(1.19-i*.07)]} s={[.07,1.7,.085]} color={i%2?'#c8ccb6':'#bdc3aa'} radius={.03}/>)}</group>)}
    </group>)}
    <AnchorObject id="tv" onAnchor={id=>explore&&props.onAnchor(id)}><Part p={[0,1.76,-6.85]} s={[6.6,1.9,.11]} material={m.wood} radius={.02}/><Sign text="毕业快乐 · 后会有期" small="THANK YOU FOR BEING PART OF MY YOUTH" p={[0,1.76,-6.77]} s={[6.4,1.69,.03]} background="#28443d" color="#c0cbb5"/><Part p={[0,.8,-6.67]} s={[6.6,.06,.15]} material={m.silver}/>{[-2,-1.5,1.9].map(x=><Part key={x} p={[x,.84,-6.65]} s={[.12,.015,.02]} color="#dfd4b6"/>)}<Part p={[2.5,.83,-6.65]} s={[.17,.05,.07]} color="#7f7763"/></AnchorObject>
    <Part p={[0,.86,-6.02]} s={[1.95,.08,.72]} material={m.wood}/><Part p={[0,.44,-6.06]} s={[1.65,.8,.52]} color="#88714f"/>
    {desks.map(({x,z},i)=><Desk key={x+':'+z} p={[x,0,z]} m={m} index={i}/>)}
    <AnchorObject id="doll" onAnchor={id=>explore&&props.onAnchor(id)}><ThankyouNote props={props}/></AnchorObject>
    <Part p={[-4.49,.49,1.4]} s={[.61,.98,1.3]} material={m.wood}/><Part p={[-4.12,.7,1.4]} s={[.025,.45,1.2]} material={m.glass}/>
    <AnchorObject id="photo" onAnchor={id=>explore&&props.onAnchor(id)}><Sign text="我们的毕业纪念册" small="EVERY ORDINARY DAY WAS A GIFT" p={[-4.09,1.2,1.4]} s={[1.2,.7,.035]} rotation={[0,Math.PI/2,0]} background="#68766b" color="#e5dcc2"/></AnchorObject>
    <Sign text="高二 · 三班" small="CLASS THREE" p={[5.14,3.13,4]} s={[1.15,.35,.035]} rotation={[0,Math.PI/2,0]}/>
    <Part p={[5.04,1.42,3.3]} s={[.08,2.84,.075]} material={m.wood}/><Part p={[5.04,1.42,4.7]} s={[.08,2.84,.075]} material={m.wood}/>
    <group position={[5.53,0,4.66]} rotation={[0,.82,0]}><Part p={[0,1.38,0]} s={[.08,2.75,1.05]} material={m.wood}/><Part p={[-.05,1.9,0]} s={[.016,.68,.7]} material={m.glass}/><Rod a={[-.08,1.1,-.31]} b={[-.08,1.1,-.14]} r={.02} material={m.brass}/></group>
    {[-5,-1,3].map(z=><group key={z}>
      {[5.2,7.6].map(x=><Part key={x} p={[x,1.8,z]} s={[.2,3.6,.2]} color="#dbd7c4"/>)}
      <Part p={[7.7,.45,z]} s={[.12,.9,3.8]} color="#879c83"/>
      <Part p={[6.4,3.63,z]} s={[2.8,.16,4]} color="#dbd7c4"/>
    </group>)}
    {[-3.5,.5].map(z=><group key={z}>
      {[-2.5,2.5].map(x=><group key={x}><Rod a={[x,3.62,z]} b={[x,3.2,z]} r={.008} material={m.iron}/><Part p={[x,3.18,z]} s={[1.25,.08,.16]} color="#b9beb2"/><mesh position={[x,3.132,z]} rotation={[Math.PI/2,0,0]}><planeGeometry args={[1.16,.1]}/><meshStandardMaterial color="#eee9ce" emissive="#e5dfbd" emissiveIntensity={.7}/></mesh></group>)}
    </group>)}
    <Sign text="值日生：认真过好今天" small="DAY BY DAY" p={[3.95,2.23,-6.88]} s={[1.25,.85,.04]} background="#c6bf9f" color="#526151"/>
    <StoryCompanion template="classroom" preset={props.companion||'young-woman'} props={props}/>
    {props.branch==='imagined'&&<pointLight position={[0,2,-1]} intensity={1.5} color="#ffdfa2" distance={7}/>}
    <Part p={[-11,-.6,-1]} s={[10,.15,22]} color="#8a9870"/>
    {[-5,1,6].map(z=><group key={z}><Rod a={[-9,-.5,z]} b={[-9,4,z]} r={.13} color="#716c50"/>{[0,1,2,3,4].map(i=><mesh key={i} position={[-9+Math.cos(i*2.4)*1.1,3.1+i*.28,z+Math.sin(i*2.4)]} scale={[1.7,1.05,1.5]} castShadow><icosahedronGeometry args={[1,2]}/><meshStandardMaterial color={i%2?'#7d926a':'#84986b'} roughness={.9}/></mesh>)}</group>)}
    <Part p={[12,1.25,-6]} s={[7,4,14]} color="#b3b5a4"/>
  </group>;
}
