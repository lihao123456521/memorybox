let context:AudioContext|null=null;
let bed:GainNode|null=null;
export function setSound(enabled:boolean){
  if(!enabled){if(bed&&context)bed.gain.setTargetAtTime(0,context.currentTime,.3);return;}
  context??=new AudioContext();void context.resume();
  if(!bed){
    bed=context.createGain();bed.gain.value=0;bed.connect(context.destination);
    [130.81,196,261.63].forEach((f,i)=>{const o=context!.createOscillator();const g=context!.createGain();o.type='sine';o.frequency.value=f;g.gain.value=i===0?.04:.014;o.connect(g).connect(bed!);o.start();});
  }
  bed.gain.setTargetAtTime(.45,context.currentTime,.7);
}
export function chime(){
  if(!context||!bed||bed.gain.value<.01)return;
  [523.25,659.25,783.99].forEach((f,i)=>{const o=context!.createOscillator();const g=context!.createGain();const at=context!.currentTime+i*.10;o.frequency.value=f;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.035,at+.025);g.gain.exponentialRampToValueAtTime(.0001,at+1.3);o.connect(g).connect(context!.destination);o.start(at);o.stop(at+1.35);});
}
