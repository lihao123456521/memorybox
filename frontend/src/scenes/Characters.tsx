import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { animateHumanRig, createHumanRig } from './HumanRig';
import type { HumanAnimation, HumanMotion } from './HumanRig';

export type CharacterPreset = 'young-man'|'elder-man'|'young-woman'|'elder-woman';
export const CHARACTER_PRESETS:{id:CharacterPreset;label:string;description:string}[] = [
  {id:'young-man',label:'青年男性',description:'利落短发，蓝色翻领衬衣，牛仔裤与皮鞋'},
  {id:'elder-man',label:'长者男性',description:'年长面部形态，灰白短发、细框眼镜与浅灰细格衬衫'},
  {id:'young-woman',label:'青年女性',description:'自然成年比例，长发马尾，衬衫与裙装'},
  {id:'elder-woman',label:'长者女性',description:'年长面部形态，银灰短发、细框眼镜与鼠尾草绿针织开衫'},
];
type Pose='standing'|'seated';
export type CharacterAnimationRef={current:HumanAnimation};
type Props={preset:CharacterPreset;position?:[number,number,number];rotation?:number;pose?:Pose;visible?:boolean;
  motion?:HumanMotion;animationTime?:number;walkingSpeed?:number;reducedMotion?:boolean;
  animationClock?:{current:{time:number;playing:boolean;revision:number}};animation?:CharacterAnimationRef};

// Geometry and textures belong to the asset cache. Only bones and artist-facing material
// parameters are local to an instance, so two identical presets can animate independently.
const textureCache=new Map<string,Promise<THREE.Texture>>();
function sharedTexture(url:string,normal:boolean){
  let pending=textureCache.get(url);
  if(!pending){pending=new THREE.TextureLoader().loadAsync(url).then(texture=>{
    texture.colorSpace=normal?THREE.NoColorSpace:THREE.SRGBColorSpace;texture.flipY=true;texture.anisotropy=4;return texture;
  });textureCache.set(url,pending);}
  return pending;
}

class CharacterBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function HumanAsset({preset,pose,motion='idle',animationTime,walkingSpeed=.65,reducedMotion=false,animationClock,animation}:Props&{pose:Pose}){
  const {gl,invalidate}=useThree();
  const {scene}=useGLTF(`/assets/models/${preset}${pose==='seated'?'-seated':''}.glb`);
  const rig=useMemo(()=>createHumanRig(scene,preset,pose==='seated'),[scene,preset,pose]);
  const lastShadow=useRef(-1);
  const sampledRevision=useRef(-1);
  const lastSample=useRef<{model:THREE.Group;time:number;motion:HumanMotion;speed:number;reduced:boolean}|null>(null);
  const model=rig.model;
  useFrame(({clock},dt)=>{
    const state=animation?.current,time=animationClock?.current.time??state?.time??animationTime??clock.elapsedTime;
    const currentMotion=state?.motion??motion,speed=state?.speed??walkingSpeed;
    if(animationClock&&(sampledRevision.current!==animationClock.current.revision||lastSample.current?.model!==model)){
      for(const name of ['idle','walk','wave','talk'] as const)rig.blend[name]=name===currentMotion?1:0;
      sampledRevision.current=animationClock.current.revision;lastSample.current=null;
    }
    const last=lastSample.current;
    if(animationClock&&!animationClock.current.playing&&last&&last.model===model&&last.time===time&&last.motion===currentMotion&&last.speed===speed&&last.reduced===reducedMotion)return;
    animateHumanRig(rig,currentMotion,time,speed,animationClock&&!animationClock.current.playing?0:Math.min(dt,.1),reducedMotion);
    lastSample.current={model,time,motion:currentMotion,speed,reduced:reducedMotion};
    // Animated shadows need another shadow pass; the scene otherwise caches its static map.
    if(currentMotion!=='idle'&&(!reducedMotion||currentMotion==='walk')&&clock.elapsedTime-lastShadow.current>.12){gl.shadowMap.needsUpdate=true;lastShadow.current=clock.elapsedTime;}
  });
  useEffect(()=>{
    let alive=true;const pending:Promise<unknown>[]=[];
    model.userData.characterTextureErrors=[];
    const load=(url:string,normal:boolean,apply:(texture:THREE.Texture)=>void)=>{pending.push(sharedTexture(url,normal).then(texture=>{
      if(!alive)return;apply(texture);gl.shadowMap.needsUpdate=true;invalidate();
    }).catch(()=>{if(alive)model.userData.characterTextureErrors.push(url);}));};
    const byName=new Map<string,THREE.MeshStandardMaterial[]>();
    model.traverse(o=>{if(o instanceof THREE.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
      if(material instanceof THREE.MeshStandardMaterial){const list=byName.get(material.name)||[];list.push(material);byName.set(material.name,list);}
    }});
    for(const [name,materials]of byName){
      if(name==='reference:hair-strands')materials.forEach(m=>{m.roughness=.88;m.envMapIntensity=.25;});
      // These maps were baked offline from the reviewed v5 multi-view references.
      // Keep independent eye/brow meshes on their original, seam-correct UV textures.
      if(name==='skin'){
        load(`/assets/models/reference-materials-v5/${preset}-skin-color.webp`,false,texture=>materials.forEach(m=>{m.map=texture;m.color.set('#fff');m.roughness=.64;m.envMapIntensity=.55;m.needsUpdate=true;}));
        load(`/assets/models/reference-materials-v5/${preset}-skin-normal.webp`,true,texture=>materials.forEach(m=>{m.normalMap=texture;m.normalScale.set(.18,.18);m.needsUpdate=true;}));
      }
      if(!name.startsWith('cc0:'))continue;
      const id=name.slice(4);
      if(['male_casualsuit01','male_casualsuit03','female_elegantsuit01','elder-shirt'].includes(id)){
        load(`/assets/models/reference-materials-v5/${preset}-outfit-color.webp`,false,texture=>materials.forEach(m=>{m.map=texture;m.color.set('#fff');m.roughness=.89;m.envMapIntensity=.32;m.needsUpdate=true;}));
        load(`/assets/models/reference-materials-v5/${preset}-outfit-normal.webp`,true,texture=>materials.forEach(m=>{m.normalMap=texture;m.normalScale.set(.24,.24);m.needsUpdate=true;}));
        continue;
      }
      if(id==='brown')materials.forEach(m=>{m.roughness=.29;m.envMapIntensity=.38;});
      if(['short04','short02','ponytail01','braid01'].includes(id))materials.forEach(m=>{m.roughness=.88;m.envMapIntensity=.25;});
      load(`/assets/models/materials/${id}-color.webp`,false,texture=>materials.forEach(m=>{m.map=texture;m.needsUpdate=true;}));
      if(['male_casualsuit01','male_casualsuit03','female_elegantsuit01','elder-shirt','shoes04'].includes(id)){
        load(`/assets/models/materials/${id}-normal.webp`,true,texture=>materials.forEach(m=>{m.normalMap=texture;m.normalScale.set(.48,.48);m.needsUpdate=true;}));
      }
    }
    void Promise.allSettled(pending).then(()=>{if(alive){model.userData.characterReady=true;gl.shadowMap.needsUpdate=true;invalidate();}});
    return()=>{alive=false;};
  },[model,preset,gl,invalidate]);
  useEffect(()=>()=>{rig.skeleton.dispose();rig.materials.forEach(m=>m.dispose());},[rig]);
  return <primitive object={model} dispose={null}/>;
}

function CharacterLoadError(){
  return <Html position={[0,1.25,0]} center><div role="status" style={{width:170,padding:'10px 14px',borderRadius:10,background:'rgba(25,30,33,.85)',color:'#f3efe5',fontSize:12,lineHeight:1.6,textAlign:'center',boxShadow:'0 8px 30px #0003'}}>人物模型加载失败<br/>请刷新后重试</div></Html>;
}

/** One unit is one metre; +Z faces forward. Path movement belongs to the parent. */
export function Character({preset,position=[0,0,0],rotation=0,pose='standing',visible=true,...animation}:Props){
  if(!visible)return null;
  return <group position={position} rotation={[0,rotation,0]} name={`character-${preset}-${pose}`}>
    <CharacterBoundary key={`${preset}-${pose}`} fallback={<CharacterLoadError/>}>
      <Suspense fallback={null}><HumanAsset preset={preset} pose={pose} {...animation}/></Suspense>
    </CharacterBoundary>
  </group>;
}
