import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface RoomMaterials {
  floor:THREE.MeshStandardMaterial; wall:THREE.MeshStandardMaterial; ceiling:THREE.MeshStandardMaterial;
  wood:THREE.MeshStandardMaterial; darkWood:THREE.MeshStandardMaterial; fabric:THREE.MeshStandardMaterial;
  redFabric:THREE.MeshStandardMaterial; linen:THREE.MeshStandardMaterial; metal:THREE.MeshStandardMaterial;
  darkMetal:THREE.MeshStandardMaterial; ceramic:THREE.MeshStandardMaterial; tile:THREE.MeshStandardMaterial;
  leaf:THREE.MeshStandardMaterial; glass:THREE.MeshPhysicalMaterial; black:THREE.MeshStandardMaterial;
}

function tileTexture() {
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!;
  x.fillStyle='#c8c9bc';x.fillRect(0,0,256,256);x.fillStyle='#deddd2';x.fillRect(3,3,250,250);
  for(let i=0;i<1200;i++){x.fillStyle=`rgba(93,101,93,${.015+(i%5)*.003})`;x.fillRect((i*71)%256,(i*113)%256,1+(i%3),1+(i%2));}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,4);t.colorSpace=THREE.SRGBColorSpace;return t;
}

/** Local PBR maps load progressively; the room stays navigable if an optional file is unavailable. */
export function useRoomMaterials():RoomMaterials {
  const bank=useMemo<RoomMaterials>(()=>({
    floor:new THREE.MeshStandardMaterial({color:'#e4d6bf',roughness:.65,normalScale:new THREE.Vector2(.5,.5)}),
    wall:new THREE.MeshStandardMaterial({color:'#f3f1e8',roughness:.95,normalScale:new THREE.Vector2(.08,.08)}),
    ceiling:new THREE.MeshStandardMaterial({color:'#eeeae0',roughness:1}),
    wood:new THREE.MeshStandardMaterial({color:'#bca082',roughness:.52,normalScale:new THREE.Vector2(.17,.17)}),
    darkWood:new THREE.MeshStandardMaterial({color:'#6e5140',roughness:.48,normalScale:new THREE.Vector2(.12,.12)}),
    fabric:new THREE.MeshStandardMaterial({color:'#c6ccc5',roughness:1,normalScale:new THREE.Vector2(.5,.5)}),
    redFabric:new THREE.MeshStandardMaterial({color:'#cf9c89',roughness:1,normalScale:new THREE.Vector2(.3,.3)}),
    linen:new THREE.MeshStandardMaterial({color:'#e3dfce',roughness:1,side:THREE.DoubleSide,normalScale:new THREE.Vector2(.12,.12)}),
    metal:new THREE.MeshStandardMaterial({color:'#a6aaa4',metalness:.77,roughness:.27}),
    darkMetal:new THREE.MeshStandardMaterial({color:'#393d3c',metalness:.38,roughness:.43}),
    ceramic:new THREE.MeshStandardMaterial({color:'#ede8d9',roughness:.23,metalness:.03}),
    tile:new THREE.MeshStandardMaterial({color:'#dfddd3',roughness:.59,map:tileTexture()}),
    leaf:new THREE.MeshStandardMaterial({color:'#426c42',roughness:.88,side:THREE.DoubleSide}),
    glass:new THREE.MeshPhysicalMaterial({color:'#d9e2dc',roughness:.08,transmission:.12,transparent:true,opacity:.16,metalness:.08,side:THREE.DoubleSide,depthWrite:false}),
    black:new THREE.MeshStandardMaterial({color:'#272c2b',roughness:.64})
  }),[]);
  useMemo(()=>{
    // Whitewash covers the original surface discoloration while preserving photographed microstructure.
    bank.wall.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb = mix(vec3(0.83, 0.82, 0.78), diffuseColor.rgb, 0.14);');};
    bank.wall.customProgramCacheKey=()=> 'memorybox-whitewash-v1';
  },[bank]);
  useEffect(()=>{
    let active=true;const textures:THREE.Texture[]=[];const loader=new THREE.TextureLoader();
    function map(material:THREE.MeshStandardMaterial,field:'map'|'normalMap'|'roughnessMap',name:string,repeat:[number,number]) {
      loader.load(`/assets/textures/${name}_1k.jpg`,t=>{
        if(!active){t.dispose();return;}textures.push(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=4;
        t.colorSpace=field==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;material[field]=t;material.needsUpdate=true;
      },undefined,()=>{/* Flat physically based material remains a usable fallback. */});
    }
    for(const [material,repeat]of [[bank.floor,[4,3.5]],[bank.wood,[1,.5]],[bank.darkWood,[1,.5]]] as const){
      map(material,'map','wood_floor_diff',[...repeat]);map(material,'normalMap','wood_floor_nor_gl',[...repeat]);map(material,'roughnessMap','wood_floor_rough',[...repeat]);
    }
    map(bank.wall,'map','painted_plaster_wall_diff',[2.3,1.45]);map(bank.wall,'normalMap','painted_plaster_wall_nor_gl',[2.3,1.45]);map(bank.wall,'roughnessMap','painted_plaster_wall_rough',[2.3,1.45]);
    for(const material of [bank.fabric,bank.redFabric,bank.linen]){map(material,'normalMap','fabric_pattern_07_nor_gl',[8,8]);map(material,'roughnessMap','fabric_pattern_07_rough',[8,8]);}
    map(bank.fabric,'map','fabric_pattern_07_col_2',[3,3]);map(bank.redFabric,'map','fabric_pattern_07_col_1',[2,2]);
    return()=>{active=false;textures.forEach(t=>t.dispose());};
  },[bank]);
  return bank;
}
