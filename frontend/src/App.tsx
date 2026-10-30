import { Component, Suspense, lazy, useEffect, useReducer, useRef, useState } from 'react';
import type { ErrorInfo, FormEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Box, Check, ChevronRight, Flower2, Home, Leaf, LoaderCircle, Mail, Maximize2, MousePointer2, RotateCcw, Send, Sparkles, TrainFront, Trash2, Volume2, VolumeX, X, Users, Eye, PersonStanding, Settings2, LayoutGrid, ChevronUp, ChevronDown, ChevronLeft } from 'lucide-react';
import type { AnchorId, CollectionEntry, Draft, Phase, CharacterPreset, NavigationMode, RoomZone } from './types';
import { getAnchorLabels, getAnchorSubtitles, composeLocal, defaultLetter, exampleDraft, templates } from './data';
import { loadState, reducer } from './store';
import * as api from './api';
import { chime, setSound } from './audio';
import WorldMap from './WorldMap';
import StoryPlayback from './StoryPlayback';

const portable=location.protocol==='file:';
const Scene = lazy(()=>import('./scenes/Scene'));
const journeyPhases:Phase[]=['transition-in','exploration','decision','real-branch','imagined-branch','letter','transition-out'];
const anchors:AnchorId[]=['tv','doll','photo'];
const companions:{id:CharacterPreset;label:string;description:string;initial:string}[]=[
  {id:'young-man',label:'青年男性',description:'约 25 岁 · 翻领衬衣与牛仔裤',initial:'青'},
  {id:'elder-man',label:'长者男性',description:'约 68 岁 · 灰发、衬衣与细框眼镜',initial:'长'},
  {id:'young-woman',label:'青年女性',description:'约 25 岁 · 衬衫、裙装与马尾',initial:'青'},
  {id:'elder-woman',label:'长者女性',description:'约 68 岁 · 银发、眼镜与日常便装',initial:'长'},
];
const zoneLabels:Record<RoomZone,string>={living:'客厅',kitchen:'厨房',balcony:'阳台',bedroom:'卧室',study:'书房',concourse:'候车大厅',platform:'站台',carriage:'车厢',classroom:'教室',corridor:'走廊'};

class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('MemoryBox 3D rendering error',error,info);}
  render(){return this.state.failed?<div className="scene-error"><Box size={44}/><h2>3D 房间暂时没有打开</h2><p>请启用浏览器硬件加速，或在 Chrome / Edge 中重试。你的文字草稿仍保存在本机。</p><button className="primary" onClick={()=>location.reload()}>重新打开房间 <RotateCcw size={17}/></button></div>:this.props.children;}
}

function App(){
  const [state,dispatch]=useReducer(reducer,undefined,loadState);
  const e=state.experience;
  const anchorLabels=getAnchorLabels(e.draft.templateId),anchorSubtitles=getAnchorSubtitles(e.draft.templateId);
  const [backend,setBackend]=useState<'checking'|'online'|'offline'>('checking');
  const [selected,setSelected]=useState<AnchorId|null>(null);
  const [hint,setHint]=useState(false);
  const [resetKey,setResetKey]=useState(0);
  const [sound,setSoundState]=useState(false);
  const [largeText,setLargeText]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [letterOpen,setLetterOpen]=useState<string|null>(null);
  const [sceneReady,setSceneReady]=useState(false);
  const [memoryReady,setMemoryReady]=useState(false),[passageRevealing,setPassageRevealing]=useState(false);
  const passageStart=useRef(0);
  const [viewMode,setViewMode]=useState<NavigationMode>(()=>{try{return ['overview','third-person'].includes(localStorage.getItem('memorybox-view-mode')||'')?localStorage.getItem('memorybox-view-mode') as NavigationMode:'walk';}catch{return 'walk';}});
  const [companion,setCompanion]=useState<CharacterPreset>(()=>{try{const saved=localStorage.getItem('memorybox-companion');return companions.some(c=>c.id===saved)?saved as CharacterPreset:'elder-woman';}catch{return 'elder-woman';}});
  const [characterPicker,setCharacterPicker]=useState(false);
  const [characterTarget,setCharacterTarget]=useState<'companion'|'self'>('companion');
  const [playerAvatar,setPlayerAvatar]=useState<CharacterPreset>(()=>{try{const id=localStorage.getItem('memorybox-player-avatar');return companions.some(c=>c.id===id)?id as CharacterPreset:'young-man';}catch{return 'young-man';}});
  const [zone,setZone]=useState<RoomZone>('living');
  const [moveIntent,setMoveIntent]=useState({forward:0,right:0});
  const [storageWarning,setStorageWarning]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const storyClock=useRef({time:0,playing:true,revision:0});
  const storyEvent=useRef('');
  const memoryWorld=journeyPhases.includes(e.phase);
  const activeTemplate=templates.find(t=>t.id===e.draft.templateId)!;

  useEffect(()=>{
    try{localStorage.setItem('memorybox-v1',JSON.stringify(state));}catch{setStorageWarning(true);}
  },[state]);
  useEffect(()=>{
    let alive=true;
    const check=async()=>{try{await api.health();if(alive)setBackend('online');}catch{if(alive)setBackend('offline');}};
    void check();
    void api.fetchCollection().then(entries=>{if(alive)dispatch({type:'collection',entries,authoritative:true});}).catch(()=>{});
    const timer=setInterval(check,20000);
    return ()=>{alive=false;clearInterval(timer);};
  },[]);
  useEffect(()=>{
    if(e.phase!=='transition-in'&&e.phase!=='transition-out')return;
    const next=e.phase==='transition-in'?'exploration':'return-room';
    if(e.phase==='transition-in'&&!memoryReady)return;
    if(reducedMotion||e.phase==='transition-out'){
      const timer=setTimeout(()=>dispatch({type:'phase',phase:next}),reducedMotion?250:2400);
      return()=>clearTimeout(timer);
    }
    let finish:ReturnType<typeof setTimeout>|undefined;
    const begin=setTimeout(()=>{setPassageRevealing(true);finish=setTimeout(()=>dispatch({type:'phase',phase:'exploration'}),2400);},Math.max(0,3200-(performance.now()-passageStart.current)));
    return()=>{clearTimeout(begin);if(finish)clearTimeout(finish);};
  },[e.phase,reducedMotion,memoryReady]);
  useEffect(()=>{setSelected(null);},[e.phase]);
  useEffect(()=>{try{localStorage.setItem('memorybox-companion',companion);}catch{/* Keep working when storage is unavailable. */}},[companion]);
  useEffect(()=>{try{localStorage.setItem('memorybox-player-avatar',playerAvatar);}catch{/* The selected avatar still works in this session. */}},[playerAvatar]);
  useEffect(()=>{try{localStorage.setItem('memorybox-view-mode',viewMode);}catch{/* The current view remains usable without persistent preferences. */}},[viewMode]);
  useEffect(()=>{if(e.phase!=='exploration'){setCharacterPicker(false);setMoveIntent({forward:0,right:0});}},[e.phase]);
  useEffect(()=>{
    const branch=e.phase==='real-branch'||e.phase==='imagined-branch';
    const key=branch?`${e.draft.templateId}:${e.branch}`:e.phase==='exploration'?'exploration':'';
    if(branch||(key&&key!==storyEvent.current))storyClock.current={time:0,playing:true,revision:storyClock.current.revision+1};
    storyEvent.current=key;
  },[e.phase,e.branch,e.draft.templateId]);
  useEffect(()=>{
    const release=()=>setMoveIntent({forward:0,right:0});window.addEventListener('pointerup',release);window.addEventListener('blur',release);
    return()=>{window.removeEventListener('pointerup',release);window.removeEventListener('blur',release);};
  },[]);

  const go=(phase:Phase)=>{chime();dispatch({type:'phase',phase});};
  const visit=(id:AnchorId)=>{if(e.phase!=='exploration')return;storyClock.current={time:0,playing:true,revision:storyClock.current.revision+1};dispatch({type:'visit',id});setSelected(id);chime();};
  const toggleSound=()=>{try{setSound(!sound);setSoundState(!sound);}catch{setNotice('浏览器暂时无法播放声音，可以继续安静地体验。');}};
  const openCollection=()=>{if(!['landing','memory-room','return-room','collection'].includes(e.phase))dispatch({type:'exit'});go('collection');};

  async function confirmDraft(event:FormEvent){
    event.preventDefault();setBusy(true);
    let story=composeLocal(e.draft);
    try{story=await api.compose(e.draft);setBackend('online');}catch{setBackend('offline');}
    dispatch({type:'story',story});go('memory-confirm');setBusy(false);
  }
  async function enterMemory(){
    if(busy||!e.story)return;setBusy(true);
    try{const memory=await api.createMemory(e.draft,e.story);dispatch({type:'memory-id',id:memory.id});dispatch({type:'story',story:memory.story});setBackend('online');}
    catch{setBackend('offline');setNotice(portable?'已进入离线体验。草稿与信件只保存在当前浏览器。':'已进入离线演示模式。草稿与信件会保存在此浏览器，可以稍后同步。');}
    setMemoryReady(false);setPassageRevealing(false);passageStart.current=performance.now();
    setViewMode('walk');setZone(e.draft.templateId==='station'?'concourse':e.draft.templateId==='classroom'?'classroom':'living');go('transition-in');setBusy(false);
  }
  function startLetter(){
    if(!e.letterText)dispatch({type:'letter',text:defaultLetter(e.draft,e.recipient)});
    go('letter');
  }
  async function sendLetter(event:FormEvent){
    event.preventDefault();if(busy||!e.story||!e.branch||!e.letterText.trim())return;
    setBusy(true);
    const clientId=crypto.randomUUID();
    const entry:CollectionEntry={id:clientId,clientId,memoryId:e.memoryId,title:e.story.title,draft:e.draft,story:e.story,branch:e.branch,recipient:e.recipient,text:e.letterText.trim(),createdAt:new Date().toISOString(),synced:false};
    try{
      const id=e.memoryId||(await api.createMemory(e.draft,e.story,clientId)).id;
      entry.memoryId=id;
      const letter=await api.saveLetter(id,entry.recipient,entry.text,entry.branch,clientId);
      entry.id=letter.id;entry.memoryId=letter.memoryId||id;entry.createdAt=letter.createdAt;entry.synced=true;
      dispatch({type:'memory-id',id});setBackend('online');setNotice('信已保存到本机数据库，也留在了这只记忆盒子里。');
    }catch{setBackend('offline');setNotice(portable?'信已珍藏在当前浏览器，重新打开这份文件后仍可查看。':'信已保存在此浏览器。后端恢复后，在收藏中点击「同步到本机数据库」。');}
    dispatch({type:'saved',entry});chime();setBusy(false);
  }
  async function syncEntry(entry:CollectionEntry){
    if(busy)return;setBusy(true);
    try{const clientId=entry.clientId||entry.id;const memoryId=entry.memoryId||(await api.createMemory(entry.draft,entry.story,clientId)).id;const letter=await api.saveLetter(memoryId,entry.recipient,entry.text,entry.branch,clientId);dispatch({type:'collection',entries:[{...entry,clientId,id:letter.id,memoryId:letter.memoryId||memoryId,createdAt:letter.createdAt,synced:true}]});setBackend('online');setNotice('已同步到本机数据库。');}
    catch{setBackend('offline');setNotice('本机服务还没有恢复。信仍安全保存在当前浏览器，请稍后重试。');}finally{setBusy(false);}
  }
  async function removeEntry(entry:CollectionEntry){
    if(!confirm('删除这段回忆及其全部信件？此操作不能撤销。'))return;
    setBusy(true);
    try{if(entry.memoryId)await api.deleteMemory(entry.memoryId);dispatch({type:'delete',id:entry.id,memoryId:entry.memoryId,clearCurrent:!e.memoryId&&entry.text===e.letterText&&entry.draft.storyText===e.draft.storyText});setNotice('这段回忆和相关信件已删除。');}
    catch{setNotice('删除服务暂不可用，尚未删除任何内容。请恢复后端后重试。');}finally{setBusy(false);}
  }
  function editDraft(key:keyof Draft,value:string){dispatch({type:'draft',draft:{...e.draft,[key]:value}});}
  const modalBack=()=>{if(e.phase==='template-select')go('memory-room');if(e.phase==='memory-input')go('template-select');if(e.phase==='memory-confirm')go('memory-input');if(e.phase==='decision')go('exploration');if(e.phase==='letter')go(e.branch==='imagined'?'imagined-branch':'real-branch');if(e.phase==='collection')go('memory-room');};
  const isPanel=['template-select','memory-input','memory-confirm','decision','letter','collection'].includes(e.phase);

  return <main className={`app phase-${e.phase} ${memoryWorld?'in-memory':''} ${reducedMotion?'reduced-motion':''} ${largeText?'large-type':''} ${memoryWorld?`mode-${viewMode}`:''}`} data-phase={e.phase} data-template={e.draft.templateId}>
    <div className="scene-layer" aria-label={memoryWorld?'可以行走探索的三维记忆房间':'可以拖动旋转的三维现实桌面'}>
      <SceneBoundary><Suspense fallback={<div className="scene-loader"><Box size={32}/><span>把阳光放进房间…</span></div>}>
        <Scene templateId={e.draft.templateId} world={memoryWorld?'memory':'present'} phase={e.phase} visited={e.visited} selected={selected} branch={e.branch} storyClock={storyClock} realDeparture={e.draft.actualChoice===exampleDraft(e.draft.templateId).actualChoice} collected={state.collection.length>0} hint={hint} resetKey={resetKey} reducedMotion={reducedMotion} viewMode={viewMode} companion={companion} playerAvatar={playerAvatar} previewPlayer={characterPicker&&characterTarget==='self'} characterPreview={characterPicker} navigationPaused={characterPicker||busy||isPanel} moveIntent={moveIntent} onZoneChange={setZone} onAnchor={visit} onBox={()=>{if(e.phase==='landing')go('memory-room');else if(['memory-room','return-room'].includes(e.phase))openCollection();}} onReady={()=>setSceneReady(true)} onWorldReady={()=>setMemoryReady(true)}/>
      </Suspense></SceneBoundary>
    </div>
    <div className="paper-grain" aria-hidden="true"/>
    <header className="header">
      <button className="brand" onClick={()=>{dispatch({type:'exit'});}} aria-label="MemoryBox 返回现实房间"><span className="brand-icon"><Box size={23} strokeWidth={1.2}/></span><span>MemoryBox<span className="brand-cn">记忆盒子</span></span></button>
      <div className="header-divider"/><span className="header-tagline">让回忆有一个可以回去的地方</span>
      <nav aria-label="主导航" className={settingsOpen?'settings-open':''}>
        <button className="nav-link header-function" aria-label="我的收藏" onClick={openCollection}><BookOpen size={19}/><span><strong>我的收藏</strong><small>珍藏的时光</small></span><span className="count">{String(state.collection.length).padStart(2,'0')}</span></button>
        <button className="header-function settings-toggle" aria-label="显示设置" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}><Settings2 size={19}/><span><strong>显示设置</strong><small>字号 · 声音 · 动效</small></span></button>
        <div className="display-preferences">
          <button className={`header-function text-size-toggle ${largeText?'active':''}`} onClick={()=>setLargeText(!largeText)} aria-label={largeText?'恢复标准字号':'放大文字'}><span className="type-icon">Aa</span><span><strong>{largeText?'标准字号':'放大文字'}</strong><small>展示可读性</small></span></button>
          <button className={`header-function ${sound?'active':''}`} onClick={toggleSound} aria-label={sound?'关闭声音':'开启声音'}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}<span><strong>{sound?'关闭声音':'开启声音'}</strong><small>交互音效</small></span></button>
          <button className={`header-function motion-toggle ${reducedMotion?'active':''}`} aria-label={reducedMotion?'开启动画':'减少动态效果'} onClick={()=>setReducedMotion(!reducedMotion)}><Leaf size={19}/><span><strong>{reducedMotion?'开启动画':'减少动态'}</strong><small>镜头与转场</small></span></button>
        </div>
        {memoryWorld||isPanel?<button className="exit-button header-function" aria-label="返回现实" onClick={()=>dispatch({type:'exit'})}><X size={18}/><span><strong>返回现实</strong><small>保留这次旅程</small></span></button>:null}
      </nav>
    </header>

    {e.phase==='landing'&&<>
      <section className="landing-copy fade-in">
        <div className="eyebrow"><span className="little-line"/>A PLACE TO RETURN</div>
        <h1>总有一些时光，<br/>想再<span className="handwritten">回去</span>看看。</h1>
        <p className="hero-description">那些普通的下午，熟悉的声音，<br/>还有没来得及说完的话。<br/>打开一只盒子，让回忆慢慢展开。</p>
        <button className="primary hero-button" onClick={()=>go('memory-room')}>打开记忆 <ArrowRight size={19}/></button>
        <div className="hero-meta"><span>约 5 分钟的回忆之旅</span><i/>无需登录 · 无需 API Key</div>
      </section>
      <div className="scene-caption"><span className="caption-dot"/><span>此刻 · 你的记忆房间</span><span className="caption-coordinates">31° N · A QUIET AFTERNOON</span></div>
      <div className="hero-bottom"><span className="vertical-number">01 / 03</span><span>有些日子，值得被轻轻收藏。</span><span className="drag-note"><MousePointer2 size={14}/> 拖动木盒周围，换个角度看看</span></div>
    </>}

    {e.phase==='memory-room'&&<section className="room-copy fade-in"><div className="eyebrow">THE MEMORY ROOM / 此刻</div><h1>回忆有了<br/>可以安放的地方。</h1><p>一只木盒，一束午后的光。<br/>你带回来的每一段时光，都会留在这里。</p>{state.resume&&<button className="primary" onClick={()=>dispatch({type:'resume'})}>继续未完成的旅程 <ArrowRight size={18}/></button>}<button className={state.resume?'text-button':'primary'} onClick={()=>{dispatch({type:'restart'});}}>挑选一段记忆 <ArrowRight size={18}/></button>{state.collection.length>0&&<button className="text-button" onClick={openCollection}>打开记忆盒子 · {state.collection.length} 封信 <ChevronRight size={16}/></button>}<span className="small-note">文字只保存到此浏览器与本机服务。</span></section>}

    {isPanel&&<div className={`modal-scrim ${e.phase==='decision'?'soft-scrim':''}`}>
      <section className={`paper-panel panel-${e.phase} fade-in`} aria-label={e.phase==='letter'?'信件编辑器':'记忆旅程'}>
        <div className="panel-top"><button className="back-link" onClick={modalBack}><ArrowLeft size={16}/>{e.phase==='collection'?'回到房间':'上一步'}</button><span className="eyebrow">{e.phase==='template-select'?'01 / CHOOSE A MEMORY':e.phase==='memory-input'?'02 / TELL YOUR STORY':e.phase==='memory-confirm'?'03 / BEFORE WE GO':e.phase==='decision'?'A MOMENT TO CHOOSE':e.phase==='letter'?'A LETTER TO KEEP':'YOUR LITTLE ARCHIVE'}</span><span className="panel-flower"><Flower2 size={20} strokeWidth={1}/></span></div>

        {e.phase==='template-select'&&<><div className="panel-heading"><p className="overline">从一个熟悉的地方开始</p><h2>你想回到哪段时光？</h2><p>先选一种故事，再把属于你的细节放进去。</p></div><div className="template-grid">{templates.map(t=><button key={t.id} className={`template-card template-${t.id} ${e.draft.templateId===t.id?'chosen':''}`} onClick={()=>dispatch({type:'draft',draft:exampleDraft(t.id)})} aria-pressed={e.draft.templateId===t.id}><div className="template-art"><span className="template-number">{t.number}</span>{t.id==='old-home'?<Home size={64} strokeWidth={.8}/>:t.id==='station'?<TrainFront size={64} strokeWidth={.8}/>:<BookOpen size={64} strokeWidth={.8}/>}<span className="template-art-line"/><span className="selection-circle">{e.draft.templateId===t.id?<Check size={14}/>:null}</span></div><div className="template-content"><span className="template-en">{t.en}</span><h3>{t.name}</h3><span className="template-theme">{t.theme}</span><p>{t.description}</p><span className="template-detail">{t.detail}</span></div></button>)}</div><div className="panel-footer"><span><Sparkles size={14}/> 预置故事模板 · 你随时可以修改</span><button className="primary" onClick={()=>go('memory-input')}>选好了，继续 <ArrowRight size={17}/></button></div></>}

        {e.phase==='memory-input'&&<><div className="panel-heading compact"><p className="overline">{activeTemplate.name}</p><h2>把那一天，讲给盒子听。</h2><p>不必记得所有细节，几个熟悉的瞬间就够了。</p></div><form onSubmit={confirmDraft}><div className="interview-heading"><span><span className="mini-dot"/> 只整理你确认的事实</span><button type="button" className="sample-button" onClick={()=>{dispatch({type:'draft',draft:exampleDraft(e.draft.templateId)});setNotice('已填入虚构的演示故事，你可以自由修改。');}}><Sparkles size={14}/> 用示例故事体验</button></div><div className="form-grid"><label>那是哪一年？<input name="year" value={e.draft.year} onChange={ev=>editDraft('year',ev.target.value)} placeholder="例如：2005" required maxLength={12}/></label><label>你想回到哪里？<input name="place" value={e.draft.place} onChange={ev=>editDraft('place',ev.target.value)} placeholder="例如：奶奶家的客厅" required maxLength={100}/></label><label>记忆里重要的人<input name="importantPerson" value={e.draft.importantPerson} onChange={ev=>editDraft('importantPerson',ev.target.value)} required maxLength={60}/></label><label>想珍藏的一件物品<input name="importantObject" value={e.draft.importantObject} onChange={ev=>editDraft('importantObject',ev.target.value)} required maxLength={100}/></label><label className="full-width">那一天，发生了什么？<textarea name="storyText" value={e.draft.storyText} onChange={ev=>editDraft('storyText',ev.target.value)} rows={3} required minLength={3} maxLength={4000}/></label><label className="full-width">当时，你做了怎样的选择？<input name="actualChoice" value={e.draft.actualChoice} onChange={ev=>editDraft('actualChoice',ev.target.value)} required maxLength={500}/></label></div><div className="panel-footer"><span>演示房间采用绘本场景，不上传照片。</span><button className="primary" disabled={busy||Object.values(e.draft).some(v=>!v.trim())}>{busy?<LoaderCircle size={17} className="spin"/>:null}整理这段记忆 <ArrowRight size={17}/></button></div></form></>}

        {e.phase==='memory-confirm'&&e.story&&<><div className="panel-heading"><p className="overline">在出发之前</p><h2>这是你想珍藏的那一天。</h2><p>确认下面的事实，我们就轻轻推开那扇门。</p></div><div className="confirmation-card"><div className="confirmation-year">{e.draft.year}<span>那年 · 那一天</span></div><div className="confirmation-details"><h3>{e.draft.place}</h3><p>与 {e.draft.importantPerson} · {e.draft.importantObject}</p><blockquote>{e.draft.storyText}</blockquote><span>你当年的选择</span><p>{e.draft.actualChoice}</p></div></div><div className="fact-note"><Leaf size={18}/><p><strong>记忆的事实，由你确认。</strong>另一条路线会明确标为「AI 想象 · 并非真实历史」。场景与角色为模板布景，不是对真实人物和住处的精确复原。</p></div><div className="panel-footer"><span>模板叙事 · 无实时 AI 调用</span><button className="primary" disabled={busy} onClick={()=>void enterMemory()}>{busy?<LoaderCircle className="spin" size={17}/>:<Box size={17}/>}走进那一天 <ArrowRight size={17}/></button></div></>}

        {e.phase==='decision'&&e.story&&<><div className="panel-heading"><p className="overline">回忆走到了这一刻</p><h2>让记忆，再停留一会儿。</h2><p>{e.story.decision.question}</p></div><div className="branch-options"><button className="branch-option real-option" onClick={()=>{dispatch({type:'branch',branch:'real'});chime();}}><span className="branch-icon"><Home size={28} strokeWidth={1}/></span><span className="overline">THE WAY IT WAS</span><h3>重温真实路线</h3><p>沿着你确认的记忆，<br/>再走一遍那时的选择。</p><span className="branch-bottom">你确认的真实回忆 <ArrowRight size={17}/></span></button><button className="branch-option imagined-option" onClick={()=>{dispatch({type:'branch',branch:'imagined'});chime();}}><span className="branch-icon"><Sparkles size={28} strokeWidth={1}/></span><span className="overline">WHAT IF WE STAYED</span><h3>{e.story.decision.imagined.label}</h3><p>给那时的自己，<br/>留一点想象的自由。</p><span className="branch-bottom">AI 想象 · 并非真实历史 <ArrowRight size={17}/></span></button></div><p className="gentle-note">没有更好的答案，只有另一种看见。你可以回来重新选择。</p></>}

        {e.phase==='letter'&&<form onSubmit={sendLetter}><div className="letter-heading"><span className="postmark">MEMORYBOX<br/><i>{e.draft.year}</i><br/>时光邮局</span><p className="overline">有些话，现在说也来得及</p><h2>写一封，穿过时光的信。</h2></div><label className="recipient-label">收信人<select value={e.recipient} onChange={ev=>dispatch({type:'letter',text:e.letterText,recipient:ev.target.value})}><option value="past-self">小时候的自己</option><option value="important-person">{e.draft.importantPerson}</option><option value="future-self">未来的自己</option></select></label><label className="letter-label">信的内容<textarea aria-label="信的内容" className="letter-paper" value={e.letterText} maxLength={6000} required rows={9} onChange={ev=>dispatch({type:'letter',text:ev.target.value})}/></label><div className="letter-bottom"><span>{e.letterText.length} / 6000 字</span><button type="button" className="text-button" onClick={()=>dispatch({type:'letter',text:defaultLetter(e.draft,e.recipient)})}>填入参考文字</button></div><div className="panel-footer"><span><Mail size={15}/> 只珍藏在本机，不向任何人发送</span><button className="primary" disabled={busy||!e.letterText.trim()}>{busy?<LoaderCircle className="spin" size={17}/>:<Send size={16}/>}封好信，回到现在</button></div></form>}

        {e.phase==='collection'&&<><div className="panel-heading compact"><p className="overline">打开盒子，也打开时间</p><h2>你珍藏的，都会在这里。</h2><p>{state.collection.length>0?`${state.collection.length} 封信，${new Set(state.collection.map(x=>x.memoryId||x.id)).size} 段被认真保存的回忆。`:'盒子还是空的，去带一段回忆回来吧。'}</p></div>{state.collection.length===0?<div className="empty-collection"><Mail size={48} strokeWidth={.8}/><p>给过去的自己，留一个位置。</p><button className="primary" onClick={()=>dispatch({type:'restart'})}>开始一段记忆 <ArrowRight size={16}/></button></div>:<div className="collection-list">{state.collection.map(entry=><article className="collection-entry" key={entry.id}><button className="collection-envelope" onClick={()=>setLetterOpen(letterOpen===entry.id?null:entry.id)} aria-label={`查看信件 ${entry.title}`}><Mail size={31} strokeWidth={1}/><span>{entry.draft.year}</span></button><div className="collection-entry-body"><span className="overline">{entry.branch==='imagined'?'AI 想象 · 并非真实历史':'你确认的真实记忆'}</span><h3>{entry.title}</h3><p>{new Date(entry.createdAt).toLocaleDateString('zh-CN')} · 写给{entry.recipient==='past-self'?'小时候的自己':entry.recipient==='future-self'?'未来的自己':entry.draft.importantPerson}</p><span className={`save-status ${entry.synced?'saved':''}`}><span className="mini-dot"/>{entry.synced?'已存入本机数据库':'仅保存在此浏览器'}</span><div className="collection-actions"><button className="text-button" onClick={()=>setLetterOpen(letterOpen===entry.id?null:entry.id)}>{letterOpen===entry.id?'收起信件':'打开信件'} <ChevronRight size={14}/></button><button className="text-button" onClick={()=>dispatch({type:'reopen',entry})}>重写 / 再选分支</button>{!portable&&!entry.synced&&<button className="text-button" disabled={busy} onClick={()=>void syncEntry(entry)}>同步到本机数据库</button>}<button className="icon-button delete-button" aria-label={`删除回忆 ${entry.title}`} disabled={busy} onClick={()=>void removeEntry(entry)}><Trash2 size={15}/></button></div>{letterOpen===entry.id&&<blockquote className="saved-letter">{entry.text}</blockquote>}</div></article>)}</div>}<div className="panel-footer"><span>这些文字不会自动公开或上传给 AI。</span><button className="primary" onClick={()=>dispatch({type:'restart'})}>再收藏一段时光 <ArrowRight size={16}/></button></div></>}
      </section>
    </div>}

    {e.phase==='exploration'&&<>
      <div className="journey-title fade-in"><span className="eyebrow">CHAPTER 01 / {e.draft.year} · 记忆片段</span><h2>{e.draft.place}</h2><p>有些日子，当时觉得再普通不过。</p><span className="scene-location-note">{e.draft.templateId==='old-home'?'客厅 · 厨房 · 阳台 · 卧室 · 书房':e.draft.templateId==='station'?'候车大厅 · 站台 · 可进入车厢':'教室 · 阳光走廊'}</span></div>
      <div className="scene-tools"><button className="tool-button" onClick={()=>{setSelected(null);setResetKey(k=>k+1);}} aria-label="重置视角"><Maximize2 size={16}/><span>重置视角</span></button><button className={`tool-button ${hint?'active':''}`} aria-label={hint ? "收起提示" : "寻找线索"} onClick={()=>setHint(!hint)}><Sparkles size={16}/><span>{hint?'收起提示':'寻找线索'}</span></button></div>
      {selected?<section className="anchor-story fade-in" aria-live="polite"><div className="anchor-story-top"><span className="overline">{String(anchors.indexOf(selected)+1).padStart(2,'0')} / 记忆碎片</span><button className="icon-button" aria-label="关闭物品故事" onClick={()=>setSelected(null)}><X size={17}/></button></div><h2>{anchorSubtitles[selected]}</h2><p>{e.story?.anchors.find(a=>a.id===selected)?.narration}</p>{selected==='tv'&&e.draft.templateId==='old-home'&&<StoryPlayback compact clock={storyClock} template={e.draft.templateId} branch={null} departure={false}/>}<button className="text-button" onClick={()=>setSelected(null)}>继续探索 <ArrowRight size={16}/></button></section>:<div className="explore-instruction"><MousePointer2 size={15}/><span>{viewMode!=="overview"?"WASD / 方向键移动 · 拖动环顾 · 轻触旧物":"拖动旋转 · 滚轮缩放 · 轻触发光的旧物"}</span></div>}
      <div className="exploration-footer"><div className="progress-copy"><span className="overline">PIECES OF A DAY</span><span>记忆碎片 <strong>{e.visited.length}<small> / 3</small></strong></span></div><div className="fragment-list">{anchors.map((a,i)=><button key={a} aria-label={`回看${anchorLabels[a]}`} className={`fragment ${e.visited.includes(a)?'found':''}`} onClick={()=>{if(e.visited.includes(a))visit(a);else setHint(true);}}><span>{e.visited.includes(a)?<Check size={14}/>:String(i+1).padStart(2,'0')}</span>{anchorLabels[a]}</button>)}</div><button className="primary decision-unlock" disabled={e.visited.length<3} onClick={()=>{setSelected(null);go('decision');}}>{e.visited.length<3?'找到三件旧物，回忆就会展开':'走到那扇门前'}<ArrowRight size={16}/></button></div>
    </>}

    {e.phase==='exploration'&&<>
      <div className="navigation-toolbar" aria-label="空间与人物设置">
        <button className={viewMode==='walk'?'current function-tile':'function-tile'} aria-label="第一人称" onClick={()=>{setSelected(null);setViewMode('walk');}} aria-pressed={viewMode==='walk'}><Eye size={20}/><span><strong>第一人称</strong><small>走进当年的自己</small></span></button>
        <button className={viewMode==='third-person'?'current function-tile':'function-tile'} aria-label="第三人称" onClick={()=>{setSelected(null);setViewMode('third-person');}} aria-pressed={viewMode==='third-person'}><PersonStanding size={20}/><span><strong>第三人称</strong><small>跟随角色行走</small></span></button>
        <button className={viewMode==='overview'?'current function-tile':'function-tile'} aria-label="房间总览" onClick={()=>{setSelected(null);setViewMode('overview');}} aria-pressed={viewMode==='overview'}><LayoutGrid size={20}/><span><strong>房间总览</strong><small>查看全部空间</small></span></button>
        <button className="function-tile" aria-label="切换人物" onClick={()=>{setSelected(null);setCharacterTarget('companion');setCharacterPicker(true);}}><Users size={20}/><span><strong>切换人物</strong><small>四类陪伴角色</small></span></button>
      </div>
      <div className="zone-indicator" aria-live="polite"><span className="mini-dot"/>正在{zoneLabels[zone]}<span>{zone==='living'?'熟悉的旧物，留在原来的位置':zone==='kitchen'?'门后，是生活曾经发出的声音':'走到窗边，让风吹进这段回忆'}</span></div>
      {viewMode!=='overview'&&!selected&&!characterPicker&&<div className="walk-controls" aria-label="触屏移动控制"><span>移动</span><div className="walk-dpad">{[{name:'向前移动',forward:1,right:0,icon:<ChevronUp size={20}/>,cls:'north'},{name:'向左移动',forward:0,right:-1,icon:<ChevronLeft size={20}/>,cls:'west'},{name:'向后移动',forward:-1,right:0,icon:<ChevronDown size={20}/>,cls:'south'},{name:'向右移动',forward:0,right:1,icon:<ChevronRight size={20}/>,cls:'east'}].map(dir=><button key={dir.cls} className={dir.cls} aria-label={dir.name} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setMoveIntent({forward:dir.forward,right:dir.right});}} onPointerUp={()=>setMoveIntent({forward:0,right:0})} onPointerCancel={()=>setMoveIntent({forward:0,right:0})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setMoveIntent({forward:dir.forward,right:dir.right});}}} onKeyUp={()=>setMoveIntent({forward:0,right:0})}>{dir.icon}</button>)}</div><small>WASD / 方向键</small></div>}
      {!selected&&!characterPicker&&<div className="room-minimap" aria-label={`空间平面示意，目前在${zoneLabels[zone]}`}><WorldMap templateId={e.draft.templateId} zone={zone}/><span>经过门口，走进另一处空间</span></div>}
      {characterPicker&&<div className="character-scrim"><section className="character-picker" role="dialog" aria-modal="true" aria-label={characterTarget==='self'?'选择自己的形象':'选择陪伴角色'}><div className="character-picker-heading"><div><span className="overline">FACES IN A MEMORY</span><h2>{characterTarget==='self'?'给那时的自己，一个身影。':'让熟悉的身影，陪你走一会儿。'}</h2></div><button className="icon-button" onClick={()=>setCharacterPicker(false)} aria-label="关闭人物设置"><X size={18}/></button></div><p>选择场景中的外观。记忆里的人是谁，仍以你的讲述为准。</p><div className="character-role-tabs"><button aria-pressed={characterTarget==='companion'} onClick={()=>setCharacterTarget('companion')}>陪伴角色</button><button aria-pressed={characterTarget==='self'} onClick={()=>{setCharacterTarget('self');setViewMode('third-person');}}>我的形象 · 第三人称</button></div><div className="character-grid">{companions.map(person=><button key={person.id} className={`character-choice ${(characterTarget==='self'?playerAvatar:companion)===person.id?'selected':''}`} onClick={()=>characterTarget==='self'?setPlayerAvatar(person.id):setCompanion(person.id)} aria-pressed={(characterTarget==='self'?playerAvatar:companion)===person.id}><span className={`character-silhouette ${person.id}`}><Users size={28} strokeWidth={1}/><span>{person.initial}</span></span><strong>{person.label}</strong><small>{person.description}</small><span className="character-check">{(characterTarget==='self'?playerAvatar:companion)===person.id?<Check size={15}/>:null}</span></button>)}</div><div className="character-picker-footer"><span>{characterTarget==='self'?'第三人称中的自己':'场景中的陪伴角色'} · 自然身形 · 行走与挥手</span><button className="primary" onClick={()=>setCharacterPicker(false)}>{characterTarget==='self'?'使用这个形象':'让这位陪伴我'} <ArrowRight size={16}/></button></div></section></div>}
    </>}

    {(e.phase==='real-branch'||e.phase==='imagined-branch')&&e.story&&<>
      <div className={`branch-label ${e.branch==='imagined'?'imagined':''}`}>{e.branch==='imagined'?<Sparkles size={15}/>:<Check size={15}/>}<span>{e.branch==='imagined'?'AI 想象 · 并非真实历史':'你确认的真实记忆'}</span></div>
      <section className="branch-story fade-in"><span className="eyebrow">{e.branch==='real'?'THE WAY IT WAS':'ANOTHER LITTLE POSSIBILITY'}</span><h2>{e.branch==='real'?'让那一天，保持你记得的样子。':e.draft.templateId==='station'?'出发之前，再认真告别一次。':e.draft.templateId==='classroom'?'让那句谢谢，终于被听见。':'你决定，把告别放慢一点。'}</h2><StoryPlayback clock={storyClock} template={e.draft.templateId} branch={e.branch} departure={e.draft.actualChoice===exampleDraft(e.draft.templateId).actualChoice} lines={e.story.decision[e.branch||'real'].script}/><div className="branch-story-actions"><button className="text-button" onClick={()=>go('decision')}><RotateCcw size={15}/> 重新选择</button><button className="primary" onClick={startLetter}>写一封信 <ArrowRight size={16}/></button></div></section>
      <div className="branch-scene-caption">{e.branch==='imagined'?(e.draft.templateId==='station'?'列车仍将出发，而告别可以不那么匆忙。':e.draft.templateId==='classroom'?'纸条还在桌上，而那句谢谢终于说出了口。':'灯亮了。桌边多了一杯茶，那个下午被轻轻延长。'):'你确认的那一刻，被轻轻保留。'}</div>
    </>}

    {e.phase==='return-room'&&<section className="return-copy fade-in"><div className="eyebrow">WELCOME BACK / 回到此刻</div><h1>回忆无法重来，<br/>但爱可以被<br/><span className="handwritten">重新看见。</span></h1><p>你回到了同一张桌子前。<br/>盒子里，多了一只布娃娃、一张回忆卡，<br/>还有你刚刚写下的那封信。</p><button className="primary" onClick={openCollection}>打开我的收藏 <BookOpen size={17}/></button><button className="text-button" onClick={()=>dispatch({type:'restart'})}>再走进一段回忆 <ArrowRight size={16}/></button></section>}

    {(e.phase==='transition-in'||e.phase==='transition-out')&&<div className={`transition-veil ${e.phase} ${passageRevealing?'revealing':''}`}><div><span className="transition-flower"><Flower2 size={38} strokeWidth={.7}/></span><p>{e.phase==='transition-in'?'把现在轻轻放下。':'把珍惜的，带回现在。'}</p><span>{e.phase==='transition-in'?`${e.draft.year} · ${e.draft.place}`:'同一张桌子，同一束光。'}</span><button disabled={e.phase==='transition-in'&&!memoryReady} onClick={()=>{if(e.phase==='transition-in'&&!memoryReady)return;go(e.phase==='transition-in'?'exploration':'return-room');}}>{e.phase==='transition-in'&&!memoryReady?'正在展开回忆':'跳过动画'} <ChevronRight size={14}/></button></div></div>}

    <footer className="status-bar"><span className={`connection ${backend}`}><span/>{backend==='online'?'本机服务已连接 · 模板体验':backend==='offline'?'离线演示模式 · 仅此浏览器保存':'正在连接本机服务…'}</span><span className="status-right">{memoryWorld?'现实 → 回忆 → 现实':'A STORY TO KEEP, A PLACE TO RETURN.'}</span>{!sceneReady&&<span className="loading-indicator"><LoaderCircle size={12} className="spin"/> 正在布置房间</span>}</footer>
    {(notice||storageWarning)&&<div className="toast" role="status"><span>{storageWarning?'浏览器存储空间不可用，请保持此页面打开，并连接本机后端保存。':notice}</span><button className="icon-button" onClick={()=>{setNotice('');setStorageWarning(false);}} aria-label="关闭提示"><X size={15}/></button></div>}
  </main>;
}
export default App;
