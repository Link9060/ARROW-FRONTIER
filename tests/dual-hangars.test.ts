import { describe, expect, it } from 'vitest';
import { HOME, ROOM_GRID, makeNewGame } from '../src/sim/model';
import { hullSize, FLAGSHIP_OUTLINE } from '../src/sim/arrowGeometry';
import { insidePolygon } from '../src/sim/hullCollision';
import { CELL_SIZE, CORE_DECK, deckCellPoint } from '../src/game/deckLayout';
import {
  SIDE_SIGN, HANGAR_SIDES, PARKING_BAY, hangarFloor,
  sideForBerth, berthAnchor, berthHeading,
} from '../src/sim/flagshipLayout';
import {
  berthWorldPosition, dockingPort, findAvailableBerth, hangarCapacity,
  reconcileBerths,
} from '../src/sim/hangar';
import { dockShip, launchShip } from '../src/sim/engine';
import { dockingRoute, departureRoute } from '../src/sim/dockingRoute';
import { buildRoom, upgradeRoom } from '../src/sim/mothership';

function corners(x:number,y:number,width:number,height:number){
  return [
    {x:x-width/2,y:y-height/2},
    {x:x+width/2,y:y-height/2},
    {x:x+width/2,y:y+height/2},
    {x:x-width/2,y:y+height/2},
  ];
}
function localInside(x:number,y:number):boolean {
  return insidePolygon({x,y},FLAGSHIP_OUTLINE);
}
describe('mirrored ARROW interior physical construction',()=>{
  it('fits all custom rooms and both 12-bay hangars within the concave ARROW outline',()=>{
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        const center=deckCellPoint(x,y);
        for(const point of corners(center.x,center.y,CELL_SIZE.width,CELL_SIZE.height)){
          expect(localInside(point.x,point.y)).toBe(true);
          expect(Math.abs(point.y)).toBeLessThan(75);
        }
      }
    }
    for(const point of corners(CORE_DECK.x+CORE_DECK.width/2,
        CORE_DECK.y+CORE_DECK.height/2,CORE_DECK.width,CORE_DECK.height)){
      expect(localInside(point.x,point.y)).toBe(true);
    }
    for(const side of HANGAR_SIDES){
      for(let tiers=1;tiers<=3;tiers++){
        const floor=hangarFloor(side,tiers);
        for(const p of corners(floor.x+floor.width/2,
          floor.y+floor.height/2,floor.width,floor.height)){
          expect(localInside(p.x,p.y)).toBe(true);
        }
      }
    }
  });

  it('splits each capacity tier evenly between A and B, aligned to small ship footprints',()=>{
    const ship=makeNewGame().ships[0];
    const miner=makeNewGame().ships[1];
    expect(hullSize(ship).length).toBeLessThan(PARKING_BAY.height-6);
    expect(hullSize(miner).length).toBeLessThan(PARKING_BAY.height);
    for(let tier=0;tier<3;tier++){
      const top=[tier*4,tier*4+1],bottom=[tier*4+2,tier*4+3];
      for(const index of top){
        expect(sideForBerth(index)).toBe('north');
        expect(berthAnchor(index).y).toBe(-[106,161,216][tier]);
        expect(berthHeading(index)).toBeCloseTo(-Math.PI/2);
      }
      for(const index of bottom){
        expect(sideForBerth(index)).toBe('south');
        expect(berthAnchor(index).y).toBe([106,161,216][tier]);
        expect(berthHeading(index)).toBeCloseTo(Math.PI/2);
      }
      for(const side of HANGAR_SIDES){
        expect(SIDE_SIGN[side]*berthAnchor(tier*4+(side==='north'?0:2)).y).toBeGreaterThan(0);
      }
    }
  });

  it('keeps existing berth assignments and cargo through physical-layout migration',()=>{
    const game=makeNewGame(1000);
    const miner=game.ships[1];
    miner.x=HOME.x+30;miner.y=HOME.y-600;
    expect(dockShip(game,miner)).toBe('docked');
    expect(miner.berth).toBe(2);
    miner.cargo.iron=14;
    const before=game.ships.map(ship=>({id:ship.id,berth:ship.berth}));
    reconcileBerths(game);
    expect(game.ships.map(ship=>({id:ship.id,berth:ship.berth}))).toEqual(before);
    expect(miner.y).toBeGreaterThan(HOME.y);
    expect(miner.angle).toBeCloseTo(Math.PI/2);
    expect(miner.cargo.iron).toBe(14);
    const left=game.ships[0],right=miner;
    expect(left.y).toBeLessThan(HOME.y);
    expect(right.y).toBeGreaterThan(HOME.y);
  });

  it('uses the correct exterior gate, tractor and row-specific service aisle for both sides',()=>{
    const game=makeNewGame();
    for(const side of HANGAR_SIDES){
      const index=side==='north'?0:2;
      const ship={...game.ships[0],berth:index};
      const berth=berthWorldPosition(ship);
      const port=dockingPort(game,side);
      const from={x:HOME.x+300,y:HOME.y};
      const incoming=dockingRoute(from,berth,port);
      const outgoing=departureRoute(berth,port);
      expect(incoming.at(-1)?.point).toEqual(berth);
      expect(incoming.find(w=>w.stage==='entry')?.point).toEqual(port.entrance);
      expect(outgoing.at(-1)?.point).toEqual(port.departure);
      expect(port.entrance.y*SIDE_SIGN[side]-HOME.y*SIDE_SIGN[side]).toBeGreaterThan(0);
      const taxi=incoming.filter(w=>w.stage==='taxi');
      expect(taxi).toHaveLength(3);
      expect(taxi[0].point.x).toBe(port.entrance.x);
      expect(taxi[1].point.y).toBe(taxi[0].point.y);
      expect(Math.abs(taxi[0].point.y-HOME.y)).toBeLessThan(Math.abs(berth.y-HOME.y));
      expect(incoming.filter(w=>w.stage==='align').every(w=>
        Math.hypot(w.point.x-HOME.x,w.point.y-HOME.y)>690)).toBe(true);
    }
  });

  it('grows each physical hangar with an upgrade and routes a ship from the southern bay',()=>{
    const game=makeNewGame(1000);
    game.stored.iron=350;game.stored.copper=220;game.stored.alloy=40;
    expect(buildRoom(game,'hangar',4,2)).toBeNull();
    expect(hangarCapacity(game)).toBe(8);
    const extension=game.rooms.find(room=>room.type==='hangar'&&room.x===4)!;
    expect(upgradeRoom(game,extension.id)).toBeNull();
    expect(hangarCapacity(game)).toBe(12);
    const upper=hangarFloor('north',3);
    const lower=hangarFloor('south',3);
    expect(upper.height).toBe(lower.height);
    expect(upper.y).toBe(-lower.y-lower.height);
    const miner=game.ships[1];
    const existing=game.ships[0];
    expect(findAvailableBerth(game,miner)).toBe(2);
    existing.docked=false;existing.berth=undefined;
    miner.x=HOME.x;miner.y=HOME.y+560;
    expect(dockShip(game,miner)).toBe('docked');
    expect(miner.berth).toBe(0);
    // Ship assigned upper if upper is the first free large parking bank.
    const assigned=berthWorldPosition(miner);
    expect(assigned).toEqual({x:miner.x,y:miner.y});
    expect(launchShip(miner)).toBe(true);
    expect(miner.y).toBeLessThan(HOME.y);
  });
});
