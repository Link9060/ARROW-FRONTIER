import type { GameState, Ship } from './model';
import { berthWorldPosition, dockingPort, sideForBerth } from './hangar';
import { dockingRoute, departureRoute, shortestAngle } from './dockingRoute';

/**
 * Background fleet departures and arrivals use the SAME physical route
 * geometry as the player's cinematic, but no Phaser tweens or camera state.
 * Route stage indexes and an entry coordinate are small enough to save.
 */
export function beginFleetLaunch(ship:Ship):boolean {
  if(!ship.docked||ship.navigation||ship.berth===undefined)return false;
  const berth=ship.berth;
  ship.navigation={
    kind:'launch',side:sideForBerth(berth),berth,step:0,
    origin:{x:ship.x,y:ship.y},
  };
  // The ship vacates the static berth once it starts taxiing. Its slot stays
  // reserved until it clears the door, preventing intersecting departures.
  ship.docked=false;
  return true;
}

export function beginFleetDock(ship:Ship,berth:number):boolean {
  if(ship.docked||ship.navigation)return false;
  ship.navigation={
    kind:'dock',side:sideForBerth(berth),berth,step:0,
    origin:{x:ship.x,y:ship.y},
  };
  ship.berth=berth;
  return true;
}

export type NavigationCompletion='launched'|'docked'|null;
export function advanceFleetNavigation(state:GameState,ship:Ship,
    seconds:number):NavigationCompletion {
  const nav=ship.navigation;
  if(!nav||!Number.isFinite(seconds)||seconds<=0)return null;
  const port=dockingPort(state,nav.side);
  const berth=berthWorldPosition({...ship,berth:nav.berth});
  const waypoints=nav.kind==='launch'
    ?departureRoute(berth,port)
    :dockingRoute(nav.origin,berth,port);
  let remaining=seconds;
  // Bound the loop even when repeated waypoints share a position.
  for(let guard=0;guard<=waypoints.length&&remaining>0;guard++){
    const waypoint=waypoints[nav.step];
    if(!waypoint)break;
    const dx=waypoint.point.x-ship.x;
    const dy=waypoint.point.y-ship.y;
    const d=Math.hypot(dx,dy);
    const speed=Math.max(10,waypoint.speed);
    const allowed=remaining*speed;
    if(d<=allowed+.00001){
      ship.x=waypoint.point.x;
      ship.y=waypoint.point.y;
      if(d>.001)ship.angle=shortestAngle(ship.angle,Math.atan2(dy,dx));
      if(waypoint.heading!==undefined)
        ship.angle=shortestAngle(ship.angle,waypoint.heading);
      nav.step++;
      remaining-=d/speed;
    }else{
      const fraction=allowed/d;
      ship.x+=dx*fraction;
      ship.y+=dy*fraction;
      ship.angle=shortestAngle(ship.angle,Math.atan2(dy,dx));
      remaining=0;
    }
  }
  if(nav.step<waypoints.length)return null;
  if(nav.kind==='launch'){
    ship.navigation=undefined;
    ship.berth=undefined;
    return 'launched';
  }
  // Caller completes docking atomically through dockShip: unloading, berth
  // reconciliation, and any recall/turnaround decisions happen together.
  return 'docked';
}
