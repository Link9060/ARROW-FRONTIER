import { ROOM_GRID, storedTotal } from './model';
import type { GameState, Resources, Room, RoomType, Ship } from './model';

export interface ModuleSpec {
  title: string;
  code: string;
  description: string;
  cost: Resources;
  draw: number;
  priority: number;
}
export const MODULES: Record<RoomType, ModuleSpec> = {
  command: { title: 'Command Bridge', code: 'CMD', description: 'Fleet operations and navigation', cost: { iron: 0, copper: 0, alloy: 0 }, draw: 3, priority: 0 },
  hangar: { title: 'Main Hangar', code: 'HGR', description: 'Stores and launches ships', cost: { iron: 0, copper: 0, alloy: 0 }, draw: 3, priority: 1 },
  storage: { title: 'Cargo Warehouse', code: 'STO', description: '+200 cargo capacity per room', cost: { iron: 22, copper: 8, alloy: 0 }, draw: 1, priority: 2 },
  reactor: { title: 'Fusion Reactor', code: 'PWR', description: '+22 power generation per reactor', cost: { iron: 34, copper: 14, alloy: 0 }, draw: 0, priority: 0 },
  refinery: { title: 'Ore Refinery', code: 'REF', description: '2 iron + 1 copper → 1 alloy / 4 seconds', cost: { iron: 28, copper: 18, alloy: 0 }, draw: 8, priority: 3 },
  fabricator: { title: 'Ship Fabricator', code: 'FAB', description: 'Unlocks mining and cargo upgrades', cost: { iron: 44, copper: 22, alloy: 4 }, draw: 7, priority: 4 },
};
export const BUILDABLE: RoomType[] = ['storage', 'reactor', 'refinery', 'fabricator'];
const DEFAULT_CAPACITY = 200;
const MAX_LEVEL = 3;

export function capacityFor(rooms: Room[]): number {
  return DEFAULT_CAPACITY + rooms
    .filter((room) => room.type === 'storage')
    .reduce((amount, room) => amount + 200 + (room.level - 1) * 150, 0);
}
export function syncCapacity(state: GameState): void {
  state.storageCapacity = capacityFor(state.rooms);
}
export function adjacency(rooms: Room[], x: number, y: number): boolean {
  return rooms.some((room) => Math.abs(room.x - x) + Math.abs(room.y - y) === 1);
}
function insideGrid(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && x < ROOM_GRID.columns && y >= 0 && y < ROOM_GRID.rows;
}
function canPay(stored: Resources, cost: Resources): boolean {
  return stored.iron + 1e-6 >= cost.iron &&
    stored.copper + 1e-6 >= cost.copper &&
    stored.alloy + 1e-6 >= cost.alloy;
}
function spend(stored: Resources, cost: Resources): void {
  stored.iron = Math.max(0, stored.iron - cost.iron);
  stored.copper = Math.max(0, stored.copper - cost.copper);
  stored.alloy = Math.max(0, stored.alloy - cost.alloy);
}
export function canBuild(state: GameState, type: RoomType, x: number, y: number): string | null {
  if (!BUILDABLE.includes(type)) return 'This module cannot be built manually.';
  if (!insideGrid(x, y)) return 'Outside the mothership hull.';
  if (state.rooms.some((room) => room.x === x && room.y === y)) return 'Slot is already occupied.';
  if (!adjacency(state.rooms, x, y)) return 'Modules must connect to an existing room.';
  if (!canPay(state.stored, MODULES[type].cost)) return 'Not enough stored resources.';
  return null;
}
export function buildRoom(state: GameState, type: RoomType, x: number, y: number): string | null {
  const problem = canBuild(state, type, x, y);
  if (problem) return problem;
  spend(state.stored, MODULES[type].cost);
  state.rooms.push({ id: 'room-' + state.nextRoomId++, type, x, y, level: 1, enabled: true });
  syncCapacity(state);
  return null;
}
export function upgradeCost(room: Room): Resources {
  const factor = room.level;
  const base = MODULES[room.type].cost;
  return {
    iron: Math.max(12, Math.ceil(base.iron * 0.8)) * factor,
    copper: Math.max(8, Math.ceil(base.copper * 0.8)) * factor,
    alloy: (room.type === 'refinery' || room.type === 'fabricator' ? 3 : 2) * factor,
  };
}
export function canUpgrade(state: GameState, room: Room): string | null {
  if (!state.rooms.some((entry) => entry.id === room.id)) return 'Room not found.';
  if (!BUILDABLE.includes(room.type)) return 'This room cannot be upgraded.';
  if (room.level >= MAX_LEVEL) return 'Maximum level reached.';
  if (!canPay(state.stored, upgradeCost(room))) return 'Not enough stored resources.';
  return null;
}
export function upgradeRoom(state: GameState, id: string): string | null {
  const room = state.rooms.find((entry) => entry.id === id);
  if (!room) return 'Room not found.';
  const problem = canUpgrade(state, room);
  if (problem) return problem;
  spend(state.stored, upgradeCost(room));
  room.level++;
  syncCapacity(state);
  return null;
}
export function toggleRoom(state: GameState, id: string): string | null {
  const room = state.rooms.find((entry) => entry.id === id);
  if (!room) return 'Room not found.';
  if (room.type === 'command' || room.type === 'hangar' || room.type === 'storage') {
    return 'Core rooms stay enabled.';
  }
  room.enabled = !room.enabled;
  return null;
}
export interface PowerReport {
  output: number;
  load: number;
  demand: number;
  onlineIds: Set<string>;
}
export function powerReport(state: GameState): PowerReport {
  const reactors = state.rooms.filter((room) => room.type === 'reactor' && room.enabled);
  const output = reactors.reduce((sum, reactor) => sum + 22 + (reactor.level - 1) * 10, 0);
  const onlineIds = new Set(reactors.map((room) => room.id));
  const consumers = state.rooms
    .filter((room) => room.enabled && room.type !== 'reactor')
    .sort((a, b) => MODULES[a.type].priority - MODULES[b.type].priority || a.id.localeCompare(b.id));
  let load = 0;
  let demand = 0;
  for (const room of consumers) {
    const draw = MODULES[room.type].draw;
    demand += draw;
    if (load + draw <= output) {
      onlineIds.add(room.id);
      load += draw;
    }
  }
  return { output, load, demand, onlineIds };
}
export function roomOnline(state: GameState, type: RoomType): boolean {
  const powered = powerReport(state).onlineIds;
  return state.rooms.some((room) => room.type === type && powered.has(room.id));
}
export function runIndustry(state: GameState, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const powered = powerReport(state).onlineIds;
  const refineryLevels = state.rooms
    .filter((room) => room.type === 'refinery' && powered.has(room.id))
    .reduce((total, room) => total + room.level, 0);
  if (refineryLevels === 0) return 0;
  const possible = Math.min(
    Math.floor((state.refineryProgress + seconds * refineryLevels / 4) + 1e-8),
    Math.floor(state.stored.iron / 2 + 1e-8),
    Math.floor(state.stored.copper + 1e-8),
  );
  const remainingCapacity = Math.max(0, state.storageCapacity - storedTotal(state.stored));
  // Alloy occupies one unit, while consuming three. The conversion reduces storage use.
  const amount = Math.max(0, Math.min(possible, Math.floor((remainingCapacity + state.stored.iron + state.stored.copper) / 1 + 1e-8)));
  if (amount > 0) {
    state.stored.iron = Math.max(0, state.stored.iron - amount * 2);
    state.stored.copper = Math.max(0, state.stored.copper - amount);
    state.stored.alloy += amount;
    state.lifetimeAlloy += amount;
  }
  // No infinite saved production time when input materials run out.
  if (state.stored.iron < 2 || state.stored.copper < 1) {
    state.refineryProgress = 0;
  } else {
    state.refineryProgress = Math.max(0, Math.min(0.999999, state.refineryProgress + seconds * refineryLevels / 4 - amount));
  }
  return amount;
}
export type ShipUpgrade = 'mining' | 'cargo';
export function shipUpgradeCost(ship: Ship, kind: ShipUpgrade): Resources {
  const nextLevel = ship.upgrades[kind] + 1;
  return kind === 'mining'
    ? { iron: 12 * nextLevel, copper: 10 * nextLevel, alloy: 4 * nextLevel }
    : { iron: 20 * nextLevel, copper: 5 * nextLevel, alloy: 3 * nextLevel };
}
export function canUpgradeShip(state: GameState, ship: Ship, kind: ShipUpgrade): string | null {
  if (!state.ships.some((entry) => entry.id === ship.id)) return 'Ship not found.';
  if (!roomOnline(state, 'fabricator')) return 'Build and power a ship fabricator first.';
  if (!ship.docked) return 'Dock this ship at the mothership first.';
  if (ship.upgrades[kind] >= MAX_LEVEL) return 'Maximum upgrade level reached.';
  if (!canPay(state.stored, shipUpgradeCost(ship, kind))) return 'Not enough stored resources.';
  return null;
}
export function upgradeShip(state: GameState, id: string, kind: ShipUpgrade): string | null {
  const ship = state.ships.find((entry) => entry.id === id);
  if (!ship) return 'Ship not found.';
  const problem = canUpgradeShip(state, ship, kind);
  if (problem) return problem;
  spend(state.stored, shipUpgradeCost(ship, kind));
  ship.upgrades[kind]++;
  if (kind === 'mining') ship.miningRate += 3;
  else ship.capacity += 25;
  return null;
}
