import {Suspense,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {Branch,CharacterPreset,Phase,StoryClockRef,TemplateId} from '../types';
import {Character} from './Characters';
import type {Collider} from './navigation';

type V3=[number,number,number];
type Motion='idle'|'walk'|'wave'|'talk';
export const COMPANION_ORIGINS:Record<TemplateId,V3>={'old-home':[-1.7,0,-1.6],classroom:[0,0,-1.6],station:[-2.35,0,-1.6]};
// Exploration uses a standing person's occupied floor area. During the story,
// navigation is locked, and the actor follows its separate validated route.
export function companionFootprint(template:TemplateId):Collider{const [x,,z]=COMPANION_ORIGINS[template];return {xMin:x-.25,xMax:x+.25,zMin:z-.25,zMax:z+.25};}
export interface StoryTiming {phase:Phase;branch:Branch|null;realDeparture?:boolean;storyClock?:StoryClockRef;storyTime?:number;storyPlaying?:boolean;reducedMotion?:boolean;selected?:string|null}
export const readStoryTime=(props:StoryTiming)=>Math.max(0,props.storyClock?.current.time??props.storyTime??0);
export const readStoryPlaying=(props:StoryTiming)=>props.storyClock?.current.playing??props.storyPlaying??true;
export const isStoryBranch=(props:StoryTiming)=>!!props.branch&&['real-branch','imagined-branch','letter'].includes(props.phase);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const facing=(a:V3,b:V3)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const turn=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*ease(t);
interface Action {position:V3;rotation:number;motion:Motion;speed:number;beat:string}
const still=(position:V3,rotation:number,motion:Motion,beat:string):Action=>({position,rotation,motion,speed:0,beat});
function walk(a:V3,b:V3,t:number,start:number,end:number,beat:string):Action{
  const u=clamp((t-start)/(end-start)),e=ease(u),distance=Math.hypot(b[0]-a[0],b[2]-a[2]);
  return {position:[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e,a[2]+(b[2]-a[2])*e],rotation:facing(a,b),motion:'walk',speed:distance*6*u*(1-u)/(end-start),beat};
}

// All routes use the clear floor lanes. The companion sends the protagonist off;
// a real branch never invents departure when the confirmed choice has no such fact.
export function companionAction(template:TemplateId,props:StoryTiming,t:number):Action{
  const origin=COMPANION_ORIGINS[template];
  if(!isStoryBranch(props))return still(origin,.5,props.selected&&t<2?'talk':'idle',props.selected?'object-memory':'exploring');
  if(props.branch==='real'&&!props.realDeparture)return still(origin,.5,t<3?'talk':'idle','confirmed-memory');
  const prefix=props.branch==='imagined'?'imagined':'real';
  if(template==='old-home'){
    const destination:V3=props.branch==='imagined'?[-1.35,0,-.2]:[-1.5,0,-3.95];
    const end=props.branch==='imagined'?5.6:7,yaw=facing(origin,destination),finalYaw=props.branch==='imagined'?Math.PI/2:0;
    if(t<2)return still(origin,.5,'talk',`${prefix}-conversation`);
    if(t<3)return still(origin,turn(.5,yaw,t-2),'idle',`${prefix}-turning`);
    if(t<end)return walk(origin,destination,t,3,end,`${prefix}-walking`);
    if(t<end+.7)return still(destination,turn(yaw,finalYaw,(t-end)/.7),'idle',`${prefix}-facing`);
    if(props.branch==='imagined'&&t<8.3)return still(destination,finalYaw,'talk','imagined-staying');
    return still(destination,finalYaw,t<11.5?'wave':'idle',`${prefix}-goodbye`);
  }
  if(template==='classroom'){
    const rear:V3=[0,0,3.9],door:V3=[4.2,0,3.9];
    if(t<2)return still(origin,.5,'talk',`${prefix}-conversation`);
    if(t<3)return still(origin,turn(.5,0,t-2),'idle',`${prefix}-turning`);
    if(t<7)return walk(origin,rear,t,3,7,`${prefix}-central-aisle`);
    if(t<8)return still(rear,turn(0,Math.PI/2,t-7),'idle',`${prefix}-rear-turn`);
    if(t<12)return walk(rear,door,t,8,12,`${prefix}-rear-aisle`);
    if(t<12.7)return still(door,turn(Math.PI/2,-Math.PI/2,(t-12)/.7),'idle',`${prefix}-facing`);
    return still(door,-Math.PI/2,'wave',`${prefix}-goodbye`);
  }
  const extra=props.branch==='imagined'?4:0,approach:V3=[1.25,0,-2.8],yaw=facing(origin,approach);
  if(t<2+extra)return still(origin,.5,'talk',`${prefix}-conversation`);
  if(t<3+extra)return still(origin,turn(.5,yaw,t-2-extra),'idle',`${prefix}-turning`);
  if(t<6+extra)return walk(origin,approach,t,3+extra,6+extra,`${prefix}-platform-approach`);
  if(t<6.6+extra)return still(approach,turn(yaw,Math.PI/2,(t-6-extra)/.6),'idle',`${prefix}-facing`);
  return still(approach,Math.PI/2,t<16+extra?'wave':'idle',`${prefix}-platform-goodbye`);
}

export function trainAction(props:StoryTiming,t:number){
  if(!isStoryBranch(props)||props.branch==='real'&&!props.realDeparture)return {offset:0,signal:false,door:0,beat:isStoryBranch(props)?'confirmed-memory':'exploring'};
  const extra=props.branch==='imagined'?4:0,elapsed=Math.max(0,t-9-extra),accelerating=Math.min(elapsed,8);
  // Continuous displacement and wheel angle share the same travelled distance.
  const offset=-(.45*accelerating*accelerating+7.2*Math.max(0,Math.min(elapsed-8,4)));
  return {offset,signal:t>=8+extra,door:ease((t-7-extra)/1),beat:t<6+extra?'waiting':t<8+extra?'goodbye':t<9+extra?'departure-signal':t<18+extra?'departing':'departed'};
}

export function StoryCompanion({template,preset,props}:{template:TemplateId;preset:CharacterPreset;props:StoryTiming}){
  const initial=companionAction(template,props,readStoryTime(props)),root=useRef<THREE.Group>(null),{gl}=useThree();
  const animation=useRef({motion:initial.motion,time:readStoryTime(props),speed:0});
  useFrame(()=>{
    const time=readStoryTime(props),action=companionAction(template,props,time);
    if(!root.current)return;
    root.current.position.set(...action.position);root.current.rotation.y=action.rotation;
    animation.current.motion=action.motion;animation.current.time=time;animation.current.speed=action.speed;
    gl.domElement.dataset.companionAction=action.motion;
    gl.domElement.dataset.companionPosition=action.position.map(n=>n.toFixed(3)).join(',');
    gl.domElement.dataset.companionRotation=action.rotation.toFixed(3);
    const arm=root.current.getObjectByName('human-l-shoulder'),knee=root.current.getObjectByName('human-l-knee');
    if(arm&&knee)gl.domElement.dataset.companionPose=[arm.rotation.x,arm.rotation.z,knee.rotation.x].map(v=>v.toFixed(6)).join(',');
    gl.domElement.dataset.storyBeat=template==='station'?trainAction(props,time).beat:action.beat;
  });
  return <group ref={root} name="memory-companion" position={initial.position} rotation={[0,initial.rotation,0]}>
    <Suspense fallback={null}><Character preset={preset} position={[0,0,0]} rotation={0} pose="standing" animation={animation} animationClock={props.storyClock} reducedMotion={props.reducedMotion}/></Suspense>
  </group>;
}
