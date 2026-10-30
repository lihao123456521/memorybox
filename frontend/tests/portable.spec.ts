import {test,expect} from '@playwright/test';
import {copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('a copied index.html alone runs offline with real GLB characters, walking and the full saved-letter journey',async({page},testInfo)=>{
  test.setTimeout(300_000);
  const directory=resolve('..','artifacts',process.env.MEMORYBOX_PORTABLE_EVIDENCE||'offline-only');
  await mkdir(directory,{recursive:true});
  const html=resolve(directory,'index.html');
  await copyFile(resolve(process.env.MEMORYBOX_PORTABLE_HTML||resolve('..','index.html')),html);
  const httpRequests:string[]=[];const otherFiles:string[]=[];const errors:string[]=[];
  page.on('request',request=>{const url=request.url();if(/^https?:/.test(url))httpRequests.push(url);if(url.startsWith('file:')&&url!==pathToFileURL(html).href)otherFiles.push(url);});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:\/\//,route=>route.abort());
  await page.goto(pathToFileURL(html).href);
  await expect(page.getByRole('button',{name:'打开记忆',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'打开记忆',exact:true}).click();
  await page.getByRole('button',{name:'挑选一段记忆',exact:true}).click();
  await page.getByRole('button',{name:'选好了，继续',exact:true}).click();
  await page.getByRole('button',{name:'整理这段记忆',exact:true}).click();
  await page.getByRole('button',{name:'走进那一天',exact:true}).click();
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-world','memory',{timeout:60_000});
  await expect(canvas).toHaveAttribute('data-navigation-mode','walk');
  await expect(canvas).toHaveAttribute('data-loaded-characters',/elder-woman/);
  await expect(page.locator('main')).toHaveAttribute('data-phase','exploration',{timeout:60_000});
  await expect(canvas).toHaveAttribute('data-navigation-paused','false');
  await expect(page.locator('.connection')).toContainText('离线演示模式');
  const position=()=>canvas.getAttribute('data-player-position');
  const start=(await position())!.split(',').map(Number);
  await page.keyboard.down('a');
  try{await expect.poll(async()=>Number((await position())!.split(',')[0])).toBeLessThan(start[0]-.3);}finally{await page.keyboard.up('a');}
  await page.screenshot({path:resolve(directory,'offline-walking.png'),animations:'disabled'});
  for(const person of [{id:'young-man',label:'青年男性'},{id:'elder-man',label:'长者男性'},{id:'young-woman',label:'青年女性'},{id:'elder-woman',label:'长者女性'}]){
    await page.getByRole('button',{name:'切换人物',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(person.label)}).click();
    await page.getByRole('button',{name:'让这位陪伴我',exact:true}).click();
    await expect(canvas).toHaveAttribute('data-loaded-characters',new RegExp(person.id),{timeout:60_000});
    await expect(canvas).toHaveAttribute('data-companion-ready','true',{timeout:60_000});
  }
  await page.getByRole('button',{name:'第三人称',exact:true}).click();
  await expect(canvas).toHaveAttribute('data-player-avatar-visible','true');
  await expect(canvas).toHaveAttribute('data-loaded-characters',/young-man/,{timeout:60_000});
  const beforeThird=(await position())!.split(',').map(Number);await page.keyboard.down('w');
  try{await expect.poll(async()=>Number((await position())!.split(',')[2]),{timeout:30_000}).toBeLessThan(beforeThird[2]-.25);}finally{await page.keyboard.up('w');}
  await page.getByRole('button',{name:'房间总览',exact:true}).click();
  for(const id of ['tv','doll','photo']){
    await page.getByTestId(`anchor-${id}`).click();
    await expect(page.locator('.anchor-story')).toBeVisible();
    await page.getByRole('button',{name:'继续探索',exact:true}).click();
  }
  await page.getByRole('button',{name:'走到那扇门前',exact:true}).click();
  await page.getByRole('button',{name:/多留一个下午/}).click();
  await expect(page.locator('.branch-label')).toContainText('AI 想象 · 并非真实历史');
  await page.getByRole('button',{name:'写一封信',exact:true}).click();
  const letter='只复制这一个 index.html，断网后也能走进房间、看见四个人物，并完整珍藏这封信。';
  await page.getByLabel('信的内容',{exact:true}).fill(letter);
  await page.getByRole('button',{name:'封好信，回到现在',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-phase','return-room');
  await page.getByRole('button',{name:'打开我的收藏',exact:true}).click();
  await expect(page.locator('.collection-entry')).toHaveCount(1);
  await page.getByRole('button',{name:'打开信件',exact:true}).click();
  await expect(page.locator('.saved-letter')).toHaveText(letter);
  await page.reload();
  await page.getByRole('button',{name:'打开信件',exact:true}).click();
  await expect(page.locator('.saved-letter')).toHaveText(letter);
  await page.screenshot({path:resolve(directory,'offline-saved-letter.png'),animations:'disabled'});
  await expect(page.getByRole('button',{name:'同步到本机数据库',exact:true})).toHaveCount(0);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:/^删除回忆 /}).click();
  await expect(page.locator('.collection-entry')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.collection-entry')).toHaveCount(0);
  expect(httpRequests).toEqual([]);expect(otherFiles).toEqual([]);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>window.__MEMORYBOX_PORTABLE__?.assetCount)).toBeGreaterThanOrEqual(23);
  await testInfo.attach('tested-portable-build',{body:JSON.stringify(await page.evaluate(()=>window.__MEMORYBOX_PORTABLE__),null,2),contentType:'application/json'});
});

for(const world of [{id:'station',label:'那年，我们选择远方',objects:['候车时刻表','旧皮箱','那张车票']},{id:'classroom',label:'青春里没说出口的话',objects:['毕业留言','折过的纸条','毕业纪念册']}]){
  test(`the single offline HTML includes the independent ${world.id} world and all three narrative objects`,async({page})=>{
    test.setTimeout(120_000);
    const directory=resolve('..','artifacts','offline-worlds',world.id);await mkdir(directory,{recursive:true});
    const html=resolve(directory,'index.html');await copyFile(resolve(process.env.MEMORYBOX_PORTABLE_HTML||resolve('..','index.html')),html);
    const dependencies:string[]=[],errors:string[]=[];
    page.on('request',r=>{if(/^https?:/.test(r.url())||(r.url().startsWith('file:')&&r.url()!==pathToFileURL(html).href))dependencies.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(html).href);
    await page.getByRole('button',{name:'打开记忆',exact:true}).click();await page.getByRole('button',{name:'挑选一段记忆',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(world.label)}).click();await page.getByRole('button',{name:'选好了，继续',exact:true}).click();
    await page.getByRole('button',{name:'整理这段记忆',exact:true}).click();await page.getByRole('button',{name:'走进那一天',exact:true}).click();
    await expect(page.locator('canvas')).toHaveAttribute('data-scene-template',world.id,{timeout:60_000});await expect(page.locator('canvas')).toHaveAttribute('data-loaded-characters',/elder-woman/);
    await page.getByRole('button',{name:'房间总览',exact:true}).click();
    for(const [i,id]of ['tv','doll','photo'].entries()){
      await expect(page.getByTestId('anchor-'+id)).toContainText(world.objects[i]);await page.getByTestId('anchor-'+id).click();await expect(page.locator('.anchor-story')).toBeVisible();await page.getByRole('button',{name:'继续探索',exact:true}).click();
    }
    await page.screenshot({path:resolve(directory,'offline-'+world.id+'.png'),animations:'disabled'});
    expect(dependencies).toEqual([]);expect(errors).toEqual([]);
  });
}
