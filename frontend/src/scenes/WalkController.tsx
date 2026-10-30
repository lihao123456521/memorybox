import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import type {SceneProps} from '../types';
import {EYE_HEIGHT,WALK_START,moveWithCollisions,roomZone,canStand} from './navigation';
import type {Collider,WorldLayout} from './navigation';
import {Character} from './Characters';
import type {CharacterAnimationRef} from './Characters';

interface Props extends SceneProps {layout?:WorldLayout;colliders:Collider[];anchorPositions:Record<string,[number,number,number]>;onDragging:(active:boolean)=>void}
export default function WalkController(props:Props){
  const {camera,gl,size,scene}=useThree();
  const player=useRef(new THREE.Vector3(...WALK_START));
  const look=useRef({yaw:0,pitch:-.02});
  const keys=useRef(new Set<string>());
  const dragging=useRef(false);
  const pointer=useRef({x:0,y:0,startX:0,startY:0});
  const prevMode=useRef(props.viewMode||'walk');
  const prevSelected=useRef<string|null>(null);
  const preFocusLook=useRef({yaw:0,pitch:0});
  const collisions=useRef(0);
  const stepTime=useRef(0);
  const lastZone=useRef('');
  const lastDiag=useRef(0);
  const state=useRef(props);state.current=props;
  const avatar=useRef<THREE.Group>(null),avatarHeading=useRef(Math.PI);
  const avatarAnimation=useRef<CharacterAnimationRef['current']>({motion:'idle',time:0,speed:0});
  const cinematicLook=useRef(new THREE.Vector3(-1,1.2,-1.6));
  const inWalk=props.viewMode!=='overview'||props.phase==='real-branch'||props.phase==='imagined-branch'||props.characterPreview||!!props.selected,third=props.viewMode==='third-person';
  const canWalk=inWalk&&props.phase==='exploration'&&!props.selected&&!props.navigationPaused;

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const t=event.target as HTMLElement;
      if(t.closest('input,textarea,select,[contenteditable="true"]'))return;
      const key=event.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
        if(state.current.phase==='exploration'&&state.current.viewMode!=='overview'&&!state.current.navigationPaused&&!state.current.selected){event.preventDefault();keys.current.add(key);}
      }
    };
    const onUp=(event:KeyboardEvent)=>keys.current.delete(event.key.toLowerCase());
    const clear=()=>{keys.current.clear();dragging.current=false;state.current.onDragging(false);};
    const canvas=gl.domElement;
    const down=(event:PointerEvent)=>{
      if(state.current.phase!=='exploration'||state.current.viewMode==='overview'||state.current.navigationPaused||state.current.selected)return;
      if(event.button!==0&&event.pointerType==='mouse')return;
      dragging.current=true;pointer.current={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
      canvas.setPointerCapture?.(event.pointerId);
    };
    const move=(event:PointerEvent)=>{
      if(!dragging.current)return;
      const dx=event.clientX-pointer.current.x,dy=event.clientY-pointer.current.y;
      if(Math.hypot(event.clientX-pointer.current.startX,event.clientY-pointer.current.startY)>4)state.current.onDragging(true);
      look.current.yaw-=dx*.0032;look.current.pitch=THREE.MathUtils.clamp(look.current.pitch-dy*.0032,-1.05,.95);
      pointer.current.x=event.clientX;pointer.current.y=event.clientY;
    };
    const up=()=>{if(dragging.current){dragging.current=false;state.current.onDragging(false);}};
    window.addEventListener('keydown',onKey);window.addEventListener('keyup',onUp);window.addEventListener('blur',clear);
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',clear);
    return()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',clear);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',clear);};
  },[gl]);
  useEffect(()=>{
    if(!canWalk){keys.current.clear();dragging.current=false;props.onDragging(false);}
  },[canWalk]);
  useEffect(()=>{
    player.current.set(...(props.layout?.start||WALK_START));look.current={yaw:0,pitch:-.02};collisions.current=0;
    if(inWalk){camera.position.copy(player.current);camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');}
    else{const fit=size.width<700?Math.max(1,.84/(size.width/size.height)):1;camera.position.fromArray(props.layout?.overview||[11,9,12]).multiplyScalar(fit);camera.lookAt(...(props.layout?.target||[.7,0,-1.1]));}
  },[props.resetKey,props.layout?.id]);
  useEffect(()=>{
    const mode=props.viewMode||'walk';
    const cinematic=props.phase==='real-branch'||props.phase==='imagined-branch';
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=cinematic?48:props.selected?50:mode==='walk'?(size.width<700?72:66):mode==='third-person'?56:43;camera.updateProjectionMatrix();}
    if(mode==='overview'){
      const fit=size.width<700?Math.max(1,.84/(size.width/size.height)):1;
      camera.position.fromArray(props.layout?.overview||[11,9,12]).multiplyScalar(fit);camera.lookAt(...(props.layout?.target||[.7,0,-1.1]));
    }else if(prevMode.current==='overview'){
      camera.position.copy(player.current);camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
    }
    prevMode.current=mode;
  },[props.viewMode,size.width,size.height,camera,props.layout?.id,props.phase,props.characterPreview,props.selected]);
  useEffect(()=>{
    if(!(camera instanceof THREE.PerspectiveCamera))return;
    const staged=props.phase==='real-branch'||props.phase==='imagined-branch'||!!props.selected;
    if(staged&&size.width>760)camera.setViewOffset(size.width,size.height,-size.width*.18,0,size.width,size.height);
    else if(staged)camera.setViewOffset(size.width,size.height,0,size.height*.17,size.width,size.height);
    else if(props.viewMode==='third-person')camera.setViewOffset(size.width,size.height,0,size.height*.055,size.width,size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  },[camera,size.width,size.height,props.phase,props.selected,props.viewMode]);
  useEffect(()=>{
    if(props.selected&&!prevSelected.current)preFocusLook.current={...look.current};
    if(!props.selected&&prevSelected.current)look.current={...preFocusLook.current};
    prevSelected.current=props.selected;
  },[props.selected]);

  useFrame(({clock},delta)=>{
    const dt=Math.min(delta,.1);
    let moved=0;
    if(inWalk){
      if(canWalk){
        const forward=(keys.current.has('w')||keys.current.has('arrowup')?1:0)-(keys.current.has('s')||keys.current.has('arrowdown')?1:0)+(props.moveIntent?.forward||0);
        const right=(keys.current.has('d')||keys.current.has('arrowright')?1:0)-(keys.current.has('a')||keys.current.has('arrowleft')?1:0)+(props.moveIntent?.right||0);
        const length=Math.hypot(forward,right);
        if(length>.01){
          const speed=1.65*dt/Math.max(1,length);
          const dx=(-Math.sin(look.current.yaw)*forward+Math.cos(look.current.yaw)*right)*speed;
          const dz=(-Math.cos(look.current.yaw)*forward-Math.sin(look.current.yaw)*right)*speed;
          const next=moveWithCollisions(player.current.x,player.current.z,dx,dz,props.colliders,props.layout);
          if(Math.hypot(next.x-player.current.x-dx,next.z-player.current.z-dz)>.001)collisions.current++;
          moved=Math.hypot(next.x-player.current.x,next.z-player.current.z);
          if(moved>.0001){avatarHeading.current=Math.atan2(next.x-player.current.x,next.z-player.current.z);stepTime.current+=dt;}
          player.current.set(next.x,EYE_HEIGHT,next.z);
        }
      }
      if(props.characterPreview){
        const actor=scene.getObjectByName(props.previewPlayer?'memory-player':'memory-companion'),position=actor?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(-1.7,0,-1.6);
        const offsets=[[.85,1.9],[-.85,1.9],[.85,-1.9],[-.85,-1.9],[1.8,0]];
        const offset=offsets.find(([x,z])=>canStand(position.x+x,position.z+z,props.colliders,props.layout))||[.7,.7];
        camera.position.lerp(position.clone().add(new THREE.Vector3(offset[0],1.52,offset[1])),props.reducedMotion?1:1-Math.exp(-dt*4));
        camera.lookAt(position.x,position.y+1.25,position.z);
      }else if(props.phase==='real-branch'||props.phase==='imagined-branch'){
        const actor=scene.getObjectByName('memory-companion'),position=actor?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(-1.7,0,-1.6);
        const eye=props.templateId==='station'?new THREE.Vector3(.15,2.0,3.6):props.templateId==='classroom'?new THREE.Vector3(.3,1.85,4.1):position.z<-3?new THREE.Vector3(-.15,1.8,-1.7):new THREE.Vector3(2.5,1.8,1.85);
        const aim=position.clone().add(new THREE.Vector3(0,1.13,0));
        if(props.templateId==='station'&&(props.storyClock?.current.time||0)>9){aim.x=3.5;aim.z=-3.5;}
        camera.position.lerp(eye,props.reducedMotion?1:1-Math.exp(-dt*2));
        cinematicLook.current.lerp(aim,props.reducedMotion?1:1-Math.exp(-dt*3));camera.lookAt(cinematicLook.current);
      }else if(props.selected){
        const point=props.anchorPositions[props.selected],focus=point?new THREE.Vector3(...point):new THREE.Vector3(0,1,0);
        const preferred=props.templateId==='old-home'||!props.templateId?(props.selected==='tv'?[-2,.45]:props.selected==='doll'?[1.7,1.2]:[.6,1.8]):[.7,2.1];
        const offsets=[preferred,[-1.8,.4],[1.8,.4],[.6,1.8],[-.6,-1.8]];
        const offset=offsets.find(([x,z])=>canStand(focus.x+x,focus.z+z,props.colliders,props.layout))||preferred;
        const eye=new THREE.Vector3(focus.x+offset[0],THREE.MathUtils.clamp(focus.y+.42,1.5,2.1),focus.z+offset[1]);
        camera.position.lerp(eye,props.reducedMotion?1:1-Math.exp(-dt*5));camera.lookAt(focus);
      }else{
        if(third){
          // Retract the follow camera before a wall, door or furnishing occludes it.
          const base=new THREE.Vector3(player.current.x,2.05,player.current.z),distance=2.15;
          const clearance=(yaw:number)=>{let length=.06;for(let d=.06;d<=distance;d+=.09){if(!canStand(base.x+Math.sin(yaw)*d,base.z+Math.cos(yaw)*d,props.colliders,props.layout))break;length=d;}return length;};
          let followYaw=look.current.yaw,clear=clearance(followYaw),score=clear;
          if(clear<1.4)for(const offset of [.65,-.65,1.0,-1.0,1.3,-1.3,Math.PI/2,-Math.PI/2]){
            const available=clearance(look.current.yaw+offset),candidateScore=available-Math.abs(offset)*.24;
            if(candidateScore>score+.03){followYaw=look.current.yaw+offset;clear=available;score=candidateScore;}
          }
          const eye=base.add(new THREE.Vector3(Math.sin(followYaw)*clear,clear<1?Math.min(.43,1-clear):0,Math.cos(followYaw)*clear));
          if(camera instanceof THREE.PerspectiveCamera){const fittedFov=THREE.MathUtils.clamp(56+(2.15-clear)*14,56,80);if(Math.abs(camera.fov-fittedFov)>.1){camera.fov=fittedFov;camera.updateProjectionMatrix();}}
          eye.y+=Math.sin(-look.current.pitch)*.65;
          eye.y=THREE.MathUtils.clamp(eye.y,1.7,2.52);
          const intermediate=camera.position.clone().lerp(eye,props.reducedMotion?1:1-Math.exp(-dt*9));
          const steps=Math.max(1,Math.ceil(camera.position.distanceTo(intermediate)/.08));let clearSegment=true;
          for(let i=1;i<=steps;i++){const t=i/steps;if(!canStand(THREE.MathUtils.lerp(camera.position.x,intermediate.x,t),THREE.MathUtils.lerp(camera.position.z,intermediate.z,t),props.colliders,props.layout)){clearSegment=false;break;}}
          camera.position.copy(clearSegment?intermediate:eye);
          camera.lookAt(player.current.x-Math.sin(look.current.yaw)*.35,1.02+look.current.pitch*.4,player.current.z-Math.cos(look.current.yaw)*.35);
        }else{
          camera.position.copy(player.current);
          if(canWalk&&!props.reducedMotion&&moved>.0001)camera.position.y+=Math.sin(stepTime.current*9)*.012;
        }
        camera.rotation.order='YXZ';
        if(props.selected){
          const pos=props.anchorPositions[props.selected];
          const focus=pos?new THREE.Vector3(...pos):new THREE.Vector3(0,1,0);
          const target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position,focus,new THREE.Vector3(0,1,0)));
          camera.quaternion.slerp(target,props.reducedMotion?1:1-Math.exp(-dt*4));
        }else if(!third)camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
      }
    }
    const actorState=avatarAnimation.current;actorState.motion=moved>.0001?'walk':'idle';actorState.time=stepTime.current;actorState.speed=dt>0?moved/dt:0;
    if(avatar.current){avatar.current.position.set(player.current.x,0,player.current.z);const diff=Math.atan2(Math.sin(avatarHeading.current-avatar.current.rotation.y),Math.cos(avatarHeading.current-avatar.current.rotation.y));avatar.current.rotation.y+=diff*(props.reducedMotion?1:1-Math.exp(-dt*12));}
    const zone=roomZone(player.current.x,player.current.z,props.layout);
    if(lastZone.current!==zone){lastZone.current=zone;props.onZoneChange?.(zone);}
    if(clock.elapsedTime-lastDiag.current>.16){
      lastDiag.current=clock.elapsedTime;
      gl.domElement.dataset.navigationMode=props.viewMode||'walk';
      gl.domElement.dataset.playerPosition=player.current.toArray().map(v=>v.toFixed(3)).join(',');
      gl.domElement.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(3)).join(',');
      gl.domElement.dataset.cameraLook=JSON.stringify(look.current);
      gl.domElement.dataset.zone=zone;gl.domElement.dataset.collisionCount=String(collisions.current);
      gl.domElement.dataset.companion=props.companion||'elder-woman';
      gl.domElement.dataset.navigationPaused=String(!canWalk);
      gl.domElement.dataset.playerAvatarVisible=String((third||props.previewPlayer)&&props.phase==='exploration'&&(!props.characterPreview||props.previewPlayer)&&!props.selected);
      gl.domElement.dataset.playerMotion=actorState.motion;gl.domElement.dataset.playerSpeed=actorState.speed.toFixed(2);
    }
  });
  return <>
    {(third||props.previewPlayer)&&<group ref={avatar} name="memory-player" rotation={[0,Math.PI,0]} visible={props.phase==='exploration'&&(!props.characterPreview||props.previewPlayer)&&!props.selected}><Character preset={props.playerAvatar||'young-man'} animation={avatarAnimation} reducedMotion={props.reducedMotion}/></group>}
    {!inWalk&&<OrbitControls key={`${props.layout?.id}:${props.resetKey}`} makeDefault target={props.layout?.target||[.7,0,-1.1]} enablePan={false} minDistance={8} maxDistance={90} minPolarAngle={.3} maxPolarAngle={1.35} enabled={!props.selected&&!props.navigationPaused}/>}
  </>;
}
