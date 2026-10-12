import {
  cargoTotal, distance, DOCK_RADIUS, HOME, MINE_RANGE,
  OFFLINE_CAP_SECONDS, storedTotal, WORLD,
} from './model';
import type { Asteroid, GameState, Ship } from './model';
import { runIndustry } from './mothership';
import { berthWorldPosition, findAvailableBerth, MOTHERSHIP } from './hangar';

export type DockResult = 'docked' | 'too-far' | 'already-docked' | 'hangar-full';

export function activeShip(state: GameState): Ship {
  const ship = state.ships.find((item) => item.id === state.activeShipId);
  if (!ship) throw new Error('Active ship not found');
  return ship;
}

export function switchShip(state: GameState, nextId: string): boolean {
  if (nextId === state.activeShipId) return false;
  const next = state.ships.find((ship) => ship.id === nextId);
  if (!next) return false;
  const previous = activeShip(state);
  previous.mode = previous.docked ? 'hold' : 'auto';
  next.mode = 'manual';
  state.activeShipId = nextId;
  return true;
}

export function launchShip(ship: Ship): boolean {
  if (!ship.docked) return false;
  ship.docked = false;
  // Launch outside the physical mothership hull, not inside its exterior.
  ship.berth = undefined;
  ship.x = MOTHERSHIP.departure.x;
  ship.y = MOTHERSHIP.departure.y;
  ship.angle = -Math.PI / 2;
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
  ship.angle = -Math.PI / 2;
  depositCargo(state, ship);
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

export function runAutomation(state: GameState, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  runIndustry(state, seconds);
  for (const ship of state.ships) {
    if (ship.id === state.activeShipId || ship.mode !== 'auto') continue;
    if (ship.docked) {
      if (storedTotal(state.stored) >= state.storageCapacity) { ship.mode = 'hold'; continue; }
      launchShip(ship);
    }

    const full = cargoTotal(ship.cargo) >= ship.capacity - 0.001;
    const target = nearestDeposit(state, ship);
    if (full || !target || storedTotal(state.stored) >= state.storageCapacity) {
      if (travel(ship, HOME, seconds, DOCK_RADIUS - 10)) {
        const result = dockShip(state, ship);
        if (result === 'hangar-full') ship.mode = 'hold';
        else if (storedTotal(state.stored) >= state.storageCapacity || !target) ship.mode = 'hold';
      }
      continue;
    }

    if (travel(ship, target, seconds, 110)) {
      extractOre(state, ship, target, ship.miningRate * seconds);
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
