import { HOME } from './model';
import type { GameState, Point, Ship } from './model';
import {
  berthAnchor, berthHeading, sideForBerth, HANGAR_SIDES, portLocal,
  BERTHS_PER_TIER, MAX_PARKING_TIERS, SIDE_HANGAR_RECT,
} from './flagshipLayout';
import type { HangarSide } from './flagshipLayout';

/**
 * The mothership is one ARROW hull with two mirrored internal hangars.
 * Preserve legacy berth indices, but re-map their PHYSICAL positions into
 * North and South banks with the player-built rooms in the middle.
 */
const starterPort=portLocal('north');
const world=(local:Point):Point=>({x:HOME.x+local.x,y:HOME.y+local.y});
export const MOTHERSHIP={
  halfWidth:585,
  halfHeight:442,
  entrance:world(starterPort.entrance),
  approach:world(starterPort.approach),
  departure:world(starterPort.departure),
  hangar:{
    x:SIDE_HANGAR_RECT.x,y:-SIDE_HANGAR_RECT.outer,
    width:SIDE_HANGAR_RECT.width,
    height:SIDE_HANGAR_RECT.outer-SIDE_HANGAR_RECT.inner,
  },
} as const;

/** Wide ships need a pair of adjacent bays on the SAME side and row. */
export const BERTH_COLUMNS=BERTHS_PER_TIER;
export const MAX_BERTHS=BERTHS_PER_TIER*MAX_PARKING_TIERS;

export function shipBerthSpan(ship:Pick<Ship,'role'|'capacity'>):number {
  if(/capital|heavy|large/i.test(ship.role)||ship.capacity>=180)return 3;
  if(/miner|industrial|hauler/i.test(ship.role)||ship.capacity>=80)return 2;
  return 1;
}
export function hangarCapacity(state:Pick<GameState,'rooms'>):number {
  return Math.min(MAX_BERTHS,state.rooms.filter(room=>room.type==='hangar')
    .reduce((capacity,room)=>capacity+4*room.level,0));
}
export interface DockingPort {
  entrance:Point;approach:Point;departure:Point;tractor:Point;
  side:HangarSide;
}
export function dockingPort(
  _state:Pick<GameState,'rooms'>, side:HangarSide='north',
):DockingPort {
  // Both airlocks stay within the two shoulders of the actual logo.
  // Upgrades add genuine inner bay rows instead of long appendages hanging
  // outside the ship.
  const local=portLocal(side);
  return {
    side,
    entrance:world(local.entrance),
    approach:world(local.approach),
    departure:world(local.departure),
    tractor:world(local.tractor),
  };
}
export { HANGAR_SIDES, sideForBerth, berthHeading };
export type { HangarSide };
export function berthRange(index:number,span:number):number[] {
  return Array.from({length:span},(_,i)=>index+i);
}
function fitsAt(index:number,span:number,limit:number):boolean {
  return Number.isInteger(index)&&index>=0&&span>=1&&span<=2 &&
    index+span<=limit &&
    (span===1||index%BERTHS_PER_TIER===0||index%BERTHS_PER_TIER===2);
}
export function findAvailableBerth(state:GameState,ship:Ship):number|null {
  const limit=hangarCapacity(state),span=shipBerthSpan(ship);
  const occupied=new Set<number>();
  for(const other of state.ships) {
    if(other.id===ship.id||other.berth===undefined ||
      (!other.docked&&!other.navigation))continue;
    for(const slot of berthRange(other.berth,shipBerthSpan(other)))occupied.add(slot);
  }
  // Keep assignments stable across saves and ship switching.
  if(ship.berth!==undefined&&fitsAt(ship.berth,span,limit) &&
      berthRange(ship.berth,span).every(i=>!occupied.has(i)))return ship.berth;
  for(let i=0;i<limit;i++){
    if(fitsAt(i,span,limit)&&berthRange(i,span).every(slot=>!occupied.has(slot)))
      return i;
  }
  return null;
}
export function berthLocalPosition(index:number,span=1):Point {
  return berthAnchor(index,span);
}
export function berthWorldPosition(ship:Ship):Point {
  return world(berthLocalPosition(ship.berth??0,shipBerthSpan(ship)));
}
export function reconcileBerths(state:GameState):void {
  const docked=state.ships.filter(ship=>ship.docked);
  const saved=new Map(docked.map(ship=>[ship.id,ship.berth]));
  docked.sort((a,b)=>(a.berth??Infinity)-(b.berth??Infinity));
  for(const ship of docked)ship.berth=undefined;
  for(const ship of docked){
    ship.berth=saved.get(ship.id);
    const slot=findAvailableBerth(state,ship);
    if(slot===null){
      const side=sideForBerth(ship.berth??0);
      const port=dockingPort(state,side);
      ship.docked=false;
      ship.berth=undefined;
      ship.mode=ship.id===state.activeShipId?'manual':'hold';
      ship.x=port.departure.x;
      ship.y=port.departure.y;
      continue;
    }
    ship.berth=slot;
    const position=berthWorldPosition(ship);
    ship.x=position.x;ship.y=position.y;
    ship.angle=berthHeading(slot);
  }
}
export function dockedBerthCount(state:GameState):number {
  return state.ships.filter(ship=>ship.docked)
    .reduce((count,ship)=>count+shipBerthSpan(ship),0);
}
