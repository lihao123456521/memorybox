import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import type {SceneProps} from '../types';
import {EYE_HEIGHT,WALK_START,moveWithCollisions,roomZone} from './navigation';
import type {Collider,WorldLayout} from './navigation';

interface Props extends SceneProps {layout?:WorldLayout;colliders:Collider[];anchorPositions:Record<string,[number,number,number]>;onDragging:(active:boolean)=>void}
export default function WalkController(props:Props){
  const {camera,gl,size}=useThree();
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
  const inWalk=(props.viewMode||'walk')==='walk';
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
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=mode==='walk'?(size.width<700?72:66):43;camera.updateProjectionMatrix();}
    if(mode==='overview'){
      const fit=size.width<700?Math.max(1,.84/(size.width/size.height)):1;
      camera.position.fromArray(props.layout?.overview||[11,9,12]).multiplyScalar(fit);camera.lookAt(...(props.layout?.target||[.7,0,-1.1]));
    }else if(prevMode.current==='overview'){
      camera.position.copy(player.current);camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
    }
    prevMode.current=mode;
  },[props.viewMode,size.width,size.height,camera,props.layout?.id]);
  useEffect(()=>{
    if(props.selected&&!prevSelected.current)preFocusLook.current={...look.current};
    if(!props.selected&&prevSelected.current)look.current={...preFocusLook.current};
    prevSelected.current=props.selected;
  },[props.selected]);

  useFrame(({clock},delta)=>{
    const dt=Math.min(delta,.1);
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
          player.current.set(next.x,EYE_HEIGHT,next.z);stepTime.current+=dt;
        }
      }
      if(props.characterPreview){
        camera.position.lerp(new THREE.Vector3(-.8,1.6,.45),props.reducedMotion?1:1-Math.exp(-dt*4));
        camera.lookAt(-2.35,1.28,-1.6);
      }else if(props.phase==='real-branch'||props.phase==='imagined-branch'){
        camera.position.lerp(new THREE.Vector3(2.8,1.65,2.05),props.reducedMotion?1:1-Math.exp(-dt*3));
        camera.lookAt(-1,1,-.7);
      }else{
        camera.position.copy(player.current);
        if(canWalk&&!props.reducedMotion&&keys.current.size)camera.position.y+=Math.sin(stepTime.current*9)*.012;
        camera.rotation.order='YXZ';
        if(props.selected){
          const pos=props.anchorPositions[props.selected];
          const focus=pos?new THREE.Vector3(...pos):new THREE.Vector3(0,1,0);
          const target=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position,focus,new THREE.Vector3(0,1,0)));
          camera.quaternion.slerp(target,props.reducedMotion?1:1-Math.exp(-dt*4));
        }else camera.rotation.set(look.current.pitch,look.current.yaw,0,'YXZ');
      }
    }
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
    }
  });
  return inWalk?null:<OrbitControls key={`${props.layout?.id}:${props.resetKey}`} makeDefault target={props.layout?.target||[.7,0,-1.1]} enablePan={false} minDistance={8} maxDistance={90} minPolarAngle={.3} maxPolarAngle={1.35} enabled={!props.selected&&!props.navigationPaused}/>;
}
