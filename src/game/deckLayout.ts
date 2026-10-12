import { ROOM_GRID } from '../sim/model';
import type { Point } from '../sim/model';

/**
 * Physical mothership locations for the 6x4 construction grid.
 * The two central rows wrap the upper/lower edges of the main hangar.
 * All drawing and direct click-selection use this same geometry.
 */
export const CELL_SIZE={width:132,height:65};
export function deckCellPoint(x:number,y:number):Point {
  return {x:-402+x*140,y:[-294,-215,215,294][y]??0};
}
export function locateDeckCell(localX:number,localY:number):{x:number,y:number}|null{
  for(let y=0;y<ROOM_GRID.rows;y++){
    for(let x=0;x<ROOM_GRID.columns;x++){
      const point=deckCellPoint(x,y);
      if(Math.abs(localX-point.x)<=CELL_SIZE.width/2 &&
          Math.abs(localY-point.y)<=CELL_SIZE.height/2)return {x,y};
    }
  }
  return null;
}
