import * as THREE from 'three';
import { HUMAN_JOINTS } from './HumanJoints';

export type HumanMotion='idle'|'walk'|'wave'|'talk';
export type HumanAnimation={motion:HumanMotion;time:number;speed:number};
type Point=[number,number,number];
type JointData=Record<string,Point>;
type Segment={a:THREE.Vector3;b:THREE.Vector3;length:number};
type RigBone={bone:THREE.Bone;rest:THREE.Vector3};
export type HumanRig={
  model:THREE.Group;bones:Record<string,RigBone>;skeleton:THREE.Skeleton;
  joints:JointData;seated:boolean;skirt:boolean;blend:Record<HumanMotion,number>;
  materials:THREE.Material[];footSamples:{mesh:THREE.SkinnedMesh;indices:number[]}[];
};

// Skin attributes are generated once per source geometry, shared by all instances.
// Runtime budget: 21 bones, four influences per vertex, no extra character draw calls.
const weightedGeometry=new WeakMap<THREE.BufferGeometry,Map<string,THREE.BufferGeometry>>();
const ease=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
const vector=(p:Point)=>new THREE.Vector3(...p);
const chain=(j:JointData,names:string[]):Segment[]=>names.slice(0,-1).map((name,i)=>{
  const a=vector(j[name]),b=vector(j[names[i+1]]);return {a,b,length:a.distanceTo(b)};
});
function nearest(point:THREE.Vector3,segments:Segment[]){
  let best=Infinity,along=0,length=0;
  for(const segment of segments){
    const d=segment.b.clone().sub(segment.a),t=THREE.MathUtils.clamp(point.clone().sub(segment.a).dot(d)/d.lengthSq(),0,1);
    const distance=point.distanceTo(segment.a.clone().addScaledVector(d,t));
    if(distance<best){best=distance;along=length+t*segment.length;}length+=segment.length;
  }
  return {distance:best,along,length};
}

function skinGeometry(source:THREE.BufferGeometry,key:string,j:JointData,names:string[],meshName:string,seated:boolean){
  if((meshName.includes('fitted')||meshName.startsWith('smooth'))&&!source.getAttribute('_human_rest'))throw Error('Character anatomical coordinates are missing; rebuild the character assets.');
  let variants=weightedGeometry.get(source);if(!variants){variants=new Map();weightedGeometry.set(source,variants);}
  const cached=variants.get(key);if(cached)return cached;
  const g=source.clone(),position=g.getAttribute('position'),restPosition=g.getAttribute('_human_rest')||position,indices=new Uint16Array(position.count*4),weights=new Float32Array(position.count*4);
  const id=(name:string)=>names.indexOf(name),point=new THREE.Vector3();
  const trunk=chain(j,['pelvis','spine-3','spine-1','neck','head']);
  const arms={l:chain(j,['l-shoulder','l-elbow','l-hand']),r:chain(j,['r-shoulder','r-elbow','r-hand'])};
  const legs={l:chain(j,['l-upper-leg','l-knee','l-ankle','l-foot-2']),r:chain(j,['r-upper-leg','r-knee','r-ankle','r-foot-2'])};
  // GLTFLoader sanitizes OBJ slashes and spaces out of node names.
  const headOnly=/fitted[_ ]?(hair|eyes|eyebrows|eyelashes)|spectacle|reading[_ ]glasses/.test(meshName);
  const shoes=meshName.includes('shoes04'),skirt=meshName.includes('female_elegantsuit01'),drape=meshName.includes('seated skirt');
  function add(result:Map<string,number>,bone:string,w:number){if(w>.00001)result.set(bone,(result.get(bone)||0)+w);}
  function limb(result:Map<string,number>,side:'l'|'r',kind:'arm'|'leg',amount:number){
    const segments=kind==='arm'?arms[side]:legs[side],sample=nearest(point,segments),first=segments[0].length;
    const firstBlend=ease(first-.065,first+.065,sample.along);
    if(kind==='arm'){
      const hand=ease(sample.length-.045,sample.length+.01,sample.along);
      add(result,side+'-shoulder',amount*(1-firstBlend));
      add(result,side+'-elbow',amount*firstBlend*(1-hand));add(result,side+'-hand',amount*firstBlend*hand);
    }else{
      const foot=ease(first+segments[1].length-.045,first+segments[1].length+.025,sample.along);
      add(result,side+'-upper-leg',amount*(1-firstBlend));
      add(result,side+'-knee',amount*firstBlend*(1-foot));add(result,side+'-ankle',amount*firstBlend*foot);
    }
  }
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(restPosition,i);const side=point.x>=0?'l':'r',result=new Map<string,number>();
    if(headOnly)add(result,'head',1);
    else if(shoes){
      // The CC0 shoe asset also contains the sock cuff; its upper part follows the shin.
      const calf=ease(j[side+'-ankle'][1]+.03,j[side+'-ankle'][1]+.09,point.y);
      add(result,side+'-knee',calf);add(result,side+'-ankle',1-calf);
    }
    else if(drape)add(result,'pelvis',1);
    else{
      const hip=j.pelvis[1],shoulder=j[side+'-shoulder'][1];
      const torso=nearest(point,trunk),arm=nearest(point,arms[side]);
      const torsoRadius=THREE.MathUtils.lerp(.15,.125,ease(hip,shoulder,point.y));
      const armAmount=ease(-.025,.035,(torso.distance-torsoRadius)-(arm.distance-.057))
        *(1-ease(shoulder+.015,shoulder+.075,point.y))*ease(hip-.12,hip+.015,point.y);
      limb(result,side,'arm',armAmount);
      const rest=1-armAmount,legAmount=(1-ease(hip-.06,hip+.095,point.y))*rest;
      if(skirt&&point.y<hip+.04){
        // A skirt is one continuous cloth surface: blend both thighs through the centre.
        // Independent left/right leg assignment would tear its centre seam during a step.
        const bend=(1-ease(hip-.22,hip+.04,point.y))*.90,left=ease(-.09,.09,point.x);
        add(result,'pelvis',rest*(1-bend));
        add(result,'l-upper-leg',rest*bend*left);add(result,'r-upper-leg',rest*bend*(1-left));
        // Two centimetres of hem ease keeps the knee inside the continuous garment.
        const loosen=(1-ease(hip-.24,hip-.055,point.y))*.022;
        position.setZ(i,position.getZ(i)+Math.sign(point.z-j.pelvis[2])*loosen);
      }else{
        if(legAmount>0)limb(result,side,'leg',legAmount);
        const body=rest-legAmount;
        if(body>0){
          const landmarks=['pelvis','spine-3','spine-1','neck','head'];let assigned=false;
          for(let n=0;n<landmarks.length-1;n++)if(point.y<j[landmarks[n+1]][1]){
            const t=ease(j[landmarks[n]][1],j[landmarks[n+1]][1],point.y);
            add(result,landmarks[n],body*(1-t));add(result,landmarks[n+1],body*t);assigned=true;break;
          }
          if(!assigned)add(result,'head',body);
        }
      }
    }
    const top=[...result].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,p)=>n+p[1],0)||1;
    top.forEach(([name,w],k)=>{indices[i*4+k]=id(name);weights[i*4+k]=w/sum;});
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  g.computeBoundingSphere();if(g.boundingSphere)g.boundingSphere.radius+=seated?.3:.55;
  variants.set(key,g);return g;
}

/** Rig the original continuous MakeHuman surfaces; no body-part replacement geometry. */
export function createHumanRig(scene:THREE.Group,preset:string,seated:boolean):HumanRig{
  const key=preset+(seated?'-seated':'');
  const model=scene.clone(true);model.name='glb-character-'+preset;model.userData.characterReady=false;
  const owner=(model.getObjectByName(key)||model.children[0]||model) as THREE.Group;
  const j=(owner.userData.humanBindJoints||HUMAN_JOINTS[key]) as JointData;
  if(!j)throw Error('Missing human anatomical landmarks: '+key);
  const weightingJoints=owner.userData.humanRestJoints as JointData;
  if(!weightingJoints)throw Error('Character anatomical landmarks are missing; rebuild the character assets.');
  const bones:Record<string,RigBone>={},names=['pelvis','spine-3','spine-1','neck','head',...(['l','r'] as const).flatMap(s=>[s+'-clavicle',s+'-shoulder',s+'-elbow',s+'-hand',s+'-upper-leg',s+'-knee',s+'-ankle',s+'-foot-2'])];
  const parent:Record<string,string|undefined>={pelvis:undefined,'spine-3':'pelvis','spine-1':'spine-3',neck:'spine-1',head:'neck'};
  for(const s of ['l','r'])Object.assign(parent,{[s+'-clavicle']:'spine-1',[s+'-shoulder']:s+'-clavicle',[s+'-elbow']:s+'-shoulder',[s+'-hand']:s+'-elbow',[s+'-upper-leg']:'pelvis',[s+'-knee']:s+'-upper-leg',[s+'-ankle']:s+'-knee',[s+'-foot-2']:s+'-ankle'});
  for(const name of names){
    const bone=new THREE.Bone();bone.name='human-'+name;const p=parent[name];
    bone.position.copy(vector(j[name]));if(p)bone.position.sub(vector(j[p]));
    bones[name]={bone,rest:bone.position.clone()};if(p)bones[p].bone.add(bone);else owner.add(bone);
  }
  const skeleton=new THREE.Skeleton(names.map(n=>bones[n].bone)),meshes:THREE.Mesh[]=[],materials:THREE.Material[]=[],footSamples:HumanRig['footSamples']=[];
  model.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  for(const source of meshes){
    const material=Array.isArray(source.material)?source.material.map(m=>m.clone()):source.material.clone();
    materials.push(...(Array.isArray(material)?material:[material]));
    const mesh=new THREE.SkinnedMesh(skinGeometry(source.geometry,key,weightingJoints,names,source.name,seated),material);
    mesh.name=source.name;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={...source.userData,humanSkin:true};
    source.parent?.add(mesh);source.removeFromParent();model.updateMatrixWorld(true);mesh.bind(skeleton);
    if(source.name.includes('shoes04')){
      const p=mesh.geometry.getAttribute('position'),selected:number[]=[];
      for(let i=0;i<p.count;i++)if(p.getY(i)<.035)selected.push(i);
      footSamples.push({mesh,indices:selected.filter((_,i)=>i%Math.max(1,Math.floor(selected.length/16))===0)});
    }
  }
  model.userData.humanRig={bones:names.length,influences:4,continuousMeshes:meshes.length,geometryShared:true,source:'MakeHuman CC0'};
  return {model,bones,skeleton,joints:j,seated,skirt:preset==='young-woman',blend:{idle:1,walk:0,wave:0,talk:0},materials,footSamples};
}

function legPose(rig:HumanRig,side:'l'|'r',time:number,speed:number,amount:number){
  const j=rig.joints,b=rig.bones,phase=time*speed/THREE.MathUtils.clamp(.31+speed*.29,.33,rig.skirt?.44:.68)+(side==='l'?0:.5),u=phase-Math.floor(phase),stance=.62;
  const stride=THREE.MathUtils.clamp(.31+speed*.29,.33,rig.skirt?.44:.68)*amount;
  const swing=u>stance?(u-stance)/(1-stance):0;
  const z=u<stance?stride*(.5-u/stance):stride*(-.5+ease(0,1,swing));
  const lift=u>stance?Math.sin(swing*Math.PI)**1.25*.065*amount:0;
  const hip=j[side+'-upper-leg'],knee=j[side+'-knee'],ankle=j[side+'-ankle'];
  const l1=Math.hypot(knee[1]-hip[1],knee[2]-hip[2]),l2=Math.hypot(ankle[1]-knee[1],ankle[2]-knee[2]);
  const pelvisY=b.pelvis.bone.position.y-b.pelvis.rest.y,dy=ankle[1]+lift-hip[1]-pelvisY,dz=ankle[2]+z-hip[2];
  const d=THREE.MathUtils.clamp(Math.hypot(dy,dz),Math.abs(l1-l2)+.001,l1+l2-.001),direction=Math.atan2(dz,-dy);
  const a=Math.acos(THREE.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)),c=Math.acos(THREE.MathUtils.clamp((l2*l2+d*d-l1*l1)/(2*l2*d),-1,1));
  const thigh=Math.atan2(knee[2]-hip[2],hip[1]-knee[1])-(direction+a);
  const shin=Math.atan2(ankle[2]-knee[2],knee[1]-ankle[1])-(direction-c)-thigh;
  b[side+'-upper-leg'].bone.rotation.x=thigh;
  b[side+'-knee'].bone.rotation.x=shin;
  b[side+'-ankle'].bone.rotation.x=-thigh-shin-Math.sin(swing*Math.PI)*.08*amount;
}

/** Time is supplied externally for story pause/replay; the rig never moves the actor's path. */
export function animateHumanRig(rig:HumanRig,motion:HumanMotion,time:number,speed:number,dt:number,reduced:boolean){
  // Accessibility reduces incidental sway; a travelling actor still needs a footstep.
  const b=rig.bones,t=reduced&&motion!=='walk'?0:time;
  for(const name of Object.keys(rig.blend) as HumanMotion[])rig.blend[name]=THREE.MathUtils.damp(rig.blend[name],motion===name?1:0,7,dt);
  for(const {bone,rest}of Object.values(b)){bone.position.copy(rest);bone.rotation.set(0,0,0);bone.scale.set(1,1,1);}
  const walk=rig.seated?0:rig.blend.walk,wave=rig.blend.wave,talk=reduced?0:rig.blend.talk;
  // Relax the pre-bent exported forearms; retain the complete shoulders, sleeves and hands.
  for(const side of ['l','r']){
    b[side+'-elbow'].bone.rotation.x=.35*(1-wave*(side==='l'?1:0));
    b[side+'-shoulder'].bone.rotation.z=(side==='l'?1:-1)*.035;
  }
  b['spine-3'].bone.rotation.x=Math.sin(t*1.45)*.005*(1-walk);
  b['spine-1'].bone.scale.y=1+(reduced?0:Math.sin(t*1.45)*.0018);
  b.neck.bone.rotation.y=reduced?0:Math.sin(t*.37)*.028*(1-walk);
  b.head.bone.rotation.x=(reduced?0:Math.sin(t*.63)*.012)+Math.sin(t*3.2)*.035*talk;
  b.head.bone.rotation.y=reduced?0:Math.sin(t*.29+.8)*.023*(1-walk);
  if(walk>.001){
    const v=THREE.MathUtils.clamp(Math.abs(speed),.16,1.7),stride=THREE.MathUtils.clamp(.31+v*.29,.33,rig.skirt?.44:.68),phase=t*v/stride*Math.PI*2;
    b.pelvis.bone.position.y-=.042*walk;
    b['spine-3'].bone.rotation.x=-.025*walk;
    b['spine-1'].bone.rotation.y=Math.sin(phase)*(reduced?.015:.035)*walk;
    for(const side of ['l','r'] as const){
      legPose(rig,side,t,v,walk);
      b[side+'-shoulder'].bone.rotation.x=Math.sin(phase+(side==='l'?Math.PI:0))*(reduced?.17:.25)*walk;
      b[side+'-elbow'].bone.rotation.x+=Math.max(0,Math.sin(phase+(side==='l'?Math.PI:0)))*.10*walk;
    }
  }
  if(wave>.001){
    // Keep the upper arm low and greet beside the face with a bent forearm. A high
    // shoulder lift stretches an ordinary shirt's continuous underarm into a broad fan.
    b['l-clavicle'].bone.rotation.z=.035*wave;
    b['l-shoulder'].bone.rotation.z=.82*wave;b['l-shoulder'].bone.rotation.x=-.12*wave;
    b['l-elbow'].bone.rotation.z=(1.75+Math.sin(t*6.2)*.09)*wave;
    b['l-elbow'].bone.rotation.x=.35*wave;b['l-hand'].bone.rotation.y=Math.sin(t*6.2)*.18*wave;
    b.neck.bone.rotation.z=-.025*wave;
  }
  if(talk>.001){
    b['r-shoulder'].bone.rotation.x=-.08*talk;b['r-elbow'].bone.rotation.x+=Math.sin(t*2.0)*.10*talk;
    b['r-hand'].bone.rotation.z=Math.sin(t*2.0+.6)*.05*talk;
  }
  rig.model.updateMatrixWorld(true);rig.skeleton.update();
}
