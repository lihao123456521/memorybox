import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface RoomMaterials {
  floor:THREE.MeshStandardMaterial; wall:THREE.MeshStandardMaterial; ceiling:THREE.MeshStandardMaterial;
  wood:THREE.MeshStandardMaterial; darkWood:THREE.MeshStandardMaterial; fabric:THREE.MeshStandardMaterial;
  redFabric:THREE.MeshStandardMaterial; linen:THREE.MeshStandardMaterial; metal:THREE.MeshStandardMaterial;
  darkMetal:THREE.MeshStandardMaterial; ceramic:THREE.MeshStandardMaterial; tile:THREE.MeshStandardMaterial;
  leaf:THREE.MeshStandardMaterial; glass:THREE.MeshPhysicalMaterial; black:THREE.MeshStandardMaterial;
  brass:THREE.MeshStandardMaterial; stone:THREE.MeshStandardMaterial; paper:THREE.MeshStandardMaterial;
  ink:THREE.MeshStandardMaterial; leather:THREE.MeshStandardMaterial; cotton:THREE.MeshStandardMaterial;
  blanket:THREE.MeshStandardMaterial; rug:THREE.MeshStandardMaterial; lampShade:THREE.MeshStandardMaterial;
  greenGlass:THREE.MeshPhysicalMaterial; mirror:THREE.MeshStandardMaterial;
}

function detailTexture(kind:'wood'|'cloth'|'paper'|'rug',rough=false){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!;
  const backgrounds={wood:'#bc9b74',cloth:'#ded9c6',paper:'#ebe7da',rug:'#b5a68b'};
  x.fillStyle=rough?'#c5c5c5':backgrounds[kind];x.fillRect(0,0,512,512);
  for(let i=0;i<1400;i++){const a=(Math.sin(i*12.9898)*43758.5453)%1,alpha=.018+Math.abs(a)*.028;x.strokeStyle=rough?`rgba(20,20,20,${alpha})`:`rgba(58,43,25,${alpha})`;x.lineWidth=kind==='wood'?.35:1;x.beginPath();
    if(kind==='wood'){const yy=i/1400*512;for(let j=0;j<=24;j++){const xx=j/24*512,y=yy+Math.sin(j*.28+i*.11)*1.8;if(j)x.lineTo(xx,y);else x.moveTo(xx,y);}}
    else if(i%2){x.moveTo((i*.819)%512,0);x.lineTo((i*.819)%512,512);}else{x.moveTo(0,(i*.713)%512);x.lineTo(512,(i*.713)%512);}x.stroke();}
  if(kind==='rug'){for(let i=0;i<7;i++){x.strokeStyle=i%2?'#d4c4a8':'#81785f';x.lineWidth=1.6;x.strokeRect(17+i*5,17+i*5,478-i*10,478-i*10);}}
  if(kind==='cloth'&&!rough){x.fillStyle='rgba(94,112,90,.16)';for(let i=0;i<512;i+=56)x.fillRect(i,0,3,512);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=rough?THREE.NoColorSpace:THREE.SRGBColorSpace;t.anisotropy=4;return t;
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
    wood:new THREE.MeshStandardMaterial({color:'#c4a98a',roughness:.46,map:detailTexture('wood'),roughnessMap:detailTexture('wood',true),normalScale:new THREE.Vector2(.10,.10)}),
    darkWood:new THREE.MeshStandardMaterial({color:'#74533b',roughness:.44,map:detailTexture('wood'),roughnessMap:detailTexture('wood',true),normalScale:new THREE.Vector2(.08,.08)}),
    fabric:new THREE.MeshStandardMaterial({color:'#c6ccc5',roughness:1,normalScale:new THREE.Vector2(.5,.5)}),
    redFabric:new THREE.MeshStandardMaterial({color:'#cf9c89',roughness:1,normalScale:new THREE.Vector2(.3,.3)}),
    linen:new THREE.MeshStandardMaterial({color:'#e3dfce',roughness:1,side:THREE.DoubleSide,normalScale:new THREE.Vector2(.12,.12)}),
    metal:new THREE.MeshStandardMaterial({color:'#a6aaa4',metalness:.77,roughness:.27}),
    darkMetal:new THREE.MeshStandardMaterial({color:'#393d3c',metalness:.38,roughness:.43}),
    ceramic:new THREE.MeshStandardMaterial({color:'#ede8d9',roughness:.23,metalness:.03}),
    tile:new THREE.MeshStandardMaterial({color:'#dfddd3',roughness:.59,map:tileTexture()}),
    leaf:new THREE.MeshStandardMaterial({color:'#426c42',roughness:.88,side:THREE.DoubleSide}),
    glass:new THREE.MeshPhysicalMaterial({color:'#e4eee9',roughness:.055,transmission:.35,thickness:.005,ior:1.5,transparent:true,opacity:.19,metalness:.02,side:THREE.DoubleSide,depthWrite:false}),
    black:new THREE.MeshStandardMaterial({color:'#272c2b',roughness:.64}),
    brass:new THREE.MeshStandardMaterial({color:'#a58c58',metalness:.75,roughness:.37}),
    stone:new THREE.MeshStandardMaterial({color:'#c3beb1',roughness:.54}),
    paper:new THREE.MeshStandardMaterial({color:'#f5f1e5',roughness:.95,map:detailTexture('paper')}),
    ink:new THREE.MeshStandardMaterial({color:'#6b675b',roughness:1}),
    leather:new THREE.MeshStandardMaterial({color:'#697365',roughness:.74,roughnessMap:detailTexture('cloth',true)}),
    cotton:new THREE.MeshStandardMaterial({color:'#ede7d7',roughness:1,map:detailTexture('cloth')}),
    blanket:new THREE.MeshStandardMaterial({color:'#96a38a',roughness:1,map:detailTexture('cloth'),side:THREE.DoubleSide}),
    rug:new THREE.MeshStandardMaterial({color:'#c1b79e',roughness:1,map:detailTexture('rug')}),
    lampShade:new THREE.MeshStandardMaterial({color:'#eee2c2',roughness:.9,emissive:'#eed4a6',emissiveIntensity:.14,side:THREE.DoubleSide}),
    greenGlass:new THREE.MeshPhysicalMaterial({color:'#436e57',roughness:.17,metalness:.08,clearcoat:.8,side:THREE.DoubleSide}),
    mirror:new THREE.MeshStandardMaterial({color:'#c3d0ca',roughness:.16,metalness:.94})
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
    for(const [material,repeat]of [[bank.floor,[4,3.5]]] as const){
      map(material,'map','wood_floor_diff',[...repeat]);map(material,'normalMap','wood_floor_nor_gl',[...repeat]);map(material,'roughnessMap','wood_floor_rough',[...repeat]);
    }
    map(bank.wall,'map','painted_plaster_wall_diff',[2.3,1.45]);map(bank.wall,'normalMap','painted_plaster_wall_nor_gl',[2.3,1.45]);map(bank.wall,'roughnessMap','painted_plaster_wall_rough',[2.3,1.45]);
    for(const material of [bank.fabric,bank.redFabric,bank.linen,bank.cotton,bank.blanket]){map(material,'normalMap','fabric_pattern_07_nor_gl',[10,10]);map(material,'roughnessMap','fabric_pattern_07_rough',[10,10]);}
    map(bank.fabric,'map','fabric_pattern_07_col_2',[5,5]);map(bank.redFabric,'map','fabric_pattern_07_col_1',[3,3]);
    return()=>{active=false;textures.forEach(t=>t.dispose());};
  },[bank]);
  return bank;
}
