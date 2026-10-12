import {describe,it,expect} from 'vitest';
import {HOME,makeNewGame} from '../src/sim/model';
import {hitsMothership,insidePolygon,resolveHullMovement} from '../src/sim/hullCollision';
import {FLAGSHIP_OUTLINE} from '../src/sim/arrowGeometry';
import {buildRoom} from '../src/sim/mothership';

describe('ARROW hull is solid except in authorized docking transition',()=>{
  it('uses the actual concave logo and preserves the tail notch',()=>{
    expect(insidePolygon({x:320,y:0},FLAGSHIP_OUTLINE)).toBe(true);
    expect(insidePolygon({x:-400,y:0},FLAGSHIP_OUTLINE)).toBe(false);
    expect(insidePolygon({x:-440,y:-320},FLAGSHIP_OUTLINE)).toBe(true);
  });
  it('prevents manual flight through the bridge but allows movement outside',()=>{
    const game=makeNewGame();
    const outside={x:HOME.x+620,y:HOME.y};
    const inside={x:HOME.x+460,y:HOME.y};
    expect(hitsMothership(outside,game)).toBe(false);
    expect(hitsMothership(inside,game)).toBe(true);
    expect(resolveHullMovement(outside,inside,game)).toEqual(outside);
    const flight={x:HOME.x+760,y:HOME.y+300};
    expect(resolveHullMovement(outside,flight,game)).toEqual(flight);
  });
  it('permits legacy ships stuck in the old hull to move outward',()=>{
    const game=makeNewGame();
    const old={x:HOME.x+320,y:HOME.y};
    const outward={x:HOME.x+345,y:HOME.y};
    expect(hitsMothership(old,game)).toBe(true);
    expect(resolveHullMovement(old,outward,game)).toEqual(outward);
  });
  it('side hangar collision expands when more physical docking slots are built',()=>{
    const game=makeNewGame();
    const point={x:HOME.x-290,y:HOME.y-310};
    expect(hitsMothership(point,game)).toBe(false);
    game.stored.iron=500;game.stored.copper=500;game.stored.alloy=40;
    expect(buildRoom(game,'hangar',4,2)).toBeNull();
    expect(hitsMothership(point,game)).toBe(true);
  });
});
