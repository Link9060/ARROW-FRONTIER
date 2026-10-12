import { ROOM_GRID } from '../sim/model';
import type { Point } from '../sim/model';

/**
 * 6 × 4 modular deck, fully INSIDE the ARROW center fuselage.
 * Old save x/y indices do not change. Each builder cell and visible room
 * uses the same world-local coordinate; hangars occupy the two side wings.
 */
export const CELL_SIZE={width:75,height:25} as const;
export const CORE_DECK={
  x:-242,y:-59,width:512,height:118,
} as const;
export function deckCellPoint(x:number,y:number):Point {
  return {
    x:-208+Math.max(0,Math.min(ROOM_GRID.columns-1,x))*91,
    y:-43+Math.max(0,Math.min(ROOM_GRID.rows-1,y))*(86/3),
  };
}
export function locateDeckCell(localX:number,localY:number):{x:number;y:number}|null {
  for(let y=0;y<ROOM_GRID.rows;y++){
    for(let x=0;x<ROOM_GRID.columns;x++){
      const p=deckCellPoint(x,y);
      if(Math.abs(localX-p.x)<=CELL_SIZE.width/2 &&
          Math.abs(localY-p.y)<=CELL_SIZE.height/2)return {x,y};
    }
  }
  return null;
}
