// Rebuild the two CC0 runtime GLBs with Node's standard library; no decoder or npm dependency.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
const sha256=data=>createHash('sha256').update(data).digest('hex');
const md5=data=>createHash('md5').update(data).digest('hex');
const padded=data=>Buffer.concat([data,Buffer.alloc((4-data.length%4)%4)]);
const records=[];
async function download(path,entry){
  let data;try{data=await readFile(path);}catch{}
  if(!data||md5(data)!==entry.md5){const response=await fetch(entry.url);if(!response.ok)throw Error(`${response.status}: ${entry.url}`);data=Buffer.from(await response.arrayBuffer());}
  if(data.length!==entry.size||md5(data)!==entry.md5)throw Error(`Source integrity mismatch: ${entry.url}`);
  await mkdir(dirname(path),{recursive:true});await writeFile(path,data);
  records.push({path:path.slice(root.length+1).replaceAll('\\','/'),url:entry.url,bytes:data.length,md5:entry.md5,sha256:sha256(data)});
  return data;
}
for(const id of ['television_02','chinese_armchair']){
  const apiUrl=`https://api.polyhaven.com/files/${id}`;
  const api=await (await fetch(apiUrl)).json();const source=api.gltf['1k'].gltf;
  await mkdir(resolve(root,id),{recursive:true});
  await writeFile(resolve(root,id,'polyhaven-files.json'),JSON.stringify(api,null,2)+'\n');
  const doc=JSON.parse(await download(resolve(root,id,`${id}_1k.gltf`),source));
  const files=new Map();
  for(const [uri,entry]of Object.entries(source.include))files.set(uri,await download(resolve(root,id,uri),entry));
  const chunks=[],offsets=[];let offset=0;
  for(const buffer of doc.buffers){const data=padded(files.get(buffer.uri));offsets.push(offset);chunks.push(data);offset+=data.length;}
  for(const view of doc.bufferViews){view.byteOffset=(view.byteOffset||0)+offsets[view.buffer];view.buffer=0;}
  for(const image of doc.images){const original=files.get(image.uri);image.bufferView=doc.bufferViews.length;image.mimeType='image/jpeg';delete image.uri;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:original.length});const data=padded(original);chunks.push(data);offset+=data.length;}
  doc.buffers=[{byteLength:offset}];
  // Poly Haven's ARM red channel is baked AO; preserve it as an occlusion map as well.
  for(const material of doc.materials||[]){if(material.pbrMetallicRoughness?.metallicRoughnessTexture)material.occlusionTexture={...material.pbrMetallicRoughness.metallicRoughnessTexture};}
  if(JSON.stringify(doc.extensionsRequired||[]).match(/draco|meshopt/i))throw Error('Unexpected decoder requirement');
  const json=Buffer.from(JSON.stringify(doc));const jsonChunk=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);const binary=Buffer.concat(chunks);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+binary.length,8);
  const jsonHeader=Buffer.alloc(8);jsonHeader.writeUInt32LE(jsonChunk.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,jsonHeader,jsonChunk,binHeader,binary]);const output=resolve(root,'..',`${id}-1k.glb`);await writeFile(output,glb);
  records.push({path:`../${id}-1k.glb`,derivedFrom:apiUrl,bytes:glb.length,sha256:sha256(glb),triangles:doc.accessors[doc.meshes[0].primitives[0].indices].count/3});
  console.log(`${id}: ${glb.length} bytes; ${doc.images.length} embedded images; bounds ${JSON.stringify(doc.accessors[0].min)}..${JSON.stringify(doc.accessors[0].max)}`);
}
await writeFile(resolve(root,'manifest.json'),JSON.stringify({license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',retrievedAt:new Date().toISOString(),records},null,2)+'\n');
