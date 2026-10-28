import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export type CharacterPreset = 'young-man'|'elder-man'|'young-woman'|'elder-woman';
export const CHARACTER_PRESETS:{id:CharacterPreset;label:string;description:string}[] = [
  {id:'young-man',label:'青年男性',description:'自然成年比例，短发，浅蓝长袖衬衫与深色长裤'},
  {id:'elder-man',label:'长者男性',description:'年长面部形态，灰白短发、眼镜与米色长袖衬衫'},
  {id:'young-woman',label:'青年女性',description:'自然成年比例，深色中长发，陶红长袖上衣与长裤'},
  {id:'elder-woman',label:'长者女性',description:'年长面部形态，银灰盘发、眼镜与鼠尾草绿上衣'},
];
type Pose='standing'|'seated';
type Props={preset:CharacterPreset;position?:[number,number,number];rotation?:number;pose?:Pose;visible?:boolean};
const colors:Record<CharacterPreset,{skin:string;shirt:string;hair:string;trousers:string;height:number}>={
  'young-man':{skin:'#c99f85',shirt:'#8aabb4',hair:'#282622',trousers:'#3d4d58',height:1.78},
  'elder-man':{skin:'#c3a089',shirt:'#b3ab95',hair:'#c1bdb3',trousers:'#535349',height:1.72},
  'young-woman':{skin:'#d7af98',shirt:'#a86e61',hair:'#302a26',trousers:'#4c5552',height:1.66},
  'elder-woman':{skin:'#c7a28a',shirt:'#7e9283',hair:'#b7b5ad',trousers:'#535249',height:1.64},
};

class CharacterBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function HumanAsset({preset,pose}:{preset:CharacterPreset;pose:Pose}){
  const {scene}=useGLTF(`/assets/models/${preset}${pose==='seated'?'-seated':''}.glb`);
  const model=useMemo(()=>{
    const copy=scene.clone(true);
    copy.name=`glb-character-${preset}`;
    copy.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
    return copy;
  },[scene]);
  useEffect(()=>{
    let alive=true;let skin:THREE.Texture|undefined;
    new THREE.TextureLoader().load(`/assets/models/skins/${preset}.webp`,texture=>{
      skin=texture;texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;texture.anisotropy=4;
      if(!alive){texture.dispose();return;}
      model.traverse(o=>{if(o instanceof THREE.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof THREE.MeshStandardMaterial&&material.name==='skin'){material.map=texture;material.color.set('#ffffff');material.roughness=.82;material.needsUpdate=true;}}});
    },undefined,()=>{/* A missing optional skin map retains the complete, clothed mesh. */});
    return()=>{alive=false;skin?.dispose();};
  },[model,preset]);
  return <primitive object={model} dispose={null}/>;
}

function Ellipsoid({p,s,color}:{p:[number,number,number];s:[number,number,number];color:string}){
  return <mesh position={p} scale={s} castShadow><sphereGeometry args={[1,24,18]}/><meshStandardMaterial color={color} roughness={.84}/></mesh>;
}
function Limb({a,b,r,color}:{a:[number,number,number];b:[number,number,number];r:number;color:string}){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
  return <mesh position={start.add(end).multiplyScalar(.5)} quaternion={q} castShadow><capsuleGeometry args={[r,Math.max(.001,direction.length()-r*2),8,16]}/><meshStandardMaterial color={color} roughness={.94}/></mesh>;
}

/** Complete adult, fully clothed fallback; never substitutes a naked body on load failure. */
function ClothedFallback({preset,pose}:{preset:CharacterPreset;pose:Pose}){
  const c=colors[preset],seated=pose==='seated',drop=seated?.44:0,hip=.91-drop,head=1.62-drop;
  const female=preset.endsWith('woman'),elder=preset.startsWith('elder');
  return <group scale={c.height/1.76} name={`fully-clothed-fallback-${preset}`}>
    <Ellipsoid p={[0,1.25-drop,.015]} s={[female?.18:.205,.30,.12]} color={c.shirt}/>
    <Ellipsoid p={[0,.94-drop,0]} s={[.173,.15,.12]} color={c.trousers}/>
    <Limb a={[0,1.44-drop,0]} b={[0,1.54-drop,.008]} r={.048} color={c.skin}/>
    <Ellipsoid p={[0,head,.014]} s={[.081,.113,.082]} color={c.skin}/>
    <Ellipsoid p={[0,head+.061,-.008]} s={[.085,.065,.079]} color={c.hair}/>
    {female&&<Ellipsoid p={[0,head+.014,-.053]} s={elder?[.047,.058,.049]:[.083,.11,.051]} color={c.hair}/>}
    <Ellipsoid p={[0,head-.004,.091]} s={[.014,.026,.018]} color={c.skin}/>
    <Ellipsoid p={[0,head-.046,.085]} s={[.023,.004,.005]} color="#aa7d70"/>
    {[-1,1].map(side=><group key={side}>
      <Ellipsoid p={[side*.082,head-.008,.004]} s={[.015,.029,.018]} color={c.skin}/>
      <Ellipsoid p={[side*.031,head+.015,.086]} s={[.011,.006,.004]} color="#ddd8cd"/>
      <Ellipsoid p={[side*.031,head+.015,.09]} s={[.004,.005,.002]} color="#302d28"/>
      <Ellipsoid p={[side*.031,head+.034,.084]} s={[.018,.002,.003]} color={c.hair}/>
      <Limb a={[side*.185,1.43-drop,0]} b={[side*.228,1.17-drop,.022]} r={.057} color={c.shirt}/>
      <Limb a={[side*.228,1.17-drop,.022]} b={[side*.24,.96-drop,seated?.15:.045]} r={.045} color={c.shirt}/>
      <Ellipsoid p={[side*.24,.913-drop,seated?.16:.047]} s={[.035,.055,.022]} color={c.skin}/>
      {[0,1,2,3].map(i=><Limb key={i} a={[side*(.219+i*.013),.89-drop,seated?.166:.052]} b={[side*(.219+i*.013),.848-drop+(i===0?.008:0),seated?.17:.056]} r={.0055} color={c.skin}/>)}
      <Limb a={[side*.223,.931-drop,seated?.18:.065]} b={[side*.207,.898-drop,seated?.193:.082]} r={.007} color={c.skin}/>
      <Limb a={[side*.103,hip,0]} b={[side*.115,seated?.47:.47,seated?.39:.025]} r={.085} color={c.trousers}/>
      <Limb a={[side*.115,.47,seated?.39:.025]} b={[side*.117,.10,seated?.40:.012]} r={.062} color={c.trousers}/>
      <Ellipsoid p={[side*.117,.05,seated?.46:.073]} s={[.057,.044,.112]} color="#39352f"/>
      <Ellipsoid p={[side*.117,.017,seated?.46:.073]} s={[.059,.012,.114]} color="#292a26"/>
      {elder&&<mesh position={[side*.032,head+.014,.095]} scale={[1,.79,1]}><torusGeometry args={[.022,.0015,6,24]}/><meshStandardMaterial color="#716d61" roughness={.5} metalness={.3}/></mesh>}
    </group>)}
    {[-.08,.08].map((x,i)=><Limb key={i} a={[x*.35,1.49-drop,.067]} b={[x,1.43-drop,.118]} r={.009} color={c.shirt}/>)}
    {[0,1,2,3].map(i=><Ellipsoid key={i} p={[0,1.37-drop-i*.075,.139]} s={[.0035,.0035,.002]} color="#d5cdbb"/>)}
  </group>;
}

/** One unit is one metre. Root y=0 corresponds to the floor for either pose. */
export function Character({preset,position=[0,0,0],rotation=0,pose='standing',visible=true}:Props){
  const breathing=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(breathing.current){const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;breathing.current.scale.y=reduced?1:1+Math.sin(clock.elapsedTime*1.2)*.0012;breathing.current.rotation.y=reduced?0:Math.sin(clock.elapsedTime*.21)*.006;}});
  if(!visible)return null;
  const fallback=<ClothedFallback preset={preset} pose={pose}/>;
  return <group position={position} rotation={[0,rotation,0]} name={`character-${preset}-${pose}`}>
    <group ref={breathing}><CharacterBoundary key={`${preset}-${pose}`} fallback={fallback}><Suspense fallback={fallback}><HumanAsset preset={preset} pose={pose}/></Suspense></CharacterBoundary></group>
  </group>;
}
