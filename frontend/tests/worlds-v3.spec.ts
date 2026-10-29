import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const directory=resolve('..','artifacts','qa-v3');
const canvas=(page:Page)=>page.locator('canvas');
async function shot(page:Page,name:string){await mkdir(directory,{recursive:true});await page.screenshot({path:resolve(directory,name+'.png'),animations:'disabled'});}
async function enter(page:Page,template:'old-home'|'station'|'classroom'){
  await page.goto('/');
  await page.getByRole('button',{name:'打开记忆',exact:true}).click();
  await page.getByRole('button',{name:'挑选一段记忆',exact:true}).click();
  if(template!=='old-home')await page.getByRole('button',{name:template==='station'?/那年，我们选择远方/:/青春里没说出口的话/}).click();
  await page.getByRole('button',{name:'选好了，继续',exact:true}).click();
  await page.getByRole('button',{name:'整理这段记忆',exact:true}).click();
  await page.getByRole('button',{name:'走进那一天',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-phase','exploration',{timeout:60_000});
  await expect(canvas(page)).toHaveAttribute('data-scene-template',template);
  await expect(canvas(page)).toHaveAttribute('data-loaded-characters',/elder-woman/);
  await expect(canvas(page)).toHaveAttribute('data-player-position',/-?\d+\.\d+,/);
}
async function coordinate(page:Page,axis:number){return Number((await canvas(page).getAttribute('data-player-position'))!.split(',')[axis]);}
async function move(page:Page,key:string,axis:number,target:number,less:boolean){
  await page.keyboard.down(key);
  try{const e=expect.poll(()=>coordinate(page,axis),{timeout:35_000,intervals:[75]});if(less)await e.toBeLessThan(target);else await e.toBeGreaterThan(target);}finally{await page.keyboard.up(key);}
}
test.afterEach(async({page,request})=>{
  try{const token=await page.evaluate(()=>localStorage.getItem('memorybox-owner'));if(!token)return;const headers={'X-MemoryBox-Token':token};const response=await request.get('http://127.0.0.1:8000/api/memories',{headers});if(response.ok())for(const m of await response.json())await request.delete(`http://127.0.0.1:8000/api/memories/${m.id}`,{headers});}catch{/* Isolated offline owner has no server data. */}
});

test.describe('mechanical prologue',()=>{
  test.use({reducedMotion:'no-preference',viewport:{width:1600,height:1000}});
  test('real hinged music box opens, then camera and blur cross into the selected parallel world',async({page},testInfo)=>{
    test.setTimeout(120_000);
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await expect(canvas(page)).toHaveAttribute('data-mechanism',/44-tuned-comb-teeth/);
    await expect.poll(async()=>Math.abs(Number(await canvas(page).getAttribute('data-box-lid-angle')))).toBeLessThan(.05);
    await shot(page,'01-musicbox-landing');
    await page.getByRole('button',{name:'打开记忆',exact:true}).click();
    await expect.poll(async()=>Number(await canvas(page).getAttribute('data-box-lid-angle'))).toBeLessThan(-1.2);
    const rotation=await canvas(page).getAttribute('data-cylinder-angle');
    await expect.poll(()=>canvas(page).getAttribute('data-cylinder-angle')).not.toBe(rotation);
    await shot(page,'02-musicbox-open');
    await page.getByRole('button',{name:'挑选一段记忆',exact:true}).click();
    await page.getByRole('button',{name:'选好了，继续',exact:true}).click();
    await page.getByRole('button',{name:'整理这段记忆',exact:true}).click();
    await expect(canvas(page)).toHaveAttribute('data-world','present');
    // Latch observations in the page's animation frames. Protocol polling can miss
    // the short opacity peak while software WebGL blocks the browser main thread.
    await page.evaluate(()=>{
      const evidence={startedAt:0,maxOpacity:0,maxBlur:0,sawPresent:document.querySelector('canvas')?.dataset.world==='present',sawMemoryDuringTransition:false,sawMemoryWhileVeiled:false,samples:[] as {time:number;opacity:number;blur:number;world:string}[]};
      Object.assign(window,{__memoryboxPassageEvidence:evidence});
      const sample=()=>{
        const veil=document.querySelector('.transition-veil.transition-in'),phase=document.querySelector('main')?.getAttribute('data-phase');
        if(veil){
          if(!evidence.startedAt)evidence.startedAt=performance.now();
          const style=getComputedStyle(veil),opacity=parseFloat(style.opacity),blur=Number(style.backdropFilter.match(/blur\(([\d.]+)px\)/)?.[1]||0),world=document.querySelector('canvas')?.dataset.world||'';
          evidence.maxOpacity=Math.max(evidence.maxOpacity,opacity);evidence.maxBlur=Math.max(evidence.maxBlur,blur);
          evidence.sawPresent||=world==='present';evidence.sawMemoryDuringTransition||=world==='memory';evidence.sawMemoryWhileVeiled||=world==='memory'&&opacity>.45;
          if(evidence.samples.length<240)evidence.samples.push({time:Math.round(performance.now()-evidence.startedAt),opacity,blur,world});
        }
        if(!evidence.startedAt||phase==='transition-in')requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const passageEvidence=()=>page.evaluate(()=>(window as Window&{__memoryboxPassageEvidence?:{maxOpacity:number;maxBlur:number;sawPresent:boolean;sawMemoryDuringTransition:boolean;sawMemoryWhileVeiled:boolean}}).__memoryboxPassageEvidence!);
    try{
      await page.getByRole('button',{name:'走进那一天',exact:true}).click();
      await expect(page.locator('.transition-in')).toBeVisible();
      await expect.poll(async()=>(await passageEvidence()).sawMemoryWhileVeiled,{timeout:60_000,intervals:[100]}).toBe(true);
      // Disabling animations fast-forwards this exact transition, invalidating the observation.
      await page.screenshot({path:resolve(directory,'04-parallel-passage-blur.png'),animations:'allow'});
      const evidence=await passageEvidence();
      expect(evidence.sawPresent).toBe(true);expect(evidence.sawMemoryDuringTransition).toBe(true);
      expect(evidence.maxOpacity).toBeGreaterThan(.45);expect(evidence.maxBlur).toBeGreaterThanOrEqual(12);
      await expect(page.locator('main')).toHaveAttribute('data-phase','exploration',{timeout:60_000});
      await expect(canvas(page)).toHaveAttribute('data-world','memory');
      expect(errors).toEqual([]);
    }finally{
      const evidence=await passageEvidence().catch(error=>({unavailable:String(error)})),body=JSON.stringify(evidence,null,2);
      const evidenceDirectory=resolve('..','artifacts','v3-focused-review');await mkdir(evidenceDirectory,{recursive:true});
      await writeFile(resolve(evidenceDirectory,'mechanical-observations.json'),body);
      await testInfo.attach('parallel-passage-observations',{body,contentType:'application/json'});
    }
  });
});

test('station is a separate world, can walk from hall to platform into the furnished carriage and save a letter',async({page})=>{
  test.setTimeout(210_000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await enter(page,'station');await expect(page.locator('.zone-indicator')).toContainText('候车大厅');
  await shot(page,'05-station-concourse');
  await move(page,'w',2,-.05,true);await expect(canvas(page)).toHaveAttribute('data-zone','platform');
  await shot(page,'06-station-platform');
  await move(page,'d',0,5.6,false);await expect(canvas(page)).toHaveAttribute('data-zone','carriage');
  await shot(page,'07-station-carriage');
  await move(page,'d',0,6.8,false);await move(page,'w',2,-4,true);
  await expect(canvas(page)).toHaveAttribute('data-zone','carriage');await shot(page,'07b-carriage-aisle');
  await page.getByRole('button',{name:'房间总览',exact:true}).click();
  for(const id of ['tv','doll','photo']){await page.getByTestId('anchor-'+id).click();await expect(page.locator('.anchor-story')).toBeVisible();await page.getByRole('button',{name:'继续探索',exact:true}).click();}
  await page.getByRole('button',{name:'走到那扇门前',exact:true}).click();
  await page.getByRole('button',{name:/把.*说/}).click();
  await expect(page.locator('.branch-label')).toContainText('并非真实历史');
  await page.getByRole('button',{name:'写一封信',exact:true}).click();
  const text='这次，我真的走过站台，走进了那节车厢。';await page.getByLabel('信的内容',{exact:true}).fill(text);
  await page.getByRole('button',{name:'封好信，回到现在',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-phase','return-room');
  await page.getByRole('button',{name:'打开我的收藏',exact:true}).click();await page.getByRole('button',{name:'打开信件',exact:true}).click();await expect(page.locator('.saved-letter')).toHaveText(text);
  expect(errors).toEqual([]);
});

test('classroom has physical desks, a traversable corridor and its own three narrative objects',async({page})=>{
  test.setTimeout(160_000);await enter(page,'classroom');await shot(page,'08-classroom-eye-height');
  await move(page,'d',0,5.8,false);await expect(canvas(page)).toHaveAttribute('data-zone','corridor');
  await shot(page,'09-classroom-corridor');
  await page.getByRole('button',{name:'房间总览',exact:true}).click();await shot(page,'10-classroom-overview');
  for(const [id,label]of [['tv','毕业留言'],['doll','折过的纸条'],['photo','毕业纪念册']]){
    await expect(page.getByTestId('anchor-'+id)).toContainText(label);await page.getByTestId('anchor-'+id).click();await expect(page.locator('.anchor-story')).toBeVisible();await page.getByRole('button',{name:'继续探索',exact:true}).click();
  }
});

test('home contains five connected standard rooms with actual bedroom and study access',async({page})=>{
  test.setTimeout(180_000);await enter(page,'old-home');await shot(page,'11-home-eye-height');
  // The west doorway sits behind the sofa; approach via the clear centre aisle.
  await move(page,'a',0,-1.55,true);await move(page,'w',2,-2.64,true);await move(page,'a',0,-4.55,true);
  await expect(canvas(page)).toHaveAttribute('data-zone','bedroom');await shot(page,'12-home-bedroom');
  await move(page,'a',0,-5.3,true);await move(page,'w',2,-4.1,true);
  await expect(canvas(page)).toHaveAttribute('data-zone','study');await shot(page,'13-home-study');
  await page.getByRole('button',{name:'房间总览',exact:true}).click();await shot(page,'14-home-five-rooms');
});
