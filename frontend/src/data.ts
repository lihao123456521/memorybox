import type { Draft, Story, TemplateId } from './types';

export const templates = [
  { id:'old-home' as const, name:'家的模样', en:'THE SHAPE OF HOME', number:'01', theme:'亲情 · 陪伴 · 日常', description:'一台旧电视，一只布娃娃，和一个舍不得忘记的夏天。', detail:'完整 3D 旅程', icon:'home' },
  { id:'station' as const, name:'那年，我们选择远方', en:'THE ROAD WE CHOSE', number:'02', theme:'告别 · 选择 · 远方', description:'从候车大厅走到站台，登上那节承载告别的绿皮车。', detail:'独立 3D 车站 · 可进入车厢', icon:'train' },
  { id:'classroom' as const, name:'青春里没说出口的话', en:'WORDS LEFT UNSAID', number:'03', theme:'青春 · 朋友 · 感谢', description:'穿过教室与走廊，再看看课桌上那张折过的纸条。', detail:'独立 3D 教室 · 阳光走廊', icon:'book' },
];

export function exampleDraft(templateId:TemplateId='old-home'):Draft {
  if(templateId==='station') return {templateId,year:'2008',place:'出发那天的火车站',importantPerson:'妈妈',importantObject:'旧皮箱',storyText:'去外地读书的那天，妈妈陪我在车站等车。她又检查了一遍皮箱，把准备好的点心放在最上面。广播响起时，我们走到了站台。',actualChoice:'提起皮箱，和妈妈告别，登上开往远方的列车。'};
  if(templateId==='classroom') return {templateId,year:'2016',place:'毕业前的教室',importantPerson:'好朋友',importantObject:'折过的纸条',storyText:'毕业前的下午，朋友还坐在熟悉的课桌旁。黑板上写着毕业快乐。我把一句谢谢写在纸上，却一直握在手里，没来得及递给她。',actualChoice:'和朋友挥手告别，把那张没递出的纸条带回了家。'};
  return {templateId,year:'2005',place:'奶奶家的客厅',importantPerson:'奶奶',importantObject:'红色布娃娃',storyText:'暑假的下午，奶奶在厨房忙，我抱着她做的布娃娃看电视。窗外有蝉鸣，阳光落在地板上。傍晚，我要和父母回自己家。',actualChoice:'傍晚和父母离开，向奶奶挥手告别。'};
}

export const anchorLabels = { tv:'旧电视', doll:'布娃娃', photo:'旧相框' };
export const anchorSubtitles = {tv:'那些熟悉的声音',doll:'针脚里藏着的心意',photo:'一个平凡的下午'};
export function getAnchorLabels(id:TemplateId='old-home'){
  return id==='station'?{tv:'候车时刻表',doll:'旧皮箱',photo:'那张车票'}:id==='classroom'?{tv:'毕业留言',doll:'折过的纸条',photo:'毕业纪念册'}:anchorLabels;
}
export function getAnchorSubtitles(id:TemplateId='old-home'){
  return id==='station'?{tv:'出发前的几分钟',doll:'行囊里的牵挂',photo:'通向远方的凭证'}:id==='classroom'?{tv:'留下来的字迹',doll:'没能说出口的感谢',photo:'一起走过的日子'}:anchorSubtitles;
}

export function composeLocal(d:Draft):Story {
  const standard=Object.entries(exampleDraft()).every(([key,value])=>d[key as keyof Draft]===value);
  const isHome=d.templateId==='old-home';
  return {
    mode:'template-demo',templateId:d.templateId,scenePreset:d.templateId==='station'?'railway-station':d.templateId==='classroom'?'sunlit-classroom':'old-home-summer',
    title:standard?`${d.year} 年夏天，${d.importantPerson}家的下午`:`${d.year} · ${d.place}`,
    facts:{year:d.year,place:d.place,person:d.importantPerson,object:d.importantObject,actualChoice:d.actualChoice},
    anchors:isHome?[
      {id:'tv',assetId:'old-tv',narration:standard?'电视里放着已经叫不出名字的节目。厨房传来碗筷的轻响。那时觉得，这样的下午，还有很多很多。':`让旧电视成为一段声音的容器。你写下的记忆是：「${d.storyText}」这里的房间是叙事场景，不代表对往事的精确重建。`},
      {id:'doll',assetId:'red-doll',narration:standard?'它的一只眼睛是黑纽扣，另一只总有些歪。奶奶说，这样才认得出来是给我做的。抱在怀里，连针脚都是熟悉的。':`你想珍藏的是「${d.importantObject}」。场景里的布娃娃是它的临时象征。关于它和${d.importantPerson}的故事，只有你能确认；我们不替你补写未曾讲述的过去。`},
      {id:'photo',assetId:'family-frame',narration:standard?'照片里的我们都看着镜头。只有窗外的树，像还在那年夏天轻轻摇晃。原来值得留下来的，也可以只是这样一个普通的下午。':`这是一张虚构的绘本照片，作为记忆的容器。你确认的地点是「${d.place}」，年份是 ${d.year}。真正的那一刻，保留在你的讲述里。`},
    ]:[
      {id:'tv',assetId:d.templateId==='station'?'departure-board':'graduation-board',narration:d.templateId==='station'?`时刻表还亮着。等待的时间，往往比行程本身更让人记得。你讲述的那一天是：「${d.storyText}」\n\n这是一处艺术化的车站场景；真正的声音与细节，以你确认的记忆为准。`:`黑板上的字没有被擦去。你讲述的那天是：「${d.storyText}」\n\n一个学期似乎很长，最后却只剩下一次回头。这间教室承载你的讲述，不替你添加过去。`},
      {id:'doll',assetId:d.templateId==='station'?'leather-suitcase':'folded-letter',narration:d.templateId==='station'?`你想珍藏的是「${d.importantObject}」。行囊装得下衣物和路上的食物，装不下的，是${d.importantPerson}没说完的叮嘱。\n\n这件模型是记忆的象征，细节由你的讲述决定。`:`「${d.importantObject}」安静地留在课桌上。有些心意，在当时很难说出口，过了很多年仍然记得。\n\n你与${d.importantPerson}的故事，以你确认的内容为准。`},
      {id:'photo',assetId:d.templateId==='station'?'paper-ticket':'class-yearbook',narration:d.templateId==='station'?`${d.year}，${d.place}。车票上的起点和终点，是一个人开始独立的坐标。\n\n你确认的重要的人是${d.importantPerson}。模型上的站名与票面只是场景布景，不是对真实车票的复原。`:`${d.year}，${d.place}。纪念册把许多普通的日子装订在一起。\n\n关于${d.importantPerson}的每一页，都留给你自己确认。场景里的字与封面是虚构布景。`},
    ],
    decision:{question:standard?'那天傍晚，你走到了门边。如果能再停留一小会儿，你会怎么度过？':'如果回到那一刻，你想怎样回应这段记忆？',
      real:{label:'重温真实路线',script:[`你记得的选择是：「${d.actualChoice}」`,standard?'你照着记忆走到门边。挥手，告别，像那年一样。那天已经过去，但有人陪伴过你的事实不会改变。':'那一刻被保留为你确认过的样子。我们不替它添加结局，也不评价当年的选择。', '有些日子无法重来。记得本身，也是一种珍惜。']},
      imagined:{label:isHome?'多留一个下午':'把那句话说出来',disclaimer:'AI 想象 · 并非真实历史',script:isHome?[`你在门口停下，转身问${d.importantPerson}：「今天，可以再陪你坐一会儿吗？」`,'灯亮起来，桌边又多了一杯茶。没有什么惊天动地的事，只是把原本匆忙的告别，放慢了一点。','这是你今天为自己写下的一种可能。它不是过去真正发生的事，也不意味着另一条路就一定更好。']:[d.templateId==='station'?`登车前，你转身对${d.importantPerson}说：「别担心，我会好好照顾自己。」`:`你把纸条递给${d.importantPerson}，说出了那句迟到的感谢。`,d.templateId==='station'?'想象中的你放慢脚步，认真地拥抱了一次。列车仍会出发，而告别可以不那么匆忙。':'窗外的光停留在课桌上。话说出口之后，那个普通下午有了另一种温柔的可能。','这是今天写下的可能，不是真实历史；它不会替代你已经走过的路。']}},
    letterPrompt:'把此刻想说的话，留在这里。',ending:'回忆无法重来，但爱可以被重新看见。',
  };
}

export function defaultLetter(d:Draft, recipient:string) {
  const salutation=recipient==='important-person'?`${d.importantPerson}，见字如面：`:recipient==='future-self'?'写给未来的我：':'写给那时的我：';
  return `${salutation}\n\n不要总着急长大。偶尔停一会儿，记住一起吃饭的人，记住房间里阳光落下来的形状。\n\n回想 ${d.year} 年的${d.place}，我仍然珍惜与你一起度过的时光。你会走得很远，也可以一直珍惜走来的路。\n\n愿我们都能把平凡的日子，认真地放在心上。`;
}
