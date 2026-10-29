import type {AnchorId,RoomZone} from '../types';
export interface Collider {xMin:number;xMax:number;zMin:number;zMax:number}
export interface Zone extends Collider {id:RoomZone;label:string}
export interface WorldLayout {id:string;zones:readonly Zone[];start:[number,number,number];overview:[number,number,number];target:[number,number,number];anchors:Record<AnchorId,[number,number,number]>;colliders:Collider[];}
export const EYE_HEIGHT=1.64;
export const WALK_START:[number,number,number]=[0,EYE_HEIGHT,2.5];
export const WALK_RADIUS=.20;
export function roomZone(x:number,z:number,layout?:WorldLayout):RoomZone {
  if(layout)return layout.zones.find(b=>x>=b.xMin&&x<=b.xMax&&z>=b.zMin&&z<=b.zMax)?.id||layout.zones[0].id;
  if(x<-4)return z<-3.5?'study':'bedroom';
  if(x>4)return 'balcony';
  if(z < -3.5)return 'kitchen';
  return 'living';
}
export function inFloorPlan(x:number,z:number,r=WALK_RADIUS,layout?:WorldLayout){
  const zones=layout?.zones||[{xMin:-4,xMax:4,zMin:-6.8,zMax:3.5},{xMin:4,xMax:6.8,zMin:-2.8,zMax:2.8},{xMin:-9,xMax:-4,zMin:-7,zMax:1}];
  // Check the full player circle against the union, so adjoining doorways remain traversable.
  return Array.from({length:8},(_,i)=>i*Math.PI/4).every(a=>zones.some(b=>x+Math.cos(a)*r>=b.xMin&&x+Math.cos(a)*r<=b.xMax&&z+Math.sin(a)*r>=b.zMin&&z+Math.sin(a)*r<=b.zMax));
}
export function canStand(x:number,z:number,colliders:Collider[],layout?:WorldLayout){
  if(!inFloorPlan(x,z,WALK_RADIUS,layout))return false;
  return !colliders.some(c=>x>c.xMin-WALK_RADIUS&&x<c.xMax+WALK_RADIUS&&z>c.zMin-WALK_RADIUS&&z<c.zMax+WALK_RADIUS);
}
export function moveWithCollisions(x:number,z:number,dx:number,dz:number,colliders:Collider[],layout?:WorldLayout){
  // Separate axes allow natural sliding along a wall without ever passing through it.
  let nx=x,nz=z;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  for(let i=0;i<steps;i++){
    if(canStand(nx+dx/steps,nz,colliders,layout))nx+=dx/steps;
    if(canStand(nx,nz+dz/steps,colliders,layout))nz+=dz/steps;
  }
  return {x:nx,z:nz};
}
