import {test,expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';

type Template='old-home'|'station'|'classroom';
type V3=[number,number,number];
interface Observation {phase:string;time:number;action:string;position:string;tvFrame:number;trainOffset:number;signal:string;door:number;note:string;noteFocus:number}
type ObservedWindow=Window&{__presentationV4?:{ticks:number;samples:Observation[]}};
const canvas=(page:Page)=>page.locator('canvas');
const pageErrors=new WeakMap<Page,string[]>();
const distance=(a:V3,b:V3)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
async function metric(page:Page,name:string){const raw=await canvas(page).getAttribute(`data-${name}`);if(raw===null||!Number.isFinite(Number(raw)))throw new Error(`Missing numeric canvas observation: ${name}=${raw}`);return Number(raw);}
async function position(page:Page,who:'player'|'companion'='player'):Promise<V3>{const raw=await canvas(page).getAttribute(`data-${who}-position`);if(!raw||raw.split(',').length!==3)throw new Error(`Missing ${who} world position`);return raw.split(',').map(Number) as V3;}
async function trainState(page:Page){return canvas(page).evaluate(el=>{const d=(el as HTMLCanvasElement).dataset;return {offset:Number(d.trainOffset),angle:Number(d.trainWheelAngle),time:Number(d.storyTime)};});}
async function phase(page:Page,value:string){await expect(page.locator('main')).toHaveAttribute('data-phase',value,{timeout:value==='exploration'?90_000:20_000});}
async function input(page:Page,template:Template='old-home',custom=false){
  await page.goto('/');
  await page.getByRole('button',{name:'打开记忆',exact:true}).click();
  await page.getByRole('button',{name:'挑选一段记忆',exact:true}).click();
  if(template!=='old-home')await page.getByRole('button',{name:template==='station'?/那年，我们选择远方/:/青春里没说出口的话/}).click();
  await page.getByRole('button',{name:'选好了，继续',exact:true}).click();await phase(page,'memory-input');
  if(custom){
    // Every field belongs to the same supplied memory, avoiding accidental use
    // of an example's person/place as evidence of a fabricated event.
    for(const [name,value]of Object.entries({year:'2018',place:'家里的客厅',importantPerson:'姐姐',importantObject:'一只蓝色茶杯',storyText:'周末下午，我和姐姐在客厅安静地喝茶。',actualChoice:'我决定留在客厅继续喝茶，没有离开。'}))await page.locator(`[name="${name}"]`).fill(value);
  }
}
async function enter(page:Page,template:Template='old-home',custom=false){
  await input(page,template,custom);
  await page.getByRole('button',{name:'整理这段记忆',exact:true}).click();await phase(page,'memory-confirm');
  await page.getByRole('button',{name:'走进那一天',exact:true}).click();await phase(page,'exploration');
  await expect(canvas(page)).toHaveAttribute('data-world','memory');
  await expect(canvas(page)).toHaveAttribute('data-scene-template',template);
  await expect(canvas(page)).toHaveAttribute('data-companion-ready','true',{timeout:90_000});
  await expect(canvas(page)).toHaveAttribute('data-navigation-paused','false');
}
async function overview(page:Page){await page.getByRole('button',{name:'房间总览',exact:true}).click();await expect(canvas(page)).toHaveAttribute('data-navigation-mode','overview');}
async function collect(page:Page){
  await overview(page);
  for(const id of ['tv','doll','photo']){await page.getByTestId(`anchor-${id}`).click();await expect(page.locator('.anchor-story')).toBeVisible();await page.getByRole('button',{name:'继续探索',exact:true}).click();}
}
async function choose(page:Page,branch:'real'|'imagined'){
  if(await page.locator('main').getAttribute('data-phase')==='exploration')await page.getByRole('button',{name:'走到那扇门前',exact:true}).click();
  await phase(page,'decision');await page.locator(branch==='real'?'.real-option':'.imagined-option').click();await phase(page,`${branch}-branch`);
}
async function observe(page:Page){
  await page.evaluate(()=>{
    const state={ticks:0,samples:[] as Observation[]};(window as ObservedWindow).__presentationV4=state;
    const sample=()=>{
      if((window as ObservedWindow).__presentationV4!==state)return;
      state.ticks++;const data=document.querySelector('canvas')?.dataset;
      if(data&&state.samples.length<6000)state.samples.push({phase:document.querySelector('main')?.getAttribute('data-phase')||'',time:Number(data.storyTime),action:data.companionAction||'',position:data.companionPosition||'',tvFrame:Number(data.tvFrame),trainOffset:Number(data.trainOffset),signal:data.trainSignal||'',door:Number(data.trainDoor),note:data.noteStatus||'',noteFocus:Number(data.noteFocus)});
      requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
  });
}
async function observations(page:Page){return page.evaluate(()=>(window as ObservedWindow).__presentationV4?.samples||[]);}
async function renderedFrames(page:Page,count=3){const before=await page.evaluate(()=>(window as ObservedWindow).__presentationV4?.ticks||0);await expect.poll(()=>page.evaluate(()=>(window as ObservedWindow).__presentationV4?.ticks||0),{timeout:45_000,intervals:[150]}).toBeGreaterThanOrEqual(before+count);}
async function pause(page:Page){await page.getByRole('button',{name:'暂停剧情',exact:true}).click();await expect(canvas(page)).toHaveAttribute('data-story-playing','false');}
async function walk(page:Page,key:string,predicate:(p:V3)=>boolean){
  await page.keyboard.down(key);
  try{await expect.poll(async()=>predicate(await position(page)),{timeout:60_000,intervals:[100]}).toBe(true);}finally{await page.keyboard.up(key);}
  await expect(canvas(page)).toHaveAttribute('data-player-motion','idle',{timeout:30_000});
}
async function attachObservations(page:Page,testInfo:TestInfo){const samples=await observations(page).catch(()=>[]);if(samples.length)await testInfo.attach('observed-scene-events',{body:JSON.stringify(samples,null,2),contentType:'application/json'});}
async function screenshot(page:Page,testInfo:TestInfo,suffix='final'){
  const slug=testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);
  const path=`../artifacts/qa-v4/${slug}-${suffix}.png`;
  await expect.poll(()=>page.locator('.branch-story:visible,.anchor-story:visible,.character-picker:visible').evaluateAll(elements=>elements.every(el=>parseFloat(getComputedStyle(el).opacity)>.98)),{timeout:15_000}).toBe(true);
  await page.screenshot({path,animations:'allow'});await testInfo.attach(`actual-${suffix}`,{path,contentType:'image/png'});
}

test.use({reducedMotion:'no-preference'});
test.beforeEach(async({page})=>{
  // These acceptance cases exercise the shipped offline story path. Existing
  // integration tests separately cover the database and owner-scoped cleanup.
  await page.route('**/api/**',route=>route.abort('internetdisconnected'));
  const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));
});
test.afterEach(async({page},testInfo)=>{
  await attachObservations(page,testInfo);
  if(!page.isClosed())await screenshot(page,testInfo).catch(async error=>testInfo.attach('screenshot-capture-error',{body:String(error),contentType:'text/plain'}));
  expect(pageErrors.get(page)||[]).toEqual([]);
});

test('named desktop controls switch a real walking avatar and preserve the walking position',async({page})=>{
  test.setTimeout(300_000);await enter(page);await observe(page);
  for(const name of ['我的收藏','放大文字','开启声音','减少动态效果'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  for(const name of ['第一人称','第三人称','房间总览','切换人物']){
    const button=page.getByRole('button',{name,exact:true});await expect(button).toBeVisible();await expect(button.locator('strong')).toBeVisible();
  }
  await expect(page.getByRole('button',{name:'第一人称',exact:true})).toHaveAttribute('aria-pressed','true');
  const firstPersonMeshes=await metric(page,'mesh-count');
  await page.getByRole('button',{name:'第三人称',exact:true}).click();
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode','third-person');
  await expect(canvas(page)).toHaveAttribute('data-player-avatar-visible','true');
  await expect(canvas(page)).toHaveAttribute('data-loaded-characters',/young-man/,{timeout:60_000});
  await expect.poll(()=>metric(page,'mesh-count')).toBeGreaterThan(firstPersonMeshes);
  const start=await position(page);await page.keyboard.down('a');
  try{await expect(canvas(page)).toHaveAttribute('data-player-motion','walk');await expect.poll(async()=>distance(start,await position(page)),{timeout:60_000}).toBeGreaterThan(.3);}finally{await page.keyboard.up('a');}
  await expect(canvas(page)).toHaveAttribute('data-player-motion','idle');
  const afterA=await position(page);await walk(page,'w',p=>p[2]<afterA[2]-.25);const moved=await position(page);
  await page.getByRole('button',{name:'第一人称',exact:true}).click();await expect(canvas(page)).toHaveAttribute('data-player-avatar-visible','false');
  expect(distance(moved,await position(page))).toBeLessThan(.06);
  await overview(page);expect(distance(moved,await position(page))).toBeLessThan(.06);
  await page.getByRole('button',{name:'第三人称',exact:true}).click();await expect(canvas(page)).toHaveAttribute('data-player-avatar-visible','true');expect(distance(moved,await position(page))).toBeLessThan(.06);
});

test('the original television programme advances, visibly pauses, restarts and auto-plays on reopening',async({page})=>{
  test.setTimeout(300_000);await enter(page);await overview(page);await observe(page);
  await page.getByTestId('anchor-tv').click();await expect(canvas(page)).toHaveAttribute('data-tv-power','on');await expect(canvas(page)).toHaveAttribute('data-tv-playing','true');
  const first=await metric(page,'tv-frame');await expect.poll(()=>metric(page,'tv-frame'),{timeout:60_000}).toBeGreaterThan(first+25);
  expect(await page.locator('.anchor-story>p').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
  await pause(page);await expect(canvas(page)).toHaveAttribute('data-tv-playing','false');const paused=await metric(page,'tv-frame');await renderedFrames(page);expect(await metric(page,'tv-frame')).toBe(paused);
  await page.getByRole('button',{name:'重播剧情',exact:true}).click();await expect(canvas(page)).toHaveAttribute('data-tv-playing','true');
  await expect.poll(()=>metric(page,'tv-frame')).toBeLessThan(paused);
  await pause(page);await page.getByRole('button',{name:'继续探索',exact:true}).click();await page.getByTestId('anchor-tv').click();
  await expect(canvas(page)).toHaveAttribute('data-tv-playing','true');
  await expect.poll(()=>metric(page,'story-time'),{timeout:150_000}).toBeGreaterThan(14);
  await pause(page);await expect(canvas(page)).toHaveAttribute('data-tv-playing','false');
  const latePaused=await metric(page,'tv-frame');await renderedFrames(page);expect(await metric(page,'tv-frame')).toBe(latePaused);
  expect(await metric(page,'story-time')).toBeGreaterThan(14);
});

test('my third-person appearance and the companion stay independently selected after refresh',async({page},testInfo)=>{
  test.setTimeout(300_000);await enter(page);await observe(page);
  await overview(page);
  await page.getByRole('button',{name:'切换人物',exact:true}).click();
  await expect.poll(async()=>{
    const camera=(await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number),person=await position(page,'companion');
    return Math.hypot(camera[0]-person[0],camera[2]-person[2]);
  },{timeout:30_000}).toBeLessThan(3);
  await page.getByRole('button',{name:'关闭人物设置',exact:true}).click();
  await expect.poll(async()=>{
    const camera=(await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number);return Math.hypot(camera[0],camera[2]);
  }).toBeGreaterThan(10);
  await page.getByRole('button',{name:'切换人物',exact:true}).click();
  await page.getByRole('button',{name:'我的形象 · 第三人称',exact:true}).click();
  const self=page.getByRole('dialog',{name:'选择自己的形象'});
  await self.getByRole('button',{name:/青年女性/}).click();
  await expect(self.locator('.character-choice.selected')).toHaveCount(1);
  await expect(self.locator('.character-choice.selected')).toHaveAttribute('aria-pressed','true');
  await expect(self.locator('.character-choice.selected')).toContainText('青年女性');
  await page.getByRole('button',{name:'使用这个形象',exact:true}).click();
  await expect(canvas(page)).toHaveAttribute('data-loaded-characters',/young-woman/,{timeout:60_000});
  await expect(canvas(page)).toHaveAttribute('data-companion','elder-woman');
  await expect(canvas(page)).toHaveAttribute('data-player-avatar-visible','true');
  await expect.poll(async()=>{
    const camera=(await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number),person=await position(page);return Math.hypot(camera[0]-person[0],camera[2]-person[2]);
  },{timeout:30_000}).toBeGreaterThan(1.7);
  await renderedFrames(page,5);
  await screenshot(page,testInfo,'my-young-woman-third-person');
  const start=await position(page);await walk(page,'a',p=>p[0]<start[0]-.3);
  await page.getByRole('button',{name:'切换人物',exact:true}).click();
  await page.getByRole('button',{name:'陪伴角色',exact:true}).click();
  const companion=page.getByRole('dialog',{name:'选择陪伴角色'});
  await companion.getByRole('button',{name:/长者男性/}).click();
  await page.getByRole('button',{name:'让这位陪伴我',exact:true}).click();
  await expect(canvas(page)).toHaveAttribute('data-companion','elder-man');
  expect(await page.evaluate(()=>localStorage.getItem('memorybox-player-avatar'))).toBe('young-woman');
  await page.reload();await phase(page,'exploration');
  await expect(canvas(page)).toHaveAttribute('data-companion-ready','true',{timeout:90_000});
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode','third-person');
  await expect(canvas(page)).toHaveAttribute('data-companion','elder-man');
  await expect(canvas(page)).toHaveAttribute('data-loaded-characters',/young-woman/,{timeout:60_000});
  await page.getByRole('button',{name:'切换人物',exact:true}).click();
  await page.getByRole('button',{name:'我的形象 · 第三人称',exact:true}).click();
  await expect(page.locator('.character-choice.selected')).toContainText('青年女性');
  await screenshot(page,testInfo,'independent-appearance-after-refresh');
});

for(const branch of ['real','imagined'] as const)test(`home ${branch} branch performs continuous goodbye actions and freezes and replays them`,async({page},testInfo)=>{
  test.setTimeout(300_000);await enter(page);await collect(page);await observe(page);await choose(page,branch);
  await expect.poll(async()=>(await observations(page)).some(s=>s.phase===`${branch}-branch`&&s.action==='talk'),{timeout:30_000}).toBe(true);
  const initialSample=(await observations(page)).find(s=>s.phase===`${branch}-branch`&&s.action==='talk')!,initial=initialSample.position.split(',').map(Number) as V3;
  await expect(canvas(page)).toHaveAttribute('data-companion-action','walk',{timeout:90_000});await expect.poll(async()=>distance(initial,await position(page,'companion')),{timeout:60_000}).toBeGreaterThan(.25);
  await pause(page);await renderedFrames(page);const frozen={time:await metric(page,'story-time'),position:await position(page,'companion'),pose:await canvas(page).getAttribute('data-companion-pose')};await renderedFrames(page);
  expect(await metric(page,'story-time')).toBe(frozen.time);expect(distance(frozen.position,await position(page,'companion'))).toBeLessThan(.002);
  expect(frozen.pose).toMatch(/-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+/);expect(await canvas(page).getAttribute('data-companion-pose')).toBe(frozen.pose);
  await page.getByRole('button',{name:'重播剧情',exact:true}).click();
  await expect.poll(()=>metric(page,'story-time')).toBeLessThan(2);await expect.poll(async()=>distance(initial,await position(page,'companion'))).toBeLessThan(.03);
  await expect(canvas(page)).toHaveAttribute('data-companion-action','wave',{timeout:120_000});
  expect(distance(initial,await position(page,'companion'))).toBeGreaterThan(.5);
  await screenshot(page,testInfo,'companion-wave');
  if(branch==='real'){
    // Selecting the same route again is a new performance, not an immediate
    // jump to the previous route's final position.
    await page.getByRole('button',{name:'重新选择',exact:true}).click();await choose(page,'real');
    await expect.poll(()=>metric(page,'story-time')).toBeLessThan(2);await expect.poll(async()=>distance(initial,await position(page,'companion'))).toBeLessThan(.03);
    await expect.poll(async()=>Math.abs(Number((await canvas(page).getAttribute('data-companion-pose'))!.split(',')[1]))).toBeLessThan(.06);
  }else await expect(page.locator('.branch-label')).toContainText('并非真实历史');
});

test('a custom confirmed choice to stay never acquires an unconfirmed departure action',async({page})=>{
  test.setTimeout(300_000);await enter(page,'old-home',true);await collect(page);await observe(page);await choose(page,'real');
  const initial=await position(page,'companion');
  await expect.poll(()=>metric(page,'story-time'),{timeout:150_000}).toBeGreaterThanOrEqual(9);
  expect(distance(initial,await position(page,'companion'))).toBeLessThan(.002);await expect(canvas(page)).toHaveAttribute('data-story-beat','confirmed-memory');
  const samples=(await observations(page)).filter(s=>s.phase==='real-branch');expect(samples.length).toBeGreaterThan(3);expect(samples.some(s=>s.action==='walk'||s.action==='wave')).toBe(false);
  await expect(page.locator('.branch-story')).toContainText('留在客厅继续喝茶');
});

test('the carriage stays at the platform during exploration and the whole train departs after the goodbye',async({page},testInfo)=>{
  test.setTimeout(300_000);await enter(page,'station');await observe(page);
  await walk(page,'w',p=>p[2]<.05);await walk(page,'d',p=>p[0]>6.8);await expect(canvas(page)).toHaveAttribute('data-zone','carriage');
  expect(Math.abs(await metric(page,'train-offset'))).toBeLessThan(.001);await renderedFrames(page);expect(Math.abs(await metric(page,'train-offset'))).toBeLessThan(.001);
  await collect(page);await observe(page);await choose(page,'real');
  await expect.poll(async()=>(await observations(page)).some(s=>s.phase==='real-branch'&&s.action==='wave'),{timeout:120_000}).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-train-signal','proceed',{timeout:90_000});await expect.poll(()=>metric(page,'train-door')).toBeGreaterThan(.99);
  await expect.poll(()=>metric(page,'train-offset'),{timeout:90_000}).toBeLessThan(-.4);
  const first=await trainState(page);
  await expect.poll(()=>metric(page,'train-offset'),{timeout:60_000}).toBeLessThan(first.offset-.4);
  await pause(page);const stopped=await trainState(page);
  await screenshot(page,testInfo,'train-departing-paused');
  expect(stopped.angle).toBeLessThan(first.angle);expect(Math.abs(stopped.angle/stopped.offset-first.angle/first.offset)).toBeLessThan(.02);
  await renderedFrames(page);expect(await metric(page,'train-offset')).toBe(stopped.offset);expect(await metric(page,'story-time')).toBe(stopped.time);
  const evidence=(await observations(page)).filter(s=>s.phase==='real-branch');const signalIndex=evidence.findIndex(s=>s.signal==='proceed'),movementIndex=evidence.findIndex(s=>s.trainOffset<-.05);
  expect(signalIndex).toBeGreaterThanOrEqual(0);expect(movementIndex).toBeGreaterThan(signalIndex);
  await page.getByRole('button',{name:'重播剧情',exact:true}).click();await expect.poll(()=>metric(page,'story-time')).toBeLessThan(2);await expect(canvas(page)).toHaveAttribute('data-train-signal','stop');expect(Math.abs(await metric(page,'train-offset'))).toBeLessThan(.001);
});

test('the classroom keeps its note on the desk and the friend reaches the clear rear aisle',async({page},testInfo)=>{
  test.setTimeout(300_000);await enter(page,'classroom');
  // Walk the physical rear opening before the story locks navigation.
  await walk(page,'d',p=>p[0]>6.3);await expect(canvas(page)).toHaveAttribute('data-zone','corridor');
  await collect(page);await observe(page);await choose(page,'imagined');await expect(canvas(page)).toHaveAttribute('data-note-status','on-desk');
  await expect.poll(async()=>(await observations(page)).some(s=>s.phase==='imagined-branch'&&s.noteFocus>0),{timeout:40_000}).toBe(true);
  const initial=(await observations(page)).find(s=>s.phase==='imagined-branch'&&s.position)!.position.split(',').map(Number) as V3;
  await expect(canvas(page)).toHaveAttribute('data-companion-action','wave',{timeout:150_000});const end=await position(page,'companion');
  expect(distance(initial,end)).toBeGreaterThan(2);expect(end[2]).toBeGreaterThan(3.2);expect(end[0]).toBeGreaterThan(3.5);
  await screenshot(page,testInfo,'rear-aisle-goodbye');
  const samples=(await observations(page)).filter(s=>s.phase==='imagined-branch');expect(samples.every(s=>s.note==='on-desk')).toBe(true);
  await expect(page.locator('.branch-story')).not.toContainText('递给');
});

for(const width of [390,319])test(`${width}px keeps named settings and readable story text inside the viewport`,async({page},testInfo)=>{
  test.setTimeout(300_000);await page.setViewportSize({width,height:844});await page.goto('/');
  const settings=page.getByRole('button',{name:'显示设置',exact:true});await expect(settings).toHaveAttribute('aria-expanded','false');await expect(page.locator('.display-preferences')).toBeHidden();
  await expect(page.getByRole('button',{name:'我的收藏',exact:true}).locator('strong')).toBeVisible();
  await settings.click();await expect(settings).toHaveAttribute('aria-expanded','true');await expect(page.locator('.display-preferences')).toBeVisible();
  for(const name of ['放大文字','开启声音','减少动态效果'])await expect(page.getByRole('button',{name,exact:true})).toBeInViewport();
  const preferences=await page.locator('.display-preferences').boundingBox();expect(preferences).not.toBeNull();expect(preferences!.x).toBeGreaterThanOrEqual(0);expect(preferences!.x+preferences!.width).toBeLessThanOrEqual(width+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await screenshot(page,testInfo,'settings-expanded');
  await page.getByRole('button',{name:'放大文字',exact:true}).click();await expect(page.locator('main')).toHaveClass(/large-type/);await page.getByRole('button',{name:'恢复标准字号',exact:true}).click();await settings.click();
  await enter(page);await overview(page);await page.getByTestId('anchor-photo').click();await expect(page.locator('.anchor-story')).toBeVisible();
  expect(await page.locator('.anchor-story>p').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const bounds=await page.locator('.anchor-story').boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
});
