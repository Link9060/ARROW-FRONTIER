import type { Point, Ship } from './model';

/**
 * Canonical ARROW ship mark, sourced from the actual Project ARROW website:
 * Link9060/Resonant-Arrow/src/ArrowMark.jsx
 * M3 5.2 21 12 3 18.8 8.2 12 3 5.2Z
 *
 * One shape for the flagship and all player vessels. The origin is the
 * center of the 24×24 source coordinate system, nose toward local +X.
 */
export const ARROW_MARK_PATH = 'M3 5.2 21 12 3 18.8 8.2 12 3 5.2Z';
export type Vertex = readonly [number, number];
export const ARROW_MARK_VERTICES: readonly Vertex[] = [
  [3, 5.2], [21, 12], [3, 18.8], [8.2, 12],
] as const;

export function arrowOutline(length: number, widthScale = 1): Vertex[] {
  // Original mark is 18 units long and 13.6 high, not an arbitrary triangle.
  const xScale = length / 18;
  return ARROW_MARK_VERTICES.map(([x,y])=>[
    (x - 12) * xScale,
    (y - 12) * xScale * widthScale,
  ] as const);
}

export const FLAGSHIP_LENGTH = 1170;
export const FLAGSHIP_OUTLINE = arrowOutline(FLAGSHIP_LENGTH);
export const FLAGSHIP_HALF_HEIGHT = (6.8 / 18) * FLAGSHIP_LENGTH;
export const DOCK_SIDE: 'north' = 'north';
/** The upper hangar extends outside the arrow's broad upper shoulder. */
export const SHIP_ZONES = {
  bridge: { x: 350, y: 0 },
  engine: { x: -480, y: 0 },
  spine: { x: -120, y: 0 },
  hangar: { x: -115, y: -178 },
  airlock: { x: -115, y: -354 },
  tractor: { x: -115, y: -379 },
} as const;

/** Ship type adjusts thickness, not identity. */
export function hullSize(ship: Pick<Ship,'role'|'capacity'>): {
  length: number; widthScale: number;
} {
  if (/miner|industrial|hauler/i.test(ship.role)) {
    return { length: 85, widthScale: 1.08 };
  }
  if (/heavy|capital|large/i.test(ship.role) || ship.capacity >= 180) {
    return { length: 120, widthScale: 1.12 };
  }
  return { length: 59, widthScale: 1 };
}

export function localToWorld(local: Point, center: Point, heading = 0): Point {
  const s = Math.sin(heading), c = Math.cos(heading);
  return {x:center.x + local.x*c-local.y*s,y:center.y + local.x*s+local.y*c};
}

/** The actual mark path is the canonical identity and can be unit tested. */
export function noseTip(length: number): Point {
  return {x: length / 2, y: 0};
}
