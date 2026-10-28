import type {RoomZone} from '../types';
export interface Collider {xMin:number;xMax:number;zMin:number;zMax:number}
export const EYE_HEIGHT=1.64;
export const WALK_START:[number,number,number]=[0,EYE_HEIGHT,2.5];
export const WALK_RADIUS=.20;
export function roomZone(x:number,z:number):RoomZone {
  if(x>4)return 'balcony';
  if(z < -3.5)return 'kitchen';
  return 'living';
}
export function inFloorPlan(x:number,z:number,r=WALK_RADIUS){
  return (x>=-4+r&&x<=4-r&&z>=-6.8+r&&z<=3.5-r)||(x>=4-r&&x<=6.8-r&&z>=-2.8+r&&z<=2.8-r);
}
export function canStand(x:number,z:number,colliders:Collider[]){
  if(!inFloorPlan(x,z))return false;
  return !colliders.some(c=>x>c.xMin-WALK_RADIUS&&x<c.xMax+WALK_RADIUS&&z>c.zMin-WALK_RADIUS&&z<c.zMax+WALK_RADIUS);
}
export function moveWithCollisions(x:number,z:number,dx:number,dz:number,colliders:Collider[]){
  // Separate axes allow natural sliding along a wall without ever passing through it.
  let nx=x,nz=z;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  for(let i=0;i<steps;i++){
    if(canStand(nx+dx/steps,nz,colliders))nx+=dx/steps;
    if(canStand(nx,nz+dz/steps,colliders))nz+=dz/steps;
  }
  return {x:nx,z:nz};
}
