import {useEffect,useMemo,useRef} from 'react';
import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import type {StoryTiming} from './StoryActions';
import {readStoryPlaying} from './StoryActions';
import {useTelevisionProgramme} from './LocalTelevision';

const TV_URL='/assets/props/television_02-1k.glb';
const CHAIR_URL='/assets/props/chinese_armchair-1k.glb';

function useScannedModel(url:string){
  const {scene}=useGLTF(url);
  return useMemo(()=>{
    const model=scene.clone(true);
    model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    return model;
  },[scene]);
}

// Keep the original glTF orientation and materials; placement belongs to the enclosing group.
export function ScannedTelevision({props,powered=false}:{props:StoryTiming;powered?:boolean}){
  const model=useScannedModel(TV_URL);
  const programme=useTelevisionProgramme(props,powered),light=useRef<THREE.PointLight>(null),indicator=useRef<THREE.MeshBasicMaterial>(null);
  const television=useMemo(()=>{
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshStandardMaterial))return;
      const source=object.material;
      // The scan supplies the convex glass itself. Keep its PBR maps and add a light clear coat.
      object.material=new THREE.MeshPhysicalMaterial({name:'television_02-clearcoat',map:source.map,normalMap:source.normalMap,normalScale:source.normalScale,aoMap:source.aoMap,roughnessMap:source.roughnessMap,metalnessMap:source.metalnessMap,color:source.color,roughness:source.roughness,metalness:source.metalness,side:source.side,clearcoat:.35,clearcoatRoughness:.16});
    });
    return model;
  },[model]);
  const screen=useMemo(()=>{
    const positions:number[]=[],uv:number[]=[],normals:number[]=[];
    television.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const g=object.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index;
      const belongs=(i:number)=>p.getX(i)>=-.1602&&p.getX(i)<=.1566&&p.getY(i)>=.1401&&p.getY(i)<=.3775&&p.getZ(i)>.085&&n.getZ(i)>.9&&Math.abs(p.getZ(i)-.1106415)>.00001;
      for(let at=0;at<(idx?.count??p.count);at+=3){
        const ids=[0,1,2].map(o=>idx?idx.getX(at+o):at+o);
        if(!ids.every(belongs))continue;
        for(const i of ids){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);positions.push(x+n.getX(i)*.00035,y+n.getY(i)*.00035,z+n.getZ(i)*.00035);normals.push(n.getX(i),n.getY(i),n.getZ(i));uv.push((x+.160105)/.316541,(y-.140210)/.237199);}
      }
    });
    // Reuse the scan's actual convex glass, with a 0.35 mm normal offset.
    // A rectangular plane in front of the bezel would visibly float at oblique angles.
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
  },[television]);
  useEffect(()=>()=>{screen.dispose();television.traverse(object=>{if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});},[screen,television]);
  useFrame(()=>{const playing=powered&&readStoryPlaying(props);if(light.current)light.current.intensity=powered?.12:0;if(indicator.current)indicator.current.color.set(powered?playing?'#b5d999':'#efb362':'#60402e');});
  return <group name="cc0-scanned-television" rotation={[0,-Math.PI/2,0]} position={[0,-.3475,0]} scale={1.58}>
    <primitive object={television}/>
    <mesh name="television-convex-programme-screen" geometry={screen}><meshBasicMaterial map={programme} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>
    <mesh name="television-power-indicator" position={[.13,.069,.115]}><sphereGeometry args={[.003,10,8]}/><meshBasicMaterial ref={indicator} color="#60402e" toneMapped={false}/></mesh>
    <pointLight ref={light} position={[-.02,.23,.4]} intensity={0} color="#f1d6a4" distance={1.8}/>
  </group>;
}

export function ChineseArmchair(){
  const model=useScannedModel(CHAIR_URL);
  return <group name="cc0-chinese-armchair" position={[-6,.018,-5.38]} rotation={[0,Math.PI,0]} scale={.64}>
    <primitive object={model}/>
  </group>;
}

useGLTF.preload(TV_URL);
useGLTF.preload(CHAIR_URL);
