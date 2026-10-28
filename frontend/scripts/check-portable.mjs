import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const executable=process.env.MEMORYBOX_BROWSER||[
  resolve(process.env.LOCALAPPDATA||'','ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p=>existsSync(p));
const browser=await chromium.launch({executablePath:executable,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];const requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text().slice(0,500));});
page.on('request',request=>requests.push(request.url().slice(0,160)));
await page.goto(pathToFileURL(resolve('..','index.html')).href);
try{await page.getByRole('button',{name:'打开记忆',exact:true}).waitFor({state:'visible',timeout:12000});}catch{/* Report an actionable diagnosis below. */}
await mkdir(resolve('..','artifacts'),{recursive:true});
await page.screenshot({path:resolve('..','artifacts','offline-diagnostic.png')});
console.log(JSON.stringify({errors,requests,body:(await page.locator('body').innerText()).slice(0,1000),scripts:await page.locator('script').count()},null,2));
await browser.close();
if(errors.length)process.exitCode=1;
