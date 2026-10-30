import {useFrame,useThree} from '@react-three/fiber';
import {useRef} from 'react';
import type {SceneProps} from '../types';
import {storyDuration} from '../narrativeTimeline';
export default function NarrativeClock(props:SceneProps){
  const {gl}=useThree();
  const lastShadow=useRef(-1);
  const previousRevision=useRef(-1);
  useFrame((_,dt)=>{
    const state=props.storyClock?.current;if(!state)return;
    if(previousRevision.current!==state.revision){previousRevision.current=state.revision;lastShadow.current=-1;gl.shadowMap.needsUpdate=true;}
    const branch=props.phase==='real-branch'||props.phase==='imagined-branch';
    const active=(branch||props.phase==='exploration')&&!props.characterPreview;
    if(active&&state.playing){state.time+=Math.min(dt,.25);if(branch&&state.time>=storyDuration(props.templateId||'old-home',props.branch)){state.time=storyDuration(props.templateId||'old-home',props.branch);state.playing=false;}}
    gl.domElement.dataset.storyTime=state.time.toFixed(2);gl.domElement.dataset.storyPlaying=String(state.playing);gl.domElement.dataset.storyRevision=String(state.revision);
    if(branch&&state.playing&&state.time-lastShadow.current>.2){gl.shadowMap.needsUpdate=true;lastShadow.current=state.time;}
  });
  return null;
}
