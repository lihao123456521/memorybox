import { build } from 'vite';
import { readFile, writeFile, readdir, stat, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {Script} from 'node:vm';

const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=resolve(frontend,'..');
const assetRoot=resolve(frontend,'public','assets');
const outDir=resolve(frontend,'.portable-build');
const destination=resolve(project,'index.html');
const presetIds=['young-man','elder-man','young-woman','elder-woman'];
const mime={'.glb':'model/gltf-binary','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.hdr':'application/octet-stream'};
const textureFiles=[
  'wood_floor_diff_1k.jpg','wood_floor_nor_gl_1k.jpg','wood_floor_rough_1k.jpg',
  'painted_plaster_wall_diff_1k.jpg','painted_plaster_wall_nor_gl_1k.jpg','painted_plaster_wall_rough_1k.jpg',
  'fabric_pattern_07_col_1_1k.jpg','fabric_pattern_07_col_2_1k.jpg','fabric_pattern_07_nor_gl_1k.jpg','fabric_pattern_07_rough_1k.jpg'
];

function assertInside(path,parent) {
  const rel=relative(parent,path);
  if(rel.startsWith('..')||rel.split(sep).some(segment=>segment==='..'))throw Error(`Refusing a path outside the project: ${path}`);
}
function extension(file){return file.slice(file.lastIndexOf('.')).toLowerCase();}
function parseGlb(bytes,label) {
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw Error(`Invalid glTF binary: ${label}`);
  if(bytes.readUInt32LE(8)!==bytes.length)throw Error(`Incomplete GLB: ${label}`);
  const jsonLength=bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8').trim());
}

await mkdir(outDir,{recursive:true});
try {
  const files=[...presetIds.flatMap(id=>[`models/${id}.glb`,`models/${id}-seated.glb`]),...textureFiles.map(f=>`textures/${f}`),'images/family-photo.png','environments/lebombo_1k.hdr','props/television_02-1k.glb','props/chinese_armchair-1k.glb'];
  // Older runtime avatar builds keep skin maps beside the GLB. Include only the four referenced runtime skins.
  const charactersSource=await readFile(resolve(frontend,'src','scenes','Characters.tsx'),'utf8');
  if(charactersSource.includes('/assets/models/skins/')){
    for(const id of presetIds)files.push(`models/skins/${id}.webp`);
  }
  const characterMaterials=JSON.parse(await readFile(resolve(assetRoot,'models','character-materials.json'),'utf8'));
  for(const entry of characterMaterials)for(const url of [entry.color,entry.normal].filter(Boolean)){
    if(!url.startsWith('/assets/models/materials/'))throw Error('Character material escaped the runtime asset directory.');
    const file=url.slice('/assets/'.length);if(!files.includes(file))files.push(file);
  }
  const assets={};const inventory=[];const glbs=[];
  for(const file of files){
    const path=resolve(assetRoot,file);assertInside(path,assetRoot);
    const bytes=await readFile(path);const type=mime[extension(file)];
    if(!type)throw Error(`Unsupported runtime asset: ${file}`);
    const key=`/assets/${file.replaceAll('\\','/')}`;
    assets[key]=`data:${type};base64,${bytes.toString('base64')}`;
    inventory.push({path:key,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    if(file.endsWith('.glb'))glbs.push({file,json:parseGlb(bytes,file)});
  }
  // Do not silently ship GLBs that depend on an unbundled external image/buffer or decoder.
  for(const {file,json}of glbs){
    for(const resource of [...(json.images||[]),...(json.buffers||[])]){
      if(!resource.uri||resource.uri.startsWith('data:'))continue;
      const resolved=`/assets/${file.slice(0,file.lastIndexOf('/')+1)}${resource.uri}`;
      if(!assets[resolved])throw Error(`GLB ${file} has an unbundled resource: ${resource.uri}`);
    }
    if((json.extensionsRequired||[]).some(e=>['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(e)))throw Error(`Portable GLB needs an external decoder: ${file}`);
  }
  console.log(`Embedding ${inventory.length} approved runtime assets (${(inventory.reduce((n,a)=>n+a.bytes,0)/1048576).toFixed(1)} MiB raw).`);
  await build({configFile:resolve(frontend,'vite.portable.config.ts'),root:frontend});
  const built=await readdir(outDir);
  const js=await readFile(resolve(outDir,'memorybox.js'),'utf8');
  if(/\bimport\s*\(/.test(js))throw Error('The portable bundle still contains a runtime dynamic import.');
  const css=(await Promise.all(built.filter(f=>f.endsWith('.css')).map(f=>readFile(resolve(outDir,f),'utf8')))).join('\n');
  const unsafeCssUrls=[...css.matchAll(/url\(\s*['"]?([^)'"\s]+)/g)].map(m=>m[1]).filter(u=>!u.startsWith('data:')&&!u.startsWith('#')&&!decodeURIComponent(u).startsWith('#'));
  if(unsafeCssUrls.length)throw Error(`CSS requires external resources: ${unsafeCssUrls.join(', ')}`);
  const builtAt=new Date().toISOString();
  const metadata={version:'0.3.0',assetCount:inventory.length,builtAt,mode:'single-html-local-demo'};
  const prelude=`window.__MEMORYBOX_PORTABLE__=${JSON.stringify(metadata)};window.__MEMORYBOX_ASSETS__=${JSON.stringify(assets)};`;
  let html=await readFile(resolve(frontend,'index.html'),'utf8');
  // Carry the original runtime dependency notices with the standalone file too.
  const licenses=await readFile(resolve(project,'THIRD_PARTY_LICENSES.txt'),'utf8');
  if(!licenses.includes('Permission is hereby granted'))throw Error('Runtime third-party license texts are missing.');
  const licenseHtml=licenses.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  html=html.replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi,'');
  // A callback keeps literal $&, $` and $' in bundled JavaScript from expanding as replacement tokens.
  html=html.replace('</head>',()=>`<style>${css.replace(/<\/style/gi,'<\\/style')}</style></head>`);
  html=html.replace('</body>',()=>`<details id="memorybox-third-party-licenses" hidden><summary>Third-party licenses</summary><pre>${licenseHtml}</pre></details><script>${prelude}</script><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body>`);
  const inlineScripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if(inlineScripts.length!==2)throw Error('Portable HTML has an unexpected script boundary.');
  inlineScripts.forEach((match,index)=>new Script(match[1],{filename:`memorybox-inline-${index}.js`}));
  if(/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)/i.test(html))throw Error('The generated HTML still refers to an external script or stylesheet.');
  assertInside(destination,project);await writeFile(destination,html,'utf8');
  const report={...metadata,output:'index.html',bytes:(await stat(destination)).size,sha256:createHash('sha256').update(html).digest('hex'),licensesSha256:createHash('sha256').update(licenses).digest('hex'),assets:inventory};
  await writeFile(resolve(outDir,'portable-build-report.json'),JSON.stringify(report,null,2),'utf8');
  console.log(`Portable HTML ready: ${destination}`);
  console.log(`Size ${(report.bytes/1048576).toFixed(1)} MiB; sha256 ${report.sha256}`);
} finally {
  // Keep only the small reproducibility report. The temporary IIFE and CSS are already in root index.html.
  for(const file of await readdir(outDir)){
    if(file==='portable-build-report.json')continue;
    const path=resolve(outDir,file);assertInside(path,outDir);await rm(path,{recursive:true,force:true});
  }
}
