import {
  cargoTotal, distance, DOCK_RADIUS, HOME, MINE_RANGE,
  OFFLINE_CAP_SECONDS, storedTotal, WORLD,
} from './model';
import type { Asteroid, FleetOrder, GameState, Ship } from './model';
import { runIndustry } from './mothership';
import { berthWorldPosition, findAvailableBerth, sideForBerth, berthHeading } from './hangar';
import { portLocal } from './flagshipLayout';
import { advanceFleetNavigation, beginFleetDock, beginFleetLaunch } from './fleetNavigation';

export type DockResult = 'docked' | 'too-far' | 'already-docked' | 'hangar-full';

export function activeShip(state: GameState): Ship {
  const ship = state.ships.find((item) => item.id === state.activeShipId);
  if (!ship) throw new Error('Active ship not found');
  return ship;
}

/**
 * Fleet orders persist independently of control. Existing 0.6.2 auto
 * miners implicitly keep the Mine order; idle/manual ships default to Hold.
 */
export function shipOrder(ship:Ship):FleetOrder {
  return ship.order ?? (ship.mode==='auto'?'mine':'hold');
}

export type FleetOrderResult='assigned'|'active-ship'|'not-found';
export function assignShipOrder(state:GameState,id:string,order:FleetOrder):FleetOrderResult {
  const ship=state.ships.find(member=>member.id===id);
  if(!ship)return 'not-found';
  // The manually piloted vessel must remain under player control.
  if(id===state.activeShipId)return 'active-ship';
  if(order==='hold'){
    ship.order='hold';
    // Finish an active airlock taxi safely before stopping. Parking halfway
    // through a hatch would obstruct both hangars.
    ship.mode=ship.navigation?'auto':'hold';
    ship.turnaround=0;
    return 'assigned';
  }
  if(order==='return'&&ship.docked){
    ship.order='hold';
    ship.mode='hold';
    ship.turnaround=0;
    return 'assigned';
  }
  ship.order=order;
  ship.mode='auto';
  // Explicit dispatch overrides the passive post-unload dwell. Automatic
  // repeat trips still retain their short turnaround delay.
  if(order==='mine'||order==='return')ship.turnaround=0;
  return 'assigned';
}

export function switchShip(state:GameState,nextId:string):boolean {
  if(nextId===state.activeShipId)return false;
  const next=state.ships.find(ship=>ship.id===nextId);
  if(!next||next.navigation)return false;
  const previous=activeShip(state);
  if(previous.docked){
    previous.order='hold';
    previous.mode='hold';
  }else{
    // A ship you finish manually piloting resumes mining by default.
    previous.order=previous.order==='return'?'return':'mine';
    previous.mode='auto';
  }
  next.mode='manual';
  state.activeShipId=nextId;
  return true;
}

export function launchShip(ship: Ship): boolean {
  if (!ship.docked) return false;
  const previousSide=sideForBerth(ship.berth??0);
  const localDeparture=portLocal(previousSide).departure;
  ship.docked=false;
  ship.navigation=undefined;
  ship.berth=undefined;
  ship.x=HOME.x+localDeparture.x;
  ship.y=HOME.y+localDeparture.y;
  ship.angle=previousSide==='north'?-Math.PI/2:Math.PI/2;
  return true;
}

export function depositCargo(state: GameState, ship: Ship): number {
  if (distance(ship, HOME) > DOCK_RADIUS) return 0;
  const free = Math.max(0, state.storageCapacity - storedTotal(state.stored));
  let deposited = 0;
  for (const ore of ['iron', 'copper'] as const) {
    const quantity = Math.min(ship.cargo[ore], free - deposited);
    if (quantity <= 0) continue;
    ship.cargo[ore] -= quantity;
    state.stored[ore] += quantity;
    deposited += quantity;
  }
  return deposited;
}

export function dockShip(state: GameState, ship: Ship): DockResult {
  if (ship.docked) return 'already-docked';
  if (distance(ship, HOME) > DOCK_RADIUS) return 'too-far';
  const berth = findAvailableBerth(state, ship);
  if (berth === null) return 'hangar-full';
  ship.docked = true;
  ship.berth = berth;
  const position = berthWorldPosition(ship);
  ship.x = position.x;
  ship.y = position.y;
  ship.angle=berthHeading(berth);
  ship.navigation=undefined;
  depositCargo(state,ship);
  // Give autonomous ships a real unloading interval instead of disappearing
  // into a berth and instantly spawning outside in the same frame.
  if(ship.mode==='auto'&&shipOrder(ship)==='mine')ship.turnaround=1.6;
  return 'docked';
}

export function extractOre(state: GameState, ship: Ship, asteroid: Asteroid, quantity: number): number {
  if (ship.docked || asteroid.remaining <= 0 || !Number.isFinite(quantity) || quantity <= 0) return 0;
  if (distance(ship, asteroid) > MINE_RANGE) return 0;
  const free = ship.capacity - cargoTotal(ship.cargo);
  const mined = Math.max(0, Math.min(quantity, free, asteroid.remaining));
  if (mined <= 0) return 0;
  ship.cargo[asteroid.ore] += mined;
  asteroid.remaining -= mined;
  state.lifetimeMined += mined;
  return mined;
}

export function nearestDeposit(state: GameState, ship: Ship): Asteroid | undefined {
  let nearest: Asteroid | undefined;
  let best = Infinity;
  for (const asteroid of state.asteroids) {
    if (asteroid.remaining <= 0) continue;
    const d = distance(ship, asteroid);
    if (d < best) { best = d; nearest = asteroid; }
  }
  return nearest;
}

function travel(ship: Ship, destination: { x: number; y: number }, seconds: number, tolerance: number): boolean {
  const dx = destination.x - ship.x;
  const dy = destination.y - ship.y;
  const current = Math.hypot(dx, dy);
  if (current <= tolerance) return true;
  const allowed = Math.min(Math.max(0, seconds) * ship.speed, current - tolerance);
  ship.x += (dx / current) * allowed;
  ship.y += (dy / current) * allowed;
  ship.angle = Math.atan2(dy, dx);
  ship.x = Math.min(WORLD.width - 35, Math.max(35, ship.x));
  ship.y = Math.min(WORLD.height - 35, Math.max(35, ship.y));
  return distance(ship, destination) <= tolerance + 0.001;
}

/** Explain a ship's current work without confusing a held ship with a broken AI. */
export function fleetShipStatus(state:GameState,ship:Ship):string {
  if(ship.id===state.activeShipId)return 'PILOTING';
  if(ship.navigation){
    const side=ship.navigation.side==='north'?'A':'B';
    const action=ship.navigation.kind==='launch'?'LAUNCHING':'DOCKING';
    return action+' · HANGAR '+side;
  }
  if(ship.mode==='hold'||shipOrder(ship)==='hold')
    return ship.docked?'DOCKED · IDLE':'HOLDING POSITION';
  const order=shipOrder(ship);
  if(order==='return')return ship.docked?'DOCKED · IDLE':'RETURNING TO BASE';
  const cargo=cargoTotal(ship.cargo);
  const space=state.storageCapacity-storedTotal(state.stored);
  const oreAvailable=state.asteroids.some(asteroid=>asteroid.remaining>0);
  if(!ship.docked && (cargo>=ship.capacity-.001||
      space<=.001||!oreAvailable) &&
      distance(ship,HOME)<=DOCK_RADIUS &&
      findAvailableBerth(state,ship)===null)
    return 'WAITING · HANGAR FULL';
  if(ship.docked){
    if(cargo>.001&&space<=.001)return 'WAITING · STORAGE FULL';
    if(cargo>.001)return 'WAITING · UNLOAD SPACE';
    if(space<=.001)return 'WAITING · STORAGE FULL';
    if(!oreAvailable)return 'WAITING · NO ORE';
    if((ship.turnaround??0)>.01)return 'UNLOADING · '+ship.turnaround!.toFixed(1)+'s';
    return 'DISPATCHING';
  }
  if(cargo>=ship.capacity-.001)return 'RETURNING · CARGO FULL';
  if(space<=.001)return 'RETURNING · STORAGE FULL';
  if(!oreAvailable)return 'RETURNING · NO ORE';
  return 'MINING · '+Math.round(cargo)+' / '+ship.capacity;
}

/**
 * Each independent ship ticks through Mine → Return → Dock → Unload →
 * Relaunch. Only explicit Hold/Recall orders stop this loop. Full storage
 * or exhausted asteroids cause visible waiting, not a silent mission loss.
 */
export function runAutomation(state:GameState,seconds:number):void {
  if(!Number.isFinite(seconds)||seconds<=0)return;
  runIndustry(state,seconds);
  for(const ship of state.ships){
    if(ship.id===state.activeShipId||ship.mode!=='auto')continue;
    const order=shipOrder(ship);

    // Physical routes run independently of the active player's cinematic.
    // Finish any already occupied airlock before handling a new order.
    if(ship.navigation){
      const complete=advanceFleetNavigation(state,ship,seconds);
      if(complete==='docked'){
        const result=dockShip(state,ship);
        if(result!=='docked'){
          // A berth cannot be reassigned while reserved, but recover safely
          // from any corrupted or conflicting saved berth.
          ship.navigation=undefined;
          ship.berth=undefined;
          continue;
        }
        if(order==='return'||order==='hold'){
          ship.mode='hold';ship.order='hold';ship.turnaround=0;
        }
      }else if(complete==='launched'&&order==='hold'){
        ship.mode='hold';ship.order='hold';
      }
      continue;
    }

    if(order==='hold'){ship.mode='hold';continue;}
    if(ship.docked){
      if(order==='return'){
        ship.mode='hold';ship.order='hold';ship.turnaround=0;
        continue;
      }
      // If storage was full, keep any undelivered ore on board and try
      // again as soon as the mothership has available capacity.
      if(cargoTotal(ship.cargo)>.001)depositCargo(state,ship);
      if(cargoTotal(ship.cargo)>.001)continue;
      if(storedTotal(state.stored)>=state.storageCapacity-.001)continue;
      if(!state.asteroids.some(asteroid=>asteroid.remaining>0))continue;
      if((ship.turnaround??0)>0){
        ship.turnaround=Math.max(0,(ship.turnaround??0)-seconds);
        continue;
      }
      if(beginFleetLaunch(ship))ship.turnaround=0;
      continue;
    }

    const full=cargoTotal(ship.cargo)>=ship.capacity-.001;
    const target=nearestDeposit(state,ship);
    const returnHome=order==='return'||full||!target||
      storedTotal(state.stored)>=state.storageCapacity-.001;
    if(returnHome){
      if(travel(ship,HOME,seconds,DOCK_RADIUS-10)){
        const berth=findAvailableBerth(state,ship);
        if(berth!==null)beginFleetDock(ship,berth);
        // A full hangar is a queueing condition. Mission persists until a
        // space opens; don't replace it with Hold.
      }
      continue;
    }
    if(travel(ship,target,seconds,110)){
      extractOre(state,ship,target,ship.miningRate*seconds);
    }
  }
}

/**
 * Process real elapsed wall-clock time for deterministic game systems.
 * Unlike clamping the entire frame to 50 ms, this preserves production
 * speed on lower frame rates and splits long frames for stable autopilot.
 */
export function advanceActiveSimulation(state: GameState, elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  const elapsed = Math.min(elapsedSeconds, 2);
  let remaining = elapsed;
  while (remaining > 0.00000001) {
    const step = Math.min(0.05, remaining);
    runAutomation(state, step);
    remaining -= step;
  }
  return elapsed;
}

export function simulateOffline(state: GameState, elapsedSeconds: number): number {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.min(OFFLINE_CAP_SECONDS, Math.max(0, Math.floor(elapsedSeconds))) : 0;
  for (let remaining = elapsed; remaining > 0;) {
    const step = Math.min(2, remaining);
    runAutomation(state, step);
    remaining -= step;
  }
  return elapsed;
}

export function roundCargo(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
