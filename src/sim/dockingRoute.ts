import { HOME } from './model';
import type { Point } from './model';
import { MOTHERSHIP } from './hangar';

export type DockStage = 'align' | 'approach' | 'tractor' | 'entry' | 'taxi' | 'clearance';
export interface DockWaypoint {
  point: Point;
  stage: DockStage;
  speed: number; // world units / second, segment length determines duration
  heading?: number;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function ringPoint(angle:number, radius:number):Point {
  return {x:HOME.x + Math.cos(angle)*radius,y:HOME.y + Math.sin(angle)*radius};
}

/**
 * Route from the CURRENT physical ship position. No forced moves to staging
 * coordinates and no path straight through the solid capital ship.
 * Approach arcs are always outside the 700-unit clearance ring.
 */
export function dockingRoute(from:Point, berth:Point,port:typeof MOTHERSHIP=MOTHERSHIP):DockWaypoint[] {
  const radius=780;
  const initial=Math.atan2(from.y-HOME.y,from.x-HOME.x);
  const final=Math.atan2(port.approach.y-HOME.y,port.approach.x-HOME.x);
  const delta=normalizeAngle(final-initial);
  const count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/7)));
  const route:DockWaypoint[]=[
    {point:ringPoint(initial,radius),stage:'align',speed:360},
  ];
  for(let i=1;i<=count;i++){
    route.push({point:ringPoint(initial+delta*i/count,radius),stage:'align',speed:415});
  }
  route.push(
    {point:port.approach,stage:'approach',speed:350},
    {point:{x:port.entrance.x,y:port.entrance.y-100},stage:'tractor',speed:230},
    {point:port.entrance,stage:'entry',speed:150},
    {point:{x:port.entrance.x,y:HOME.y-246},stage:'taxi',speed:145},
    {point:{x:berth.x,y:HOME.y-180},stage:'taxi',speed:125},
    {point:berth,stage:'taxi',speed:95,heading:0},
  );
  return route;
}

/**
 * Reverse the physical voyage. The berth stays reserved until the last stage
 * completes and the craft is outside the mothership clearance radius.
 */
export function departureRoute(from:Point,port:typeof MOTHERSHIP=MOTHERSHIP):DockWaypoint[] {
  return [
    {point:{x:from.x,y:HOME.y-180},stage:'taxi',speed:110},
    {point:{x:port.entrance.x,y:HOME.y-246},stage:'taxi',speed:135},
    {point:port.entrance,stage:'entry',speed:145},
    {point:{x:port.entrance.x,y:port.entrance.y-115},stage:'tractor',speed:225},
    {point:port.departure,stage:'clearance',speed:365,heading:-Math.PI/2},
  ];
}

export function segmentDuration(from:Point,to:Point,speed:number):number {
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  return Math.round(1000*Math.max(.08,distance/Math.max(1,speed)));
}

export function shortestAngle(from:number,to:number):number {
  return from + normalizeAngle(to-from);
}

/** Tractor assist starts at a consistent, visible section of the outer lane. */
export function inTractorStage(stage:DockStage):boolean {
  return stage==='tractor'||stage==='entry';
}
