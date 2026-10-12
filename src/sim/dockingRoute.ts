import { HOME } from './model';
import type { Point } from './model';
import { MOTHERSHIP } from './hangar';
import { SERVICE_LANE_INSET } from './flagshipLayout';

export type DockStage='align'|'approach'|'tractor'|'entry'|'taxi'|'clearance';
export interface DockWaypoint {
  point:Point;
  stage:DockStage;
  speed:number;
  heading?:number;
}
type Port=Pick<typeof MOTHERSHIP,'entrance'|'approach'|'departure'>;
const normalizeAngle=(angle:number):number=>
  Math.atan2(Math.sin(angle),Math.cos(angle));
function ringPoint(angle:number,radius:number):Point {
  return {x:HOME.x+Math.cos(angle)*radius,y:HOME.y+Math.sin(angle)*radius};
}
function portSign(port:Port):-1|1 {
  return port.entrance.y<HOME.y?-1:1;
}
function serviceY(berth:Point,port:Port):number {
  return berth.y-portSign(port)*SERVICE_LANE_INSET;
}

/** A shared outside-hull arc leads toward the selected northern OR southern
 * side airlock. Never cut through the flagship to reach the other side. */
export function dockingRoute(from:Point,berth:Point,port:Port=MOTHERSHIP):DockWaypoint[]{
  const radius=770;
  const initial=Math.atan2(from.y-HOME.y,from.x-HOME.x);
  const final=Math.atan2(port.approach.y-HOME.y,port.approach.x-HOME.x);
  const delta=normalizeAngle(final-initial);
  const count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/8)));
  const route:DockWaypoint[]=[
    {point:ringPoint(initial,radius),stage:'align',speed:355},
  ];
  for(let i=1;i<=count;i++){
    route.push({point:ringPoint(initial+delta*i/count,radius),
      stage:'align',speed:400});
  }
  const sign=portSign(port);
  const rowY=serviceY(berth,port);
  route.push(
    {point:port.approach,stage:'approach',speed:355},
    {point:{x:port.entrance.x,y:port.entrance.y+sign*86},
      stage:'tractor',speed:235},
    {point:port.entrance,stage:'entry',speed:160},
    // Free space between the room core and side bay rows is the ONLY taxi
    // route. Center-aisle x is to the right of every parked vessel.
    {point:{x:port.entrance.x,y:rowY},stage:'taxi',speed:145},
    {point:{x:berth.x,y:rowY},stage:'taxi',speed:130},
    {point:berth,stage:'taxi',speed:95,heading:sign*Math.PI/2},
  );
  return route;
}
export function departureRoute(from:Point,port:Port=MOTHERSHIP):DockWaypoint[]{
  const sign=portSign(port);
  const rowY=serviceY(from,port);
  return [
    {point:{x:from.x,y:rowY},stage:'taxi',speed:100},
    {point:{x:port.entrance.x,y:rowY},stage:'taxi',speed:135},
    {point:port.entrance,stage:'entry',speed:145},
    {point:{x:port.entrance.x,y:port.entrance.y+sign*100},
      stage:'tractor',speed:240},
    {point:port.departure,stage:'clearance',speed:370,heading:sign*Math.PI/2},
  ];
}
export function segmentDuration(from:Point,to:Point,speed:number):number {
  return Math.round(1000*Math.max(.08,Math.hypot(to.x-from.x,to.y-from.y)/Math.max(1,speed)));
}
export function shortestAngle(from:number,to:number):number {
  return from+normalizeAngle(to-from);
}
export function inTractorStage(stage:DockStage):boolean {
  return stage==='tractor'||stage==='entry';
}
