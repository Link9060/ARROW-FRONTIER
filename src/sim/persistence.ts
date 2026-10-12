import { makeNewGame, ROOM_GRID, starterRooms, WORLD } from './model';
import type { Cargo, GameState, Resources, Room, RoomType, Ship } from './model';
import { simulateOffline } from './engine';
import { capacityFor } from './mothership';

const SAVE_KEY = 'arrow-frontier-expansion-v2';
const LEGACY_KEY = 'arrow-frontier-first-flight-v1';
const ROOM_TYPES: RoomType[] = ['command', 'hangar', 'reactor', 'storage', 'refinery', 'fabricator'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function finite(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}
function validCargo(value: unknown): value is Cargo {
  return isRecord(value) && finite(value.iron) && finite(value.copper);
}
function validResources(value: unknown): value is Resources {
  return validCargo(value) && finite((value as Partial<Resources>).alloy);
}
function validShips(value: unknown): value is Ship[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const seen = new Set<string>();
  return value.every((ship: unknown) => {
    if (!isRecord(ship) || typeof ship.id !== 'string' || !ship.id ||
        seen.has(ship.id) || typeof ship.name !== 'string' ||
        !['manual', 'auto', 'hold'].includes(String(ship.mode)) ||
        typeof ship.docked !== 'boolean' || !validCargo(ship.cargo) ||
        !finite(ship.x) || ship.x > WORLD.width || !finite(ship.y) ||
        ship.y > WORLD.height || !finite(ship.angle, -1000) ||
        !finite(ship.capacity, 1) || !finite(ship.speed, 1) ||
        !finite(ship.miningRate, 1)) return false;
    seen.add(ship.id);
    return true;
  });
}
function validAsteroids(value: unknown): boolean {
  return Array.isArray(value) && value.every((a) =>
    isRecord(a) && typeof a.id === 'string' &&
    (a.ore === 'iron' || a.ore === 'copper') &&
    finite(a.x) && finite(a.y) && finite(a.remaining) && finite(a.size)
  );
}
function validBase(value: unknown): value is Record<string, unknown> & { ships: Ship[]; savedAt: number; activeShipId: string; lifetimeMined: number; storageCapacity: number } {
  if (!isRecord(value) || !validShips(value.ships) || !validAsteroids(value.asteroids) ||
      typeof value.activeShipId !== 'string' || !value.ships.some((s) => s.id === value.activeShipId) ||
      !finite(value.savedAt) || !finite(value.lifetimeMined) ||
      !finite(value.storageCapacity)) return false;
  return true;
}
function validRooms(value: unknown): value is Room[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > ROOM_GRID.columns * ROOM_GRID.rows) return false;
  const ids = new Set<string>();
  const locations = new Set<string>();
  for (const room of value) {
    if (!isRecord(room) || typeof room.id !== 'string' || ids.has(room.id) ||
        !ROOM_TYPES.includes(room.type as RoomType) ||
        !Number.isInteger(room.x) || !Number.isInteger(room.y) ||
        (room.x as number) < 0 || (room.x as number) >= ROOM_GRID.columns ||
        (room.y as number) < 0 || (room.y as number) >= ROOM_GRID.rows ||
        !Number.isInteger(room.level) || (room.level as number) < 1 || (room.level as number) > 3 ||
        typeof room.enabled !== 'boolean') return false;
    const key = room.x + ':' + room.y;
    if (locations.has(key)) return false;
    ids.add(room.id);
    locations.add(key);
  }
  return ['command', 'hangar', 'reactor', 'storage'].every((type) =>
    value.some((room) => room.type === type)
  );
}
function validV2(value: unknown): value is GameState {
  if (!validBase(value) || value.version !== 2 || !validResources(value.stored) ||
      !validRooms(value.rooms) || !Number.isInteger(value.nextRoomId) ||
      !finite(value.nextRoomId, 5) || !finite(value.refineryProgress) ||
      value.refineryProgress >= 1 || !finite(value.lifetimeAlloy)) return false;
  return value.ships.every((ship) =>
    isRecord(ship.upgrades) && finite(ship.upgrades.mining) &&
    finite(ship.upgrades.cargo) && Number.isInteger(ship.upgrades.mining) &&
    Number.isInteger(ship.upgrades.cargo) && ship.upgrades.mining <= 3 && ship.upgrades.cargo <= 3
  );
}
function validV1(value: unknown): value is Record<string, unknown> {
  return validBase(value) && value.version === 1 && validCargo(value.stored);
}
function upgradeLegacy(old: Record<string, unknown>): GameState {
  const base = makeNewGame(old.savedAt as number);
  const ships = old.ships as Ship[];
  return {
    ...base,
    savedAt: old.savedAt as number,
    stored: { ...(old.stored as Cargo), alloy: 0 },
    activeShipId: old.activeShipId as string,
    ships: ships.map((ship) => ({ ...ship, upgrades: { mining: 0, cargo: 0 } })),
    asteroids: old.asteroids as GameState['asteroids'],
    lifetimeMined: old.lifetimeMined as number,
    rooms: starterRooms(),
    nextRoomId: 5,
    refineryProgress: 0,
    lifetimeAlloy: 0,
  };
}

export interface LoadResult { state: GameState; offlineSeconds: number; recovered: boolean; migrated: boolean; }
export function loadGame(now = Date.now()): LoadResult {
  try {
    const stored = localStorage.getItem(SAVE_KEY);
    const legacy = stored === null ? localStorage.getItem(LEGACY_KEY) : null;
    const decoded: unknown = JSON.parse(stored ?? legacy ?? 'null');
    const migrated = stored === null && validV1(decoded);
    const loaded = validV2(decoded) ? decoded : migrated ? upgradeLegacy(decoded as Record<string, unknown>) : null;
    if (loaded) {
      loaded.storageCapacity = capacityFor(loaded.rooms);
      const seconds = simulateOffline(loaded, Math.max(0, (now - loaded.savedAt) / 1000));
      loaded.savedAt = now;
      // Immediately write migrated data; old key is retained as a fallback backup.
      if (migrated) saveGame(loaded, now);
      return { state: loaded, offlineSeconds: seconds, recovered: true, migrated };
    }
  } catch (error) {
    console.warn('FRONTIER: save unavailable; starting a new game', error);
  }
  return { state: makeNewGame(now), offlineSeconds: 0, recovered: false, migrated: false };
}
export function saveGame(state: GameState, now = Date.now()): boolean {
  try {
    state.savedAt = now;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('FRONTIER: unable to save progress', error);
    return false;
  }
}
export function resetGame(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
