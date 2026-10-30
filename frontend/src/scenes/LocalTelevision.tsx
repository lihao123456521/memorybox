import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {readStoryPlaying,readStoryTime} from './StoryActions';
import type {StoryTiming} from './StoryActions';

// Original, offline canvas animation: clouds, a paper kite, walking animals and
// a quiet house. It is a television programme, never presented as user footage.
export function drawTelevisionFrame(c:CanvasRenderingContext2D,t:number,powered:boolean,playing:boolean){
  const w=512,h=384;
  c.clearRect(0,0,w,h);
  if(!powered){
    c.fillStyle='#141c20';c.fillRect(0,0,w,h);const glow=c.createRadialGradient(255,170,10,255,170,260);glow.addColorStop(0,'#354348');glow.addColorStop(1,'#11181b');c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.strokeStyle='#c3cbb315';c.lineWidth=2;c.beginPath();c.moveTo(25,65);c.quadraticCurveTo(260,15,470,105);c.stroke();
    c.fillStyle='#bdc6ba';c.font='17px sans-serif';c.textAlign='center';c.fillText('待机 · 触碰电视，留住这一刻',256,337);return;
  }
  const sky=c.createLinearGradient(0,0,0,300);sky.addColorStop(0,'#789ca1');sky.addColorStop(.6,'#dec9a3');sky.addColorStop(1,'#e8b98b');c.fillStyle=sky;c.fillRect(0,0,w,h);
  c.fillStyle='#f5ddb0';c.beginPath();c.arc(385,91,37,0,Math.PI*2);c.fill();
  const cloud=(x:number,y:number,s:number)=>{c.fillStyle='#f1e7d0';c.beginPath();c.ellipse(x,y,41*s,12*s,0,0,Math.PI*2);c.ellipse(x-18*s,y-8*s,19*s,17*s,0,0,Math.PI*2);c.ellipse(x+9*s,y-12*s,23*s,19*s,0,0,Math.PI*2);c.fill();};
  cloud((90+t*7)%670-80,75,.8);cloud((330+t*4)%680-80,132,.55);
  c.fillStyle='#8ca58b';c.beginPath();c.moveTo(0,238);c.bezierCurveTo(85,180,140,184,244,227);c.bezierCurveTo(360,162,445,190,512,220);c.lineTo(512,384);c.lineTo(0,384);c.fill();
  c.fillStyle='#718969';c.beginPath();c.moveTo(0,278);c.bezierCurveTo(140,214,310,255,512,247);c.lineTo(512,384);c.lineTo(0,384);c.fill();
  c.fillStyle='#d9ba8e';c.beginPath();c.moveTo(0,318);c.quadraticCurveTo(266,271,512,316);c.lineTo(512,355);c.quadraticCurveTo(244,315,0,355);c.fill();
  const cycle=t%18;
  if(cycle<10){
    const kiteX=292+Math.sin(t*.8)*35,kiteY=105+Math.sin(t*1.2)*14;
    c.strokeStyle='#f1e4c4';c.lineWidth=1.5;c.beginPath();c.moveTo(220,283);c.quadraticCurveTo(264,196,kiteX,kiteY+28);c.stroke();
    c.fillStyle='#b65d46';c.beginPath();c.moveTo(kiteX,kiteY-26);c.lineTo(kiteX+21,kiteY);c.lineTo(kiteX,kiteY+29);c.lineTo(kiteX-21,kiteY);c.closePath();c.fill();c.strokeStyle='#f2d5a3';c.beginPath();c.moveTo(kiteX,kiteY-26);c.lineTo(kiteX,kiteY+29);c.moveTo(kiteX-21,kiteY);c.lineTo(kiteX+21,kiteY);c.stroke();
    for(let i=0;i<3;i++){const y=kiteY+39+i*12,x=kiteX+Math.sin(t*2-i)*7;c.fillStyle='#e9bc74';c.beginPath();c.moveTo(x-7,y-4);c.lineTo(x+7,y+4);c.lineTo(x+7,y-4);c.lineTo(x-7,y+4);c.fill();}
    const animal=(x:number,y:number,rabbit:boolean)=>{
      const bounce=Math.sin(t*5+(rabbit?1:0))*2,step=Math.sin(t*5+(rabbit?1:0))*6;
      c.fillStyle=rabbit?'#e5d4ae':'#b98f65';c.beginPath();c.ellipse(x,y+bounce,23,29,0,0,Math.PI*2);c.fill();
      c.fillStyle=rabbit?'#eee2c4':'#bd966b';c.beginPath();c.arc(x,y-31+bounce,22,0,Math.PI*2);c.fill();
      for(const side of [-1,1]){c.beginPath();c.ellipse(x+side*13,y-(rabbit?61:48)+bounce,rabbit?6:9,rabbit?21:10,side*.12,0,Math.PI*2);c.fill();}
      c.fillStyle='#4e493b';c.beginPath();c.arc(x+8,y-34+bounce,2.3,0,Math.PI*2);c.fill();c.beginPath();c.arc(x+18,y-26+bounce,2,0,Math.PI*2);c.fill();
      c.strokeStyle=rabbit?'#e5d4ae':'#b98f65';c.lineCap='round';c.lineWidth=10;
      for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*9,y+20+bounce);c.lineTo(x+side*9+side*step,y+36);c.stroke();}
      c.fillStyle=rabbit?'#ad6850':'#667c7a';c.fillRect(x-19,y-9+bounce,38,14);
    };
    animal(167+Math.sin(t*.3)*19,278,false);animal(227+Math.sin(t*.3)*19,287,true);
  }else{
    c.fillStyle='#e5d6af';c.fillRect(168,170,172,126);c.fillStyle='#975e49';c.beginPath();c.moveTo(145,174);c.lineTo(252,105);c.lineTo(365,174);c.closePath();c.fill();
    c.fillStyle='#685e46';c.fillRect(230,224,41,72);c.fillStyle='#efc77f';for(const x of [184,287])c.fillRect(x,195,32,35);
    c.fillStyle='#a65e48';for(const x of [183,286]){c.beginPath();c.moveTo(x,194);c.lineTo(x+12+Math.sin(t*1.6)*2,194);c.lineTo(x+8,231);c.lineTo(x,231);c.fill();}
    c.strokeStyle='#f3dfb377';c.lineWidth=5;c.beginPath();c.moveTo(312,125);c.bezierCurveTo(295+Math.sin(t)*8,99,331,90,318+Math.sin(t)*14,66);c.stroke();
    c.fillStyle='#526f52';for(let i=0;i<6;i++){c.beginPath();c.ellipse(78+i*9,269-i*13,9,23,Math.sin(t*1.2+i)*.1+.6,0,Math.PI*2);c.fill();}
  }
  c.fillStyle='#223c3a99';c.fillRect(0,0,512,37);c.fillStyle='#f3e7c8';c.textAlign='left';c.font='bold 17px sans-serif';c.fillText('小小剧场',26,26);c.font='12px sans-serif';c.fillText('原创动画 · 晚风里的纸鸢',258,25);
  c.fillStyle='#263b36d9';c.fillRect(0,346,512,38);c.fillStyle='#f3dfb9';c.font='16px sans-serif';c.textAlign='center';c.fillText(cycle<10?'慢一点，让这一刻多停留一会儿。':'窗里的灯，为晚归的人亮着。',256,370);
  c.fillStyle=playing?'#c5e1b8':'#e7ba77';c.beginPath();c.arc(25,325,4,0,Math.PI*2);c.fill();c.font='12px sans-serif';c.textAlign='left';c.fillText(playing?'播放中':'已暂停',36,329);
  if(!playing){c.fillStyle='#233330b0';c.fillRect(221,150,70,67);c.fillStyle='#f2e2c0';c.fillRect(240,166,10,34);c.fillRect(263,166,10,34);}
  c.fillStyle='#302d290c';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
  const vignette=c.createRadialGradient(256,190,130,256,190,310);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#151b1966');c.fillStyle=vignette;c.fillRect(0,0,w,h);
}

export function useTelevisionProgramme(props:StoryTiming,powered:boolean){
  const {gl}=useThree(),last=useRef('');
  const programme=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;const context=canvas.getContext('2d')!;drawTelevisionFrame(context,0,false,false);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;return {context,texture};},[]);
  useEffect(()=>()=>programme.texture.dispose(),[programme]);
  useFrame(()=>{
    const time=readStoryTime(props),playing=powered&&readStoryPlaying(props),frame=powered?Math.floor(time*(props.reducedMotion?8:15)):0,key=`${powered}-${playing}-${frame}`;
    if(key!==last.current){drawTelevisionFrame(programme.context,frame/(props.reducedMotion?8:15),powered,playing);programme.texture.needsUpdate=true;last.current=key;}
    gl.domElement.dataset.tvPower=powered?'on':'standby';gl.domElement.dataset.tvPlaying=String(playing);gl.domElement.dataset.tvFrame=String(frame);gl.domElement.dataset.tvProgramme='original-canvas-animation';
  });
  return programme.texture;
}
