import {useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';

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
export function ScannedTelevision(){
  const model=useScannedModel(TV_URL);
  const television=useMemo(()=>{
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshStandardMaterial))return;
      const source=object.material;
      // The scan supplies the convex glass itself. Keep its PBR maps and add a light clear coat.
      object.material=new THREE.MeshPhysicalMaterial({name:'television_02-clearcoat',map:source.map,normalMap:source.normalMap,normalScale:source.normalScale,aoMap:source.aoMap,roughnessMap:source.roughnessMap,metalnessMap:source.metalnessMap,color:source.color,roughness:source.roughness,metalness:source.metalness,side:source.side,clearcoat:.35,clearcoatRoughness:.16});
    });
    return model;
  },[model]);
  return <group name="cc0-scanned-television" rotation={[0,-Math.PI/2,0]} position={[0,-.3475,0]} scale={1.58}>
    <primitive object={television}/>
    <pointLight position={[-.02,.23,.4]} intensity={.035} color="#b5cec9" distance={1.8}/>
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
