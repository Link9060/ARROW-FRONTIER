import { HOME } from './model';
import { SHIP_ZONES } from './arrowGeometry';
import type { GameState, Point, Ship } from './model';

/**
 * World-space measurements shared by the simulator and the cinematic renderer.
 * The mothership is intentionally ~20 times longer than a starter scout.
 */
export const MOTHERSHIP = {
  halfWidth: 585,
  halfHeight: 442,
  /** The upper SIDE hangar is physically mounted to the broad shoulder. */
  entrance: { x: HOME.x + SHIP_ZONES.airlock.x, y: HOME.y + SHIP_ZONES.airlock.y },
  approach: { x: HOME.x + SHIP_ZONES.airlock.x, y: HOME.y - 502 },
  departure: { x: HOME.x + SHIP_ZONES.airlock.x, y: HOME.y - 830 },
  hangar: { x: -283, y: -187, width: 567, height: 375 },
} as const;

/** Hangar slots are contiguous parking units. Wide ships occupy neighboring slots. */
export const BERTH_COLUMNS = 4;
export const MAX_BERTHS = 12;

export function shipBerthSpan(ship: Pick<Ship, 'role' | 'capacity'>): number {
  if (/capital|heavy|large/i.test(ship.role) || ship.capacity >= 180) return 3;
  if (/miner|industrial|hauler/i.test(ship.role) || ship.capacity >= 80) return 2;
  return 1;
}

export function hangarCapacity(state: Pick<GameState, 'rooms'>): number {
  return Math.min(MAX_BERTHS, state.rooms
    .filter((room) => room.type === 'hangar')
    .reduce((capacity, room) => capacity + 4 * room.level, 0));
}

export interface DockingPort {
  entrance:Point; approach:Point; departure:Point; tractor:Point;
}
/**
 * Hangar growth moves the physical side entrance and tractor along the newly
 * constructed outer plating. Nothing clips through later parking rows.
 */
export function dockingPort(state:Pick<GameState,'rooms'>):DockingPort {
  const extraRows=Math.max(0,Math.ceil(hangarCapacity(state)/BERTH_COLUMNS)-1);
  const shift=-138*extraRows;
  const move=(point:Point):Point=>({x:point.x,y:point.y+shift});
  return {
    entrance:move(MOTHERSHIP.entrance),
    approach:move(MOTHERSHIP.approach),
    departure:move(MOTHERSHIP.departure),
    tractor:move({x:HOME.x+SHIP_ZONES.tractor.x,y:HOME.y+SHIP_ZONES.tractor.y}),
  };
}

export function berthRange(index: number, span: number): number[] {
  return Array.from({ length: span }, (_, i) => index + i);
}

function fitsAt(index: number, span: number, max: number): boolean {
  return Number.isInteger(index) && span > 0 && span <= 2 && index >= 0 &&
    index + span <= max && index % BERTH_COLUMNS + span <= BERTH_COLUMNS &&
    // A two-unit craft cannot straddle the center taxi lane.
    (span === 1 || index % BERTH_COLUMNS === 0 || index % BERTH_COLUMNS === 2);
}

export function findAvailableBerth(state: GameState, ship: Ship): number | null {
  const limit = hangarCapacity(state);
  const span = shipBerthSpan(ship);
  const occupied = new Set<number>();
  for (const other of state.ships) {
    if (other.id === ship.id || !other.docked || other.berth === undefined) continue;
    for (const slot of berthRange(other.berth, shipBerthSpan(other))) occupied.add(slot);
  }
  // Keep a ship's existing berth when it has one and nobody else occupies it.
  if (ship.berth !== undefined && fitsAt(ship.berth, span, limit) &&
      berthRange(ship.berth, span).every((slot) => !occupied.has(slot))) return ship.berth;
  for (let berth = 0; berth < limit; berth++) {
    if (fitsAt(berth, span, limit) &&
        berthRange(berth, span).every((slot) => !occupied.has(slot))) return berth;
  }
  return null;
}

export function berthLocalPosition(index: number, span = 1): Point {
  const row = Math.floor(index / BERTH_COLUMNS);
  const col = index % BERTH_COLUMNS;
  const columnCenters=[-212,-109,109,212];
  const x=span===1?columnCenters[col]:(columnCenters[col]+columnCenters[col+1])/2;
  return { x, y: -119 - row * 138 };
}

export function berthWorldPosition(ship: Ship): Point {
  const berth = ship.berth ?? 0;
  const local = berthLocalPosition(berth, shipBerthSpan(ship));
  return { x: HOME.x + local.x, y: HOME.y + local.y };
}

/**
 * Repair berth indices in legacy saves and assign ships deterministically,
 * preserving the list order whenever possible. No duplicate slots.
 */
export function reconcileBerths(state: GameState): void {
  const docked = state.ships.filter((ship) => ship.docked);
  const saved = new Map(docked.map((ship) => [ship.id, ship.berth]));
  // Preserve old parking spots wherever possible instead of reshuffling
  // everyone whenever a second ship docks or the player reloads.
  docked.sort((a, b) => (a.berth ?? Infinity) - (b.berth ?? Infinity));
  for (const ship of docked) ship.berth = undefined;
  for (const ship of docked) {
    ship.berth = saved.get(ship.id);
    const slot = findAvailableBerth(state, ship);
    if (slot === null) {
      // Legacy saves with too many docked ships are placed safely outside.
      ship.docked = false;
      ship.mode = ship.id === state.activeShipId ? 'manual' : 'hold';
      ship.x = MOTHERSHIP.departure.x;
      ship.y = MOTHERSHIP.departure.y;
      continue;
    }
    ship.berth = slot;
    const position = berthWorldPosition(ship);
    ship.x = position.x;
    ship.y = position.y;
    ship.angle = -Math.PI / 2;
  }
}

export function dockedBerthCount(state: GameState): number {
  return state.ships
    .filter((ship) => ship.docked)
    .reduce((count, ship) => count + shipBerthSpan(ship), 0);
}
