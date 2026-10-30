import {useEffect,useState} from 'react';
import {Pause,Play,RotateCcw} from 'lucide-react';
import type {Branch,StoryClockRef,TemplateId} from './types';
import {storyCue,storyDuration} from './narrativeTimeline';

export default function StoryPlayback({clock,template,branch,departure,lines,compact=false}:{clock:StoryClockRef;template:TemplateId;branch:Branch|null;departure:boolean;lines?:string[];compact?:boolean}){
  const [snapshot,setSnapshot]=useState({...clock.current});
  useEffect(()=>{const timer=setInterval(()=>setSnapshot({...clock.current}),180);return()=>clearInterval(timer);},[clock]);
  const duration=storyDuration(template,branch),cue=storyCue(template,branch,departure,snapshot.time);
  const toggle=()=>{if(branch&&clock.current.time>=duration)clock.current={time:0,playing:true,revision:clock.current.revision+1};else clock.current.playing=!clock.current.playing;setSnapshot({...clock.current});};
  const replay=()=>{clock.current={time:0,playing:true,revision:clock.current.revision+1};setSnapshot({...clock.current});};
  return <div className={`story-playback ${compact?'compact':''}`} data-testid="story-playback">
    {!compact&&<><div className="live-story-cue"><span className={snapshot.playing?'playing-dot':'paused-dot'}/><strong>{cue.label}</strong><span>{Math.min(snapshot.time,duration).toFixed(0)} / {duration}秒</span></div><p className="live-action-caption">{cue.action}</p></>}
    {lines&&<ol className="dialogue-sequence">{lines.map((line,index)=><li key={index} className={cue.index===index?'current':cue.index>index?'past':''}><span>{String(index+1).padStart(2,'0')}</span><p>{line}</p></li>)}</ol>}
    <div className="story-playback-controls"><button onClick={toggle} aria-label={snapshot.playing?'暂停剧情':'播放剧情'}>{snapshot.playing?<Pause size={16}/>:<Play size={16}/>}<span>{snapshot.playing?'暂停剧情':'播放剧情'}</span></button><button onClick={replay} aria-label="重播剧情"><RotateCcw size={16}/><span>重播</span></button><span>{compact?'电视节目 · 原创场景短片':'场景演绎 · 艺术化动作'}</span></div>
    {!compact&&<div className="story-progress"><span style={{width:`${Math.min(1,snapshot.time/duration)*100}%`}}/></div>}
  </div>;
}
