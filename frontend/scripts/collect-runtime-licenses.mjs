import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {dirname, resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=resolve(frontend,'..');
const lockPath=resolve(frontend,'package-lock.json');
const destination=resolve(project,'THIRD_PARTY_LICENSES.txt');
const cache=resolve(project,'artifacts','licenses');
const licenseName=/(?:^|[._-])(?:licen[cs]e|copying|notice|copyright)(?:[._-]|$)/i;

// Exact upstream version sources for packages whose npm archive omits its license.
// A successful download is cached in ignored artifacts/licenses and its SHA-256
// is recorded in the output. No SPDX abbreviation is expanded into invented text.
const upstream={
  '@react-three/fiber@9.8.2':[{file:'react-three-fiber-9.8.2-LICENSE',version:'v9.8.2, commit d74622ea8ed717f7212d7e19d65ff3e325508389',url:'https://raw.githubusercontent.com/pmndrs/react-three-fiber/d74622ea8ed717f7212d7e19d65ff3e325508389/LICENSE',sha256:'9c35b5de7b7493a707fffe4eb23bd2f7f449153c1911f7c6eefb4e591fd5349a'}],
  'draco3d@1.5.9':[{file:'draco-1.5.9-LICENSE',version:'1.5.9, commit 554628821c3448319d7d4ae48db170b8c63e1aaf',url:'https://raw.githubusercontent.com/google/draco/554628821c3448319d7d4ae48db170b8c63e1aaf/LICENSE',sha256:'d3709b0fb4b8a94bbb1d02b8a2e484f258b0d9c5c5a01f940391f3fe662cd1a4'}],
  '@mediapipe/tasks-vision@0.10.17':[{file:'mediapipe-v0.10.18-LICENSE',version:'Apache-2.0 terms from v0.10.18, commit 76e52c759f87e6e71f531dd785cd892ba163a454; NOT asserted to be the npm 0.10.17 source revision',url:'https://raw.githubusercontent.com/google-ai-edge/mediapipe/76e52c759f87e6e71f531dd785cd892ba163a454/LICENSE',sha256:'8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8'}],
};
const caveats={
  'maath@0.10.8':'The exact official maath@0.10.8 source tree (commit 626d198fbae28ba82f2f1b184db7fcafd4d23846) and npm archive have no standalone LICENSE/NOTICE or package-wide copyright notice. The actual installed package.json MIT declaration and the complete embedded MIT notice in its easing module are reproduced below. No package-wide copyright owner or year has been invented. Official version source: https://github.com/pmndrs/maath/tree/626d198fbae28ba82f2f1b184db7fcafd4d23846',
  'stats-gl@2.4.2':'The exact official npm gitHead source tree c12b2e391d5a88616e0b30f3c7f0577966426239 and npm archive have no standalone LICENSE/NOTICE or copyright notice. Its actual package.json author/MIT declaration and README license statement are reproduced below. No copyright owner or year has been invented. MIT permission terms are reproduced elsewhere in this collection; the missing upstream notice is not silently manufactured. Official version source: https://github.com/RenaudRohlinger/stats-gl/tree/c12b2e391d5a88616e0b30f3c7f0577966426239',
  '@mediapipe/tasks-vision@0.10.17':'The npm 0.10.17 metadata has no gitHead and the official repository has no v0.10.17 tag. Copyright notices are extracted from the actual installed 0.10.17 files. Fixed Apache-2.0 terms are separately reproduced from the official repository at the explicitly identified v0.10.18 commit, not presented as a matching source revision.',
};

function inside(path,parent){
  const rel=relative(parent,path);
  if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')||isAbsolute(rel))throw Error(`Path escapes package: ${path}`);
}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function findLicenses(directory,root=directory){
  const files=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
    if(entry.name==='node_modules'||entry.name==='.git')continue;
    const path=resolve(directory,entry.name);inside(path,root);
    if(entry.isDirectory())files.push(...await findLicenses(path,root));
    else if(entry.isFile()&&licenseName.test(entry.name))files.push(path);
  }
  return files;
}
async function upstreamText(source){
  await mkdir(cache,{recursive:true});
  const path=resolve(cache,source.file);inside(path,cache);
  let bytes;
  try{bytes=await readFile(path);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const response=await fetch(source.url);
    if(!response.ok)throw Error(`License download ${response.status}: ${source.url}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(source.sha256&&sha256(bytes)!==source.sha256)throw Error(`License hash mismatch: ${source.url}`);
    await writeFile(path,bytes);
  }
  if(source.sha256&&sha256(bytes)!==source.sha256)throw Error(`Cached license hash mismatch: ${path}`);
  return {bytes,source:`${source.url}\nUpstream version: ${source.version}\nSHA-256: ${sha256(bytes)}`};
}
async function extracted(packageRoot,file,extract){
  const path=resolve(packageRoot,file);inside(path,packageRoot);
  const bytes=await readFile(path);const text=extract(bytes.toString('utf8'));
  if(!text||!text.trim())throw Error(`Expected original notice not found: ${path}`);
  return {bytes:Buffer.from(text),source:`${relative(frontend,path).replaceAll('\\','/')} (verbatim excerpt)\nOriginal file SHA-256: ${sha256(bytes)}`};
}
function noticeBlocks(text){
  return [...new Set([...text.matchAll(/\/\*[\s\S]*?\*\//g)].map(match=>match[0]).filter(block=>/copyright/i.test(block)&&/licen[cs]e|permission/i.test(block)))].join('\n\n');
}

const lockBytes=await readFile(lockPath);
const lock=JSON.parse(lockBytes.toString('utf8'));
const sections=[];const missing=[];let fileCount=0;let packageCount=0;
for(const [location,entry]of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b,'en'))){
  if(!location||entry.dev===true)continue;
  const packageRoot=resolve(frontend,location);inside(packageRoot,frontend);
  const metadata=JSON.parse(await readFile(resolve(packageRoot,'package.json'),'utf8'));
  if(!metadata.name||metadata.version!==entry.version)throw Error(`Installed package does not match lockfile: ${location}`);
  const label=`${metadata.name}@${metadata.version}`;
  const texts=[];
  for(const path of await findLicenses(packageRoot)){
    const bytes=await readFile(path);
    texts.push({bytes,source:`${location}/${relative(packageRoot,path).replaceAll('\\','/')}\nSHA-256: ${sha256(bytes)}`});
  }
  for(const source of upstream[label]||[])texts.push(await upstreamText(source));
  if(label==='@mediapipe/tasks-vision@0.10.17'){
    texts.push(await extracted(packageRoot,'vision.d.ts',noticeBlocks));
    texts.push(await extracted(packageRoot,'vision_bundle.mjs.map',text=>noticeBlocks(JSON.parse(text).sourcesContent.join('\n'))));
  }
  if(label==='draco3d@1.5.9')texts.push(await extracted(packageRoot,'draco_nodejs_example.js',text=>text.match(/^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))\s*)+/)?.[0]));
  if(label==='maath@0.10.8'){
    texts.push(await extracted(packageRoot,'package.json',text=>text));
    texts.push(await extracted(packageRoot,'dist/easing-0f4db1c0.esm.js',noticeBlocks));
  }
  if(label==='stats-gl@2.4.2'){
    texts.push(await extracted(packageRoot,'package.json',text=>text));
    texts.push(await extracted(packageRoot,'README.md',text=>{const start=text.lastIndexOf('## 📜 License');return start<0?'':text.slice(start);}));
  }
  packageCount++;
  if(!texts.length)missing.push({package:label,location,declaredLicense:metadata.license??entry.license??'not specified'});
  fileCount+=texts.length;
  sections.push(`\n${'='.repeat(78)}\n${label}\nInstalled path: ${location}\nDeclared license: ${metadata.license??entry.license??'not specified'}\n${'='.repeat(78)}\n`+
    (caveats[label]?`\nProvenance limitation: ${caveats[label]}\n`:'')+
    (texts.length?texts.map(({bytes,source})=>`\nSource: ${source}\n\n${bytes.toString('utf8')}${bytes.at(-1)===10?'':'\n'}`).join(''):'\nMISSING: no license-named file exists in this installed package; no copyright or license text has been invented.\n'));
}
const header=`MemoryBox third-party production dependency notices\n\nGenerated by frontend/scripts/collect-runtime-licenses.mjs.\nInput: frontend/package-lock.json (SHA-256 ${sha256(lockBytes)}).\nProduction package directories: ${packageCount}. License/notice sources: ${fileCount}. Packages without any notice evidence: ${missing.length}.\n\nThis collection includes all package-lock entries not marked dev=true, including\ntransitive packages, type packages, optional decoders and packages later removed\nby tree-shaking. Listing a package does not create a runtime or network request.\nOriginal license and notice texts follow without rewriting their contents.\n\nUpstream provenance limitations (read the corresponding package sections):\n${Object.entries(caveats).map(([name,note])=>`- ${name}: ${note}`).join('\n')}\n\nPackages without any notice evidence:\n${missing.length?missing.map(item=>`- ${item.package} (${item.location}); declared ${item.declaredLicense}`).join('\n'):'None.'}\n`;
await writeFile(destination,header+sections.join(''),'utf8');
console.log(JSON.stringify({output:relative(project,destination),packages:packageCount,sources:fileCount,missing},null,2));
