import type {Branch,TemplateId} from './types';
export function storyDuration(template:TemplateId,branch:Branch|null){return template==='station'?(branch==='imagined'?24:20):template==='classroom'?16:13;}
export function storyCue(template:TemplateId,branch:Branch|null,departure:boolean,time:number){
  if(branch==='real'&&!departure)return {index:Math.min(2,Math.floor(time/4)),label:'记得的选择，保持原样',action:'陪伴者静静听你讲述；不添加未经确认的离开或结局。'};
  if(template==='station'){
    const delay=branch==='imagined'?4:0;
    if(time<3+delay)return {index:0,label:branch==='imagined'?'再认真告别一次':'出发前的叮嘱',action:'陪伴者留在站台上，把叮嘱与告别慢慢说完。'};
    if(time<8+delay)return {index:1,label:'站台上的挥手',action:'走到黄线内侧，转身向列车挥手。'};
    if(time<9+delay)return {index:2,label:'发车前的最后一眼',action:'车门关闭，发车信号亮起；列车即将离站。'};
    return {index:2,label:'列车驶向远方',action:'发车信号亮起，车轮转动，整列车渐渐驶离站台。'};
  }
  if(template==='classroom')return time<3?{index:0,label:'把那句话留下',action:branch==='imagined'?'想象把感谢说出口，朋友抬头回应。':'朋友抬头，重温你确认的告别。'}:time<12.7?{index:1,label:'走过熟悉的过道',action:'朋友从课桌间的通道走到后排门旁。'}:{index:2,label:'门边的一次挥手',action:'停步、回望、挥手；让这段时光慢慢落幕。'};
  return time<3?{index:0,label:branch==='imagined'?'把告别放慢一点':'傍晚的告别',action:'熟悉的节目还在播放，陪伴者留下一点时间听你讲述。'}:time<(branch==='imagined'?8.3:7.7)?{index:1,label:branch==='imagined'?'再多聊一会儿':'走到门旁',action:branch==='imagined'?'沿沙发旁走到桌边，停下来说说话。':'沿空出的通道走向门旁，准备送别。'}:{index:2,label:branch==='imagined'?'平凡的下午，被轻轻延长':'把牵挂留在挥手里',action:'停步与挥手，把这一刻留在记忆里；由你决定何时珍藏。'};
}
