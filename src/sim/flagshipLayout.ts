import type { Point } from './model';

/**
 * One actual, logo-fitted two-sided deck plan.
 *
 * The flagship points toward +X. Upper/North and Lower/South each have
 * 3 x 2 parking slots; the old 6x4 player room grid sits between them.
 * These coordinates are consumed by the renderer, hangar simulation,
 * autopilot, collider and camera. Never retype them in other modules.
 */
export type HangarSide = 'north' | 'south';
export const HANGAR_SIDES: readonly HangarSide[] = ['north','south'] as const;
export const SIDE_SIGN: Readonly<Record<HangarSide,-1|1>>={north:-1,south:1};
export const BERTHS_PER_TIER=4;
export const MAX_PARKING_TIERS=3;
export const SIDE_BERTH_X: readonly [number,number]=[-240,-145];
export const SIDE_BERTH_Y: readonly [number,number,number]=[106,161,216];
export const PARKING_BAY={width:77,height:52} as const;
export const SIDE_HANGAR_RECT={x:-282,width:220,inner:77,outer:244} as const;
export const SIDE_PORT_X=-75;
export const SIDE_PORT_Y=250;
export const SIDE_TRACTOR_Y=272;
export const SIDE_APPROACH_Y=480;
export const SIDE_DEPARTURE_Y=802;
export const SIDE_SERVICE_X=-75;
/** Clearance from berth center toward main spine, outside parked hulls. */
export const SERVICE_LANE_INSET=28;

export function sideForBerth(index:number):HangarSide {
  return index%BERTHS_PER_TIER<2?'north':'south';
}
export function sideForY(y:number):HangarSide {return y<0?'north':'south';}
export function berthTier(index:number):number {
  return Math.floor(index/BERTHS_PER_TIER);
}
export function berthAnchor(index:number,span=1):Point {
  const side=sideForBerth(index);
  const pair=index%2;
  const x=span>=2
    ?(SIDE_BERTH_X[0]+SIDE_BERTH_X[1])/2
    :SIDE_BERTH_X[pair];
  const tier=Math.max(0,Math.min(MAX_PARKING_TIERS-1,berthTier(index)));
  return {x,y:SIDE_SIGN[side]*SIDE_BERTH_Y[tier]};
}
export function berthHeading(index:number):number {
  return SIDE_SIGN[sideForBerth(index)]*Math.PI/2;
}
export interface HangarFloor {
  x:number;y:number;width:number;height:number;
}
export function hangarFloor(side:HangarSide,tiers:number):HangarFloor {
  const rows=Math.max(1,Math.min(MAX_PARKING_TIERS,Math.ceil(tiers)));
  const halfOuter=SIDE_BERTH_Y[rows-1]+PARKING_BAY.height/2+2;
  const halfInner=SIDE_HANGAR_RECT.inner;
  return {
    x:SIDE_HANGAR_RECT.x,
    y:side==='north'?-halfOuter:halfInner,
    width:SIDE_HANGAR_RECT.width,
    height:halfOuter-halfInner,
  };
}
export function portLocal(side:HangarSide):{
  entrance:Point;approach:Point;departure:Point;tractor:Point;
} {
  const sign=SIDE_SIGN[side];
  return {
    entrance:{x:SIDE_PORT_X,y:sign*SIDE_PORT_Y},
    approach:{x:SIDE_PORT_X,y:sign*SIDE_APPROACH_Y},
    departure:{x:SIDE_PORT_X,y:sign*SIDE_DEPARTURE_Y},
    tractor:{x:SIDE_PORT_X,y:sign*SIDE_TRACTOR_Y},
  };
}
export function serviceRow(berth:Point,side:HangarSide):number {
  // Approach from the middle, never through an occupied adjacent parking row.
  return berth.y-SIDE_SIGN[side]*SERVICE_LANE_INSET;
}
