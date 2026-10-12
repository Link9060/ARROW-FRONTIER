import { FLAGSHIP_OUTLINE } from './arrowGeometry';
import { HOME } from './model';
import type { Point } from './model';
import { dockingPort, hangarCapacity } from './hangar';
import { HANGAR_SIDES, hangarFloor } from './flagshipLayout';
import type { GameState } from './model';

export function insidePolygon(point:Point,vertices:readonly (readonly [number,number])[]):boolean {
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[i],b=vertices[j];
    const crosses=(a[1]>point.y)!==(b[1]>point.y);
    if(crosses && point.x<
      (b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0]){
      inside=!inside;
    }
  }
  return inside;
}

function insideRect(p:Point,x:number,y:number,w:number,h:number):boolean {
  return p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h;
}

/**
 * A single conservative collision region shared by manual piloting and
 * renderer physical dimensions. The cinematic autopilot is authorized to
 * cross the side airlock; regular flight is not.
 */
export function hitsMothership(world:Point,state:Pick<GameState,'rooms'>,padding=17):boolean {
  const local={x:world.x-HOME.x,y:world.y-HOME.y};
  // The official mark's actual concave tail shape determines most collisions.
  if(insidePolygon(local,FLAGSHIP_OUTLINE))return true;
  const tiers=Math.max(1,Math.ceil(hangarCapacity(state)/4));
  const pad=Math.max(0,padding);
  for(const side of HANGAR_SIDES){
    const floor=hangarFloor(side,tiers);
    // These compartments stay inside the logo; the small side-port collar
    // may project beyond the outline, so it needs an explicit collider.
    if(insideRect(local,floor.x-pad,floor.y-pad,
      floor.width+2*pad,floor.height+2*pad))return true;
    const port=dockingPort(state,side);
    const doorX=port.entrance.x-HOME.x,doorY=port.entrance.y-HOME.y;
    if(insideRect(local,doorX-42-pad,doorY-17-pad,
      84+2*pad,34+2*pad))return true;
  }
  return false;
}

export function resolveHullMovement(old:Point,wanted:Point,
  state:Pick<GameState,'rooms'>):Point {
  if(!hitsMothership(wanted,state))return wanted;
  // Recover older saves spawned in an armored compartment: allow the craft
  // to steer outward rather than trapping it forever inside a solid collider.
  if(hitsMothership(old,state) &&
    Math.hypot(wanted.x-HOME.x,wanted.y-HOME.y)>
    Math.hypot(old.x-HOME.x,old.y-HOME.y))return wanted;
  // Slide along walls where possible instead of freezing the whole ship.
  const horizontal={x:wanted.x,y:old.y};
  if(!hitsMothership(horizontal,state))return horizontal;
  const vertical={x:old.x,y:wanted.y};
  if(!hitsMothership(vertical,state))return vertical;
  return old;
}
