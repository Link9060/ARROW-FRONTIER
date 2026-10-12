export type Ore = 'iron' | 'copper';
export type ShipMode = 'manual' | 'auto' | 'hold';
export type RoomType = 'command' | 'reactor' | 'storage' | 'hangar' | 'refinery' | 'fabricator';
export interface Point { x: number; y: number; }
export interface Cargo { iron: number; copper: number; }
export interface Resources extends Cargo { alloy: number; }
export interface Asteroid extends Point {
  id: string;
  ore: Ore;
  remaining: number;
  size: number;
}
export interface Ship extends Point {
  id: string;
  name: string;
  role: string;
  capacity: number;
  speed: number;
  miningRate: number;
  cargo: Cargo;
  docked: boolean;
  mode: ShipMode;
  angle: number;
  upgrades: { mining: number; cargo: number };
  /** Starting slot in the mothership hangar when docked. */
  berth?: number;
}
export interface Room {
  id: string;
  type: RoomType;
  x: number;
  y: number;
  level: number;
  enabled: boolean;
}
export interface GameState {
  version: 2;
  savedAt: number;
  stored: Resources;
  storageCapacity: number;
  activeShipId: string;
  ships: Ship[];
  asteroids: Asteroid[];
  lifetimeMined: number;
  rooms: Room[];
  nextRoomId: number;
  refineryProgress: number;
  lifetimeAlloy: number;
  /** One-time coordinate migration for the larger cinematic world. */
  worldRevision?: number;
}
export const WORLD = { width: 4400, height: 3200 };
export const HOME: Point = { x: 2200, y: 1600 };
// Includes the full silhouette of the upgraded arrow-shaped hull.
export const DOCK_RADIUS = 690;
export const MINE_RANGE = 275;
export const OFFLINE_CAP_SECONDS = 2 * 60 * 60;
export const ROOM_GRID = { columns: 6, rows: 4 };
export function cargoTotal(cargo: Cargo): number {
  return cargo.iron + cargo.copper;
}
export function storedTotal(cargo: Resources): number {
  return cargoTotal(cargo) + cargo.alloy;
}
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function starterRooms(): Room[] {
  return [
    { id: 'room-1', type: 'command', x: 2, y: 1, level: 1, enabled: true },
    { id: 'room-2', type: 'reactor', x: 3, y: 1, level: 1, enabled: true },
    { id: 'room-3', type: 'storage', x: 2, y: 2, level: 1, enabled: true },
    { id: 'room-4', type: 'hangar', x: 3, y: 2, level: 1, enabled: true },
  ];
}
export function makeNewGame(now = Date.now()): GameState {
  const asteroids: Asteroid[] = Array.from({ length: 27 }, (_, i) => {
    const angle = i * 2.399963229728653;
    const radius = 780 + ((i * 91) % 510);
    return {
      id: 'AST-' + String(i + 1).padStart(2, '0'),
      ore: i % 3 === 0 ? 'copper' : 'iron',
      x: HOME.x + Math.cos(angle) * radius,
      y: HOME.y + Math.sin(angle) * radius,
      size: 23 + ((i * 13) % 22),
      remaining: 62 + ((i * 29) % 105),
    };
  });
  return {
    version: 2,
    savedAt: now,
    stored: { iron: 0, copper: 0, alloy: 0 },
    storageCapacity: 400,
    activeShipId: 'scout',
    ships: [
      {
        id: 'scout', name: 'ARROW-01', role: 'SCOUT / HYBRID',
        x: HOME.x - 225, y: HOME.y - 110, angle: 0,
        capacity: 60, speed: 285, miningRate: 8,
        cargo: { iron: 0, copper: 0 }, docked: true, berth: 0, mode: 'manual',
        upgrades: { mining: 0, cargo: 0 },
      },
      {
        id: 'miner', name: 'MINER-02', role: 'INDUSTRIAL MINER',
        x: HOME.x + 530, y: HOME.y - 770, angle: 0,
        capacity: 90, speed: 155, miningRate: 6,
        cargo: { iron: 0, copper: 0 }, docked: false, mode: 'auto',
        upgrades: { mining: 0, cargo: 0 },
      },
    ],
    asteroids,
    lifetimeMined: 0,
    rooms: starterRooms(),
    nextRoomId: 5,
    refineryProgress: 0,
    lifetimeAlloy: 0,
    worldRevision: 4,
  };
}
