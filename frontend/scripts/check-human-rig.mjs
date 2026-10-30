// CPU acceptance for the actual shipped GLBs. No browser/GPU and no external services.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await fs.mkdtemp(path.join(frontend,'.human-rig-check-'));
try{
  for(const name of ['HumanJoints','HumanRig']){
    const source=await fs.readFile(path.join(frontend,'src/scenes',name+'.ts'),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
      .replace("from 'three'",`from '${pathToFileURL(path.join(frontend,'node_modules/three/build/three.module.js')).href}'`)
      .replace("from './HumanJoints'","from './HumanJoints.mjs'");
    await fs.writeFile(path.join(scratch,name+'.mjs'),code);
  }
  const {createHumanRig,animateHumanRig}=await import(pathToFileURL(path.join(scratch,'HumanRig.mjs')).href);
  const report=[];
  function footFloor(rig){
    const min={l:Infinity,r:Infinity};
    rig.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh&&o.name.includes('shoes04')){
      const positions=o.geometry.getAttribute('position'),p=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        p.fromBufferAttribute(positions,i);const side=p.x>0?'l':'r';o.applyBoneTransform(i,p);p.applyMatrix4(o.matrixWorld);min[side]=Math.min(min[side],p.y);
      }
    }});return min;
  }
  function handSurface(rig){
    const average=new THREE.Vector3(),wrist=new THREE.Vector3(...rig.joints['l-hand']);let count=0;
    rig.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name==='skin')){
      const positions=o.geometry.getAttribute('position'),p=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        p.fromBufferAttribute(positions,i);if(p.x<0||p.distanceTo(wrist)>.09)continue;
        o.applyBoneTransform(i,p);average.add(p.applyMatrix4(o.matrixWorld));count++;
      }
    }});assert.ok(count>10,'actual hand skin must remain present');return average.divideScalar(count);
  }
  for(const preset of ['young-man','elder-man','young-woman','elder-woman'])for(const seated of [false,true]){
    const file=preset+(seated?'-seated':'')+'.glb',bytes=await fs.readFile(path.join(frontend,'public/assets/models',file));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const start=performance.now(),rig=createHumanRig(gltf.scene,preset,seated),clone=createHumanRig(gltf.scene,preset,seated);
    let meshes=0,vertices=0;
    rig.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){
      meshes++;const weights=o.geometry.getAttribute('skinWeight'),indices=o.geometry.getAttribute('skinIndex');vertices+=weights.count;
      if(o.name.includes('fitted')||o.name.startsWith('smooth'))assert.ok(o.geometry.getAttribute('_human_rest'),'GLTFLoader must expose the exported anatomical rest attribute');
      for(let i=0;i<weights.count;i++){
        assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<.00001,'weights must sum to one');
        for(const value of [indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)])assert.ok(value>=0&&value<rig.skeleton.bones.length);
      }
      const other=clone.model.getObjectByName(o.name);assert.equal(other.geometry,o.geometry,'instances must share immutable weighted geometry');
      assert.notEqual(other.material,o.material,'material parameters must be isolated');
    }});
    assert.equal(rig.skeleton.bones.length,21);assert.notEqual(rig.skeleton,clone.skeleton);
    animateHumanRig(rig,'idle',0,.65,1,false);const base=rig.bones['l-hand'].bone.getWorldPosition(new THREE.Vector3()),surfaceBase=handSurface(rig);
    animateHumanRig(rig,'wave',1,.65,1,false);const raised=rig.bones['l-hand'].bone.getWorldPosition(new THREE.Vector3()),surfaceRaised=handSurface(rig);
    assert.ok(raised.y>base.y+.2,'wave must lift the hand at shoulder and elbow');
    assert.ok(surfaceRaised.y>surfaceBase.y+.2,`${file}: the original hand surface must follow the wave; measured lift ${(surfaceRaised.y-surfaceBase.y).toFixed(3)}m`);
    assert.equal(clone.bones['l-shoulder'].bone.rotation.z,0,'a second instance must not inherit the first instance animation');
    let lowest=Infinity,highestPlant=-Infinity;
    if(!seated)for(const reducedMotion of [false,true])for(const speed of [.3,.8,1.2])for(let step=0;step<24;step++){
      animateHumanRig(rig,'walk',step/24*2,speed,1,reducedMotion);const floor=footFloor(rig),plant=Math.min(floor.l,floor.r);
      lowest=Math.min(lowest,plant);highestPlant=Math.max(highestPlant,plant);
      assert.ok(plant>-.016,`${file}: shoe penetrated floor at ${plant.toFixed(4)}m`);
      assert.ok(plant<.025,`${file}: both feet float at ${plant.toFixed(4)}m`);
      for(const n of rig.skeleton.boneMatrices)assert.ok(Number.isFinite(n),'bone matrices must be finite');
    }
    if(!seated){
      const knees=Array.from({length:12},(_,i)=>{animateHumanRig(rig,'walk',i/12,.8,1,true);return rig.bones['l-knee'].bone.rotation.x;});
      assert.ok(Math.max(...knees)-Math.min(...knees)>.1,'reduced-motion actors must still articulate their walking knees');
    }
    animateHumanRig(rig,'idle',5,.65,1,true);const reduced=rig.bones.head.bone.quaternion.clone();
    animateHumanRig(rig,'idle',8,.65,1,true);assert.ok(reduced.angleTo(rig.bones.head.bone.quaternion)<1e-7,'reduced motion must hold the head still');
    report.push({file,bones:21,meshes,vertices,prepareTwoInstancesMs:Math.round(performance.now()-start),waveHandLiftM:+(raised.y-base.y).toFixed(3),waveSkinLiftM:+(surfaceRaised.y-surfaceBase.y).toFixed(3),...(seated?{}:{walkLowestSoleM:+lowest.toFixed(4),walkHighestPlantedSoleM:+highestPlant.toFixed(4)})});
    for(const r of [rig,clone]){r.skeleton.dispose();r.materials.forEach(m=>m.dispose());}
  }
  console.log(JSON.stringify({passed:true,variants:report},null,2));
}finally{
  const rel=path.relative(frontend,scratch);assert.ok(rel.startsWith('.human-rig-check-')&&!rel.includes(path.sep));
  await fs.rm(scratch,{recursive:true,force:true});
}
