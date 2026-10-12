import {describe,it,expect} from 'vitest';
import {deckCellPoint,locateDeckCell,CELL_SIZE} from '../src/game/deckLayout';
import {ROOM_GRID,makeNewGame} from '../src/sim/model';
import {buildRoom} from '../src/sim/mothership';

describe('ARROW v0.5 physical deck navigation',()=>{
  it('maps all 24 deck cells to unique, clickable locations',()=>{
    const unique=new Set<string>();
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        const p=deckCellPoint(x,y);
        unique.add(p.x+':'+p.y);
        expect(locateDeckCell(p.x,p.y)).toEqual({x,y});
        expect(locateDeckCell(p.x+CELL_SIZE.width/4,p.y)).toEqual({x,y});
      }
    }
    expect(unique.size).toBe(24);
    expect(locateDeckCell(9999,9999)).toBeNull();
  });

  it('uses identical coordinates for pre-existing and newly built rooms',()=>{
    const state=makeNewGame(1000);
    for(const room of state.rooms){
      expect(locateDeckCell(deckCellPoint(room.x,room.y).x,deckCellPoint(room.x,room.y).y)).toEqual({x:room.x,y:room.y});
    }
    state.stored.iron=80;
    state.stored.copper=40;
    expect(buildRoom(state,'storage',1,1)).toBeNull();
    const placed=state.rooms.find(room=>room.x===1&&room.y===1);
    expect(placed).toBeDefined();
    const center=deckCellPoint(placed!.x,placed!.y);
    expect(locateDeckCell(center.x,center.y)).toEqual({x:1,y:1});
  });

  it('does not silently map spaces between nonadjacent rows to a room',()=>{
    expect(locateDeckCell(-122,0)).toBeNull();
    expect(locateDeckCell(-122,95)).toBeNull();
  });
});
