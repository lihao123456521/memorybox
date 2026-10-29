import type {RoomZone,TemplateId} from './types';

export default function WorldMap({templateId,zone}:{templateId:TemplateId;zone:RoomZone}){
  const rooms=templateId==='station'?[
    {id:'platform',label:'站台',x:7,y:7,w:69,h:59},{id:'concourse',label:'候车厅',x:7,y:68,w:69,h:36},{id:'carriage',label:'车厢',x:82,y:18,w:42,h:58},
  ]:templateId==='classroom'?[
    {id:'classroom',label:'教室',x:7,y:7,w:80,h:97},{id:'corridor',label:'走廊',x:91,y:7,w:34,h:97},
  ]:[
    {id:'study',label:'书房',x:7,y:7,w:35,h:37},{id:'bedroom',label:'卧室',x:7,y:47,w:35,h:48},
    {id:'kitchen',label:'厨房',x:45,y:7,w:47,h:37},{id:'living',label:'客厅',x:45,y:47,w:47,h:57},{id:'balcony',label:'阳台',x:95,y:51,w:30,h:44},
  ];
  return <svg viewBox="0 0 132 112" role="img" aria-hidden="true">{rooms.map(r=><g key={r.id}><rect x={r.x} y={r.y} width={r.w} height={r.h} className={zone===r.id?'map-active':''}/><text x={r.x+r.w/2} y={r.y+r.h/2+3}>{r.label}</text></g>)}</svg>;
}
