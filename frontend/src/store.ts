import {exampleDraft} from './data';
import type { AnchorId, Branch, CollectionEntry, Draft, Experience, Phase, Story } from './types';
export interface AppState { experience:Experience; collection:CollectionEntry[]; resume:Phase|null; }
export const freshExperience=():Experience=>({phase:'landing',draft:exampleDraft(),story:null,visited:[],branch:null,letterText:'',recipient:'past-self'});
export const initialState=():AppState=>({experience:freshExperience(),collection:[],resume:null});
const phases:Phase[]=['landing','memory-room','template-select','memory-input','memory-confirm','transition-in','exploration','decision','real-branch','imagined-branch','letter','transition-out','return-room','collection'];
export function loadState():AppState {
  try {
    const raw=localStorage.getItem('memorybox-v1');if(!raw)return initialState();
    const s=JSON.parse(raw) as AppState;
    if(!s.experience||!phases.includes(s.experience.phase)||!Array.isArray(s.collection)||!s.experience.draft||!Array.isArray(s.experience.visited))return initialState();
    if(s.experience.phase==='transition-in')s.experience.phase='exploration';
    if(s.experience.phase==='transition-out')s.experience.phase='return-room';
    if(!s.experience.story&&['exploration','decision','real-branch','imagined-branch','letter'].includes(s.experience.phase))s.experience.phase='memory-input';
    return s;
  }catch{return initialState();}
}
type Action = {type:'phase';phase:Phase}|{type:'draft';draft:Draft}|{type:'story';story:Story}|{type:'visit';id:AnchorId}|{type:'branch';branch:Branch}|{type:'letter';text:string;recipient?:string}|{type:'memory-id';id:string}|{type:'saved';entry:CollectionEntry}|{type:'collection';entries:CollectionEntry[];authoritative?:boolean}|{type:'delete';memoryId?:string;id:string;clearCurrent?:boolean}|{type:'exit'}|{type:'resume'}|{type:'restart'}|{type:'clear'}|{type:'reopen';entry:CollectionEntry};
export function reducer(state:AppState,action:Action):AppState {
  const e=state.experience;
  switch(action.type){
    case 'phase': if(action.phase==='decision'&&e.visited.length<3)return state; return {...state,experience:{...e,phase:action.phase}};
    case 'draft':return {...state,experience:{...e,draft:action.draft,story:null,memoryId:undefined}};
    case 'story':return {...state,experience:{...e,story:action.story,...(e.phase==='memory-input'?{visited:[],branch:null,letterText:'',memoryId:undefined}: {})}};
    case 'visit':return e.phase!=='exploration'?state:{...state,experience:{...e,visited:e.visited.includes(action.id)?e.visited:[...e.visited,action.id]}};
    case 'branch':return e.visited.length<3?state:{...state,experience:{...e,branch:action.branch,phase:action.branch==='real'?'real-branch':'imagined-branch'}};
    case 'letter':return {...state,experience:{...e,letterText:action.text,recipient:action.recipient||e.recipient}};
    case 'memory-id':return {...state,experience:{...e,memoryId:action.id}};
    case 'saved':return {...state,collection:[action.entry,...state.collection.filter(x=>x.id!==action.entry.id)],experience:{...e,phase:'transition-out'},resume:null};
    case 'collection':return {...state,collection:[...action.entries,...state.collection.filter(x=>(!action.authoritative||!x.synced)&&!action.entries.some(y=>y.id===x.id||(y.clientId&&y.clientId===(x.clientId||x.id))))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
    case 'delete':return {...state,collection:state.collection.filter(x=>action.memoryId?x.memoryId!==action.memoryId:x.id!==action.id),...((action.clearCurrent||(action.memoryId&&e.memoryId===action.memoryId))?{experience:{...freshExperience(),phase:'collection'},resume:null}: {})};
    case 'exit':return {...state,resume:['landing','memory-room','collection','return-room'].includes(e.phase)?state.resume:e.phase,experience:{...e,phase:'memory-room'}};
    case 'resume':return {...state,experience:{...e,phase:state.resume||'template-select'},resume:null};
    case 'restart':return {...state,experience:{...freshExperience(),phase:'template-select'},resume:null};
    case 'clear':return initialState();
    case 'reopen':return {...state,experience:{phase:'letter',draft:action.entry.draft,story:action.entry.story,visited:['tv','doll','photo'],branch:action.entry.branch,letterText:action.entry.text,recipient:action.entry.recipient,memoryId:action.entry.memoryId}};
  }
}
