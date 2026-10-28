import type { Branch, CollectionEntry, Draft, Story } from './types';
const API = (import.meta as unknown as {env:Record<string,string>}).env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
let token='';
function ownerToken() {
  if(token) return token;
  try { token=localStorage.getItem('memorybox-owner')||''; }catch { /* ephemeral owner when storage is disabled */ }
  if(!token) { token=crypto.randomUUID()+crypto.randomUUID(); try{localStorage.setItem('memorybox-owner',token);}catch{ /* session only */ } }
  return token;
}
async function request<T>(path:string, options:RequestInit={}):Promise<T> {
  if(location.protocol==='file:')throw new Error('便携离线版仅在此浏览器保存，不连接本机服务。');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetch(`${API}${path}`,{...options,headers:{'Content-Type':'application/json','X-MemoryBox-Token':ownerToken(),...options.headers},signal:controller.signal});
    const body=await response.json();
    if(!response.ok) throw new Error(body.error?.message||`保存服务返回 ${response.status}`);
    return body as T;
  }finally{clearTimeout(timeout);}
}
export const health=()=>request<{status:string;mode:string}>('/api/health');
export const compose=(draft:Draft)=>request<Story>('/api/memories/compose',{method:'POST',body:JSON.stringify(draft)});
export const createMemory=(draft:Draft,story:Story,clientId?:string)=>request<{id:string;story:Story}>('/api/memories',{method:'POST',headers:clientId?{'Idempotency-Key':clientId}:{},body:JSON.stringify({draft,story})});
export const saveLetter=(id:string,recipient:string,text:string,branch:Branch,clientId?:string)=>request<{id:string;memoryId:string;clientId?:string;createdAt:string}>(`/api/memories/${id}/letters`,{method:'POST',headers:clientId?{'Idempotency-Key':clientId}:{},body:JSON.stringify({recipient,text,branch})});
export const deleteMemory=(id:string)=>request<unknown>(`/api/memories/${id}`,{method:'DELETE'});
interface StoredMemory { id:string;draft:Draft;story:Story;createdAt:string;letters:{id:string;clientId?:string;recipient:string;text:string;branch:Branch;createdAt:string}[] }
export async function fetchCollection():Promise<CollectionEntry[]> {
  const records=await request<StoredMemory[]>('/api/memories');
  return records.flatMap(m=>(m.letters||[]).map(l=>({id:l.id,clientId:l.clientId,memoryId:m.id,title:m.story.title,draft:m.draft,story:m.story,branch:l.branch,recipient:l.recipient,text:l.text,createdAt:l.createdAt,synced:true})));
}
