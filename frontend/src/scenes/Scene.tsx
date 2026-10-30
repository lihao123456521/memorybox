import {Suspense,useEffect,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {ContactShadows,Environment} from '@react-three/drei';
import * as THREE from 'three';
import type {AnchorId,SceneProps,TemplateId} from '../types';
import {getAnchorLabels} from '../data';
import PresentScene from './PresentScene';
import Room,{ANCHOR_POSITIONS,SCENE_ZONES,WALK_COLLIDERS} from './Room';
import Station,{STATION_LAYOUT} from './Station';
import Classroom,{CLASSROOM_LAYOUT} from './Classroom';
import WalkController from './WalkController';
import type {WorldLayout} from './navigation';
import NarrativeClock from './NarrativeClock';

const HOME_LAYOUT:WorldLayout={id:'old-home',anchors:ANCHOR_POSITIONS,colliders:WALK_COLLIDERS,zones:SCENE_ZONES,start:[0,1.64,2.5],overview:[13,12,16],target:[-1.2,.3,-1.8]};
export function layoutFor(id:TemplateId='old-home'){return id==='station'?STATION_LAYOUT:id==='classroom'?CLASSROOM_LAYOUT:HOME_LAYOUT;}

function IndoorLighting({branch,templateId}:{branch:SceneProps['branch'];templateId:SceneProps['templateId']}){
  const sun=useRef<THREE.DirectionalLight>(null);
  useFrame((_,dt)=>{if(sun.current){const color=new THREE.Color(branch==='real'?'#e3e8e9':branch==='imagined'?'#ffe2af':'#fff1d8');sun.current.color.lerp(color,1-Math.exp(-dt*2));sun.current.intensity=THREE.MathUtils.damp(sun.current.intensity,branch==='real'?2.1:3.1,2,dt);}});
  return <>
    <ambientLight intensity={.18} color="#f0e9d8"/>
    <hemisphereLight args={['#e0e8eb','#6d6959',.48]}/>
    <directionalLight ref={sun} position={templateId==='classroom'?[-10,8,5]:templateId==='station'?[13,11,-8]:[4,7,9]} intensity={3.1} color="#fff1d8" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={.5} shadow-camera-far={65} shadow-bias={-.00013} shadow-normalBias={.014}/>
    <directionalLight position={[-6,3,1]} intensity={.38} color="#dce8ef"/>
    <Environment files="/assets/environments/lebombo_1k.hdr" background={false} environmentIntensity={.52}/>
    <ContactShadows key={templateId} position={[0,.006,-2]} frames={1} scale={templateId==='station'?60:26} resolution={512} opacity={.32} blur={2.2} far={3.5} color="#332d22"/>
  </>;
}

interface Marker{id:AnchorId;x:number;y:number;visible:boolean}
function Diagnostics({props,layout,onProjection}:{props:SceneProps;layout:WorldLayout;onProjection:(markers:Marker[])=>void}){
  const {camera,gl,scene,size}=useThree(),elapsed=useRef(-1),raycaster=useRef(new THREE.Raycaster()),previousShadow=useRef('');
  const readySent=useRef(false);
  useFrame(({clock})=>{
    if(clock.elapsedTime-elapsed.current<.25)return;elapsed.current=clock.elapsedTime;
    let meshes=0,triangles=0;scene.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=((o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3)*(o instanceof THREE.InstancedMesh?o.count:1);}});
    const shadowVersion=`${props.branch}:${props.companion}:${meshes}`;
    if(previousShadow.current!==shadowVersion){previousShadow.current=shadowVersion;gl.shadowMap.needsUpdate=true;}
    const rect=gl.domElement.getBoundingClientRect(),projected:Record<string,{x:number;y:number;visible:boolean}>={},markers:Marker[]=[];
    for(const[id,p]of Object.entries(layout.anchors)){
      const v=new THREE.Vector3(...p).project(camera);
      projected[id]={x:rect.left+(v.x+1)*size.width/2,y:rect.top+(1-v.y)*size.height/2,visible:v.z>=-1&&v.z<=1&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1};
      const marker=new THREE.Vector3(...p);marker.y+=id==='doll'?.4:.6;
      const distance=marker.distanceTo(camera.position),screen=marker.clone().project(camera);
      let visible=props.phase==='exploration'&&screen.z>=-1&&screen.z<=1&&Math.abs(screen.x)<.98&&Math.abs(screen.y)<.98&&(props.viewMode==='overview'||distance<(props.hint?18:6.5));
      const shell=scene.getObjectByName('full-scale-interior-shell');
      if(visible&&shell&&props.viewMode!=='overview'){
        raycaster.current.set(camera.position,marker.clone().sub(camera.position).normalize());raycaster.current.far=Math.max(.01,distance-.1);
        visible=!raycaster.current.intersectObject(shell,true).some(hit=>{const material=(hit.object as THREE.Mesh).material;if(!material)return false;const m=Array.isArray(material)?material[0]:material;return !m.transparent&&m.opacity>.8;});
      }
      markers.push({id:id as AnchorId,x:(screen.x+1)*size.width/2,y:(1-screen.y)*size.height/2,visible});
    }
    const loadedCharacters:string[]=[];scene.traverse(o=>{if(o.name.startsWith('glb-character-'))loadedCharacters.push(o.name.slice(14));});
    const companion=scene.getObjectByName('memory-companion');let companionReady=false;
    companion?.traverse(o=>{if(o.name===`glb-character-${props.companion||'elder-woman'}`&&o.userData.characterReady===true)companionReady=true;});
    if(!readySent.current&&meshes>100&&companionReady){readySent.current=true;props.onWorldReady?.();}
    const canvas=gl.domElement;canvas.dataset.loadedCharacters=loadedCharacters.join(',');canvas.dataset.world='memory';canvas.dataset.sceneTemplate=props.templateId||'old-home';canvas.dataset.anchorScreen=JSON.stringify(projected);canvas.dataset.meshCount=String(meshes);canvas.dataset.triangles=String(Math.round(triangles));canvas.dataset.sceneRevision='living-memories-v4';canvas.dataset.companion=props.companion||'elder-woman';canvas.dataset.companionReady=String(companionReady);
    if(props.phase==='exploration')onProjection(markers);
  });
  return null;
}

function ImmersiveWorld(props:SceneProps&{onProjection:(markers:Marker[])=>void}){
  const dragging=useRef({active:false,ended:0}),layout=layoutFor(props.templateId);
  const cinematic=props.phase==='real-branch'||props.phase==='imagined-branch';
  const worldProps={...props,viewMode:cinematic?'walk' as const:props.viewMode};
  useEffect(()=>{props.onReady?.();},[]);
  const onDragging=(active:boolean)=>{if(dragging.current.active&&!active)dragging.current.ended=performance.now();dragging.current.active=active;};
  const onAnchor:SceneProps['onAnchor']=id=>{if(dragging.current.active||performance.now()-dragging.current.ended<180)return;props.onAnchor(id);};
  return <>
    <color attach="background" args={['#bfcbd0']}/><fog attach="fog" args={['#bfcbd0',40,100]}/>
    <IndoorLighting branch={props.branch} templateId={props.templateId}/>
    <NarrativeClock {...props}/>
    {props.templateId==='station'?<Station {...worldProps} onAnchor={onAnchor}/>:props.templateId==='classroom'?<Classroom {...worldProps} onAnchor={onAnchor}/>:<Room phase={props.phase} branch={props.branch} visited={props.visited} selected={props.selected} hint={props.hint} viewMode={worldProps.viewMode||'walk'} companion={props.companion||'elder-woman'} realDeparture={props.realDeparture} storyClock={props.storyClock} storyTime={props.storyTime} storyPlaying={props.storyPlaying} reducedMotion={props.reducedMotion} onAnchor={onAnchor}/>}
    <WalkController {...worldProps} layout={layout} colliders={layout.colliders} anchorPositions={layout.anchors} onDragging={onDragging}/>
    <Diagnostics props={props} layout={layout} onProjection={props.onProjection}/>
  </>;
}

export default function Scene(props:SceneProps){
  const [markers,setMarkers]=useState<Marker[]>([]),[crossed,setCrossed]=useState(false);
  useEffect(()=>{if(props.phase!=='transition-in'){setCrossed(false);return;}if(props.reducedMotion)return;const timer=setTimeout(()=>setCrossed(true),2600);return()=>clearTimeout(timer);},[props.phase,props.reducedMotion]);
  if(props.world==='present'||(props.phase==='transition-in'&&!props.reducedMotion&&!crossed))return <PresentScene {...props}/>;
  const labels=getAnchorLabels(props.templateId);
  return <div className="immersive-canvas-root" style={{position:'relative',height:'100%',width:'100%'}}>
    <Canvas key={props.templateId||'old-home'} shadows dpr={[1,1.5]} camera={{position:layoutFor(props.templateId).start,fov:66,near:.07,far:120}} gl={{antialias:true,powerPreference:'high-performance',alpha:false}} fallback={null} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;gl.outputColorSpace=THREE.SRGBColorSpace;gl.shadowMap.type=THREE.PCFSoftShadowMap;gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;}}><Suspense fallback={null}><ImmersiveWorld {...props} onProjection={setMarkers}/></Suspense></Canvas>
    <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>{props.phase==='exploration'&&markers.filter(marker=>marker.visible).map(marker=><button key={marker.id} className={`anchor-hotspot ${props.visited.includes(marker.id)?'visited':''}`} data-testid={`anchor-${marker.id}`} aria-label={`触摸${labels[marker.id]}`} style={{position:'absolute',left:marker.x,top:marker.y,transform:'translate(-50%,-50%)',pointerEvents:'auto'}} onClick={event=>{event.stopPropagation();const canvas=event.currentTarget.closest('.immersive-canvas-root')?.querySelector('canvas');if(canvas)canvas.dataset.lastAnchorSource=`hotspot:${marker.id}`;props.onAnchor(marker.id);}}><span>{props.visited.includes(marker.id)?'✓':'+'}</span>{labels[marker.id]}</button>)}</div>
  </div>;
}
