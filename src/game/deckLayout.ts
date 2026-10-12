import { ROOM_GRID } from '../sim/model';
import type { Point } from '../sim/model';

/**
 * Physical module positions sit *inside the lower ARROW wing*, below the
 * central ship spine. The deck narrows toward the nose, like the actual
 * logo, instead of drawing floating cards above and below the hull.
 *
 * Legacy 6x4 room coordinates and their IDs stay intact. All world drawing,
 * build hit tests and room selection share these exact positions.
 */
export const CELL_SIZE = { width: 82, height: 23 };
export function deckCellPoint(x: number, y: number): Point {
  const column = Math.max(0, Math.min(ROOM_GRID.columns - 1, x));
  const worldX = -248 + column * 94;
  const bottomEdge = worldX < 0 ? 228 : 228 - worldX * .45;
  const row = Math.max(0, Math.min(ROOM_GRID.rows - 1, y));
  return { x: worldX, y: 56 + row * (bottomEdge - 56) / (ROOM_GRID.rows - 1) };
}

export function locateDeckCell(localX: number, localY: number): {x:number;y:number}|null {
  for (let y=0; y<ROOM_GRID.rows; y++) {
    for (let x=0; x<ROOM_GRID.columns; x++) {
      const center=deckCellPoint(x,y);
      if (Math.abs(localX-center.x)<=CELL_SIZE.width/2 &&
          Math.abs(localY-center.y)<=CELL_SIZE.height/2) return {x,y};
    }
  }
  return null;
}
