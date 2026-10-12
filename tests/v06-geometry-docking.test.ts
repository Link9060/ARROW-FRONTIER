import { describe, expect, it } from 'vitest';
import {
  ARROW_MARK_PATH, ARROW_MARK_VERTICES, arrowOutline, FLAGSHIP_LENGTH,
  FLAGSHIP_OUTLINE, hullSize, noseTip, SHIP_ZONES,
} from '../src/sim/arrowGeometry';
import {
  dockingRoute, departureRoute, inTractorStage, segmentDuration, shortestAngle,
} from '../src/sim/dockingRoute';
import { berthWorldPosition, dockingPort, findAvailableBerth, hangarCapacity, MOTHERSHIP } from '../src/sim/hangar';
import { buildRoom } from '../src/sim/mothership';
import { beamExtent } from '../src/game/MiningEffects';
import { distance, DOCK_RADIUS, HOME, makeNewGame } from '../src/sim/model';

describe('v0.6 ARROW source asset and all ship classes', () => {
  it('uses the exact canonical SVG source mark from the ARROW website', () => {
    expect(ARROW_MARK_PATH).toBe('M3 5.2 21 12 3 18.8 8.2 12 3 5.2Z');
    expect(ARROW_MARK_VERTICES).toHaveLength(4);
    expect(FLAGSHIP_OUTLINE).toEqual(arrowOutline(FLAGSHIP_LENGTH));
    expect(noseTip(FLAGSHIP_LENGTH)).toEqual({x:FLAGSHIP_LENGTH/2,y:0});
  });
  it('preserves the notched tail and symmetric shoulders at all scales', () => {
    for(const length of [59,85,250,1170]){
      const v=arrowOutline(length);
      expect(v[1][0]).toBeCloseTo(length/2);
      expect(v[1][1]).toBeCloseTo(0);
      expect(v[0][1]).toBeCloseTo(-v[2][1]);
      expect(v[0][0]).toBeCloseTo(v[2][0]);
      expect(v[3][0]).toBeGreaterThan(v[0][0]);
      expect(v[3][1]).toBeCloseTo(0);
    }
    const game=makeNewGame();
    expect(hullSize(game.ships[0]).length).toBeLessThan(hullSize(game.ships[1]).length);
  });
  it('puts fixed command and propulsion systems at opposite ends', () => {
    expect(SHIP_ZONES.bridge.x).toBeGreaterThan(0);
    expect(SHIP_ZONES.engine.x).toBeLessThan(0);
    expect(SHIP_ZONES.tractor.y).toBeLessThan(0);
  });
});

describe('v0.6 continuous docking route', () => {
  it('routes from the ship current position, outside hull, to a real berth', () => {
    const game=makeNewGame(1000);
    const scout=game.ships[0];
    const slot=findAvailableBerth(game,game.ships[1]);
    expect(slot).not.toBeNull();
    const ship={...game.ships[1],berth:slot!};
    const berth=berthWorldPosition(ship);
    const from={x:HOME.x+510,y:HOME.y+340};
    expect(distance(from,HOME)).toBeLessThan(DOCK_RADIUS);
    const route=dockingRoute(from,berth);
    expect(route.length).toBeGreaterThan(6);
    for(const waypoint of route.filter(item=>item.stage==='align')){
      expect(distance(waypoint.point,HOME)).toBeCloseTo(780,7);
    }
    expect(route.map(w=>w.stage)).toContain('tractor');
    expect(route.map(w=>w.stage)).toContain('entry');
    expect(route.at(-1)!.point).toEqual(berth);
    expect(berth.x).not.toEqual(scout.x+999);
  });
  it('provides the correct side airlock and symmetric departure logic', () => {
    const from={x:HOME.x+220,y:HOME.y+440};
    const berth=berthWorldPosition({...makeNewGame().ships[0],berth:0});
    const inbound=dockingRoute(from,berth);
    expect(inbound.some(item=>item.point.x===MOTHERSHIP.entrance.x &&
      item.point.y===MOTHERSHIP.entrance.y)).toBe(true);
    const outbound=departureRoute(berth);
    expect(outbound.at(-1)!.point).toEqual(MOTHERSHIP.departure);
    expect(distance(outbound.at(-1)!.point,HOME)).toBeGreaterThan(DOCK_RADIUS);
    expect(inTractorStage('tractor')).toBe(true);
    expect(inTractorStage('align')).toBe(false);
  });
  it('uses world speed rather than one fixed duration per waypoint', () => {
    const p={x:0,y:0};
    expect(segmentDuration(p,{x:300,y:0},150)).toBe(2000);
    expect(segmentDuration(p,{x:300,y:0},300)).toBe(1000);
    expect(segmentDuration(p,p,150)).toBe(80);
    expect(shortestAngle(3.12,-3.12)).toBeGreaterThan(3.12);
  });
  it('an expanded hangar moves its real airlock, tractor and departure outward', () => {
    const game=makeNewGame();
    const starter=dockingPort(game);
    game.stored.iron=500;
    game.stored.copper=500;
    game.stored.alloy=40;
    expect(buildRoom(game,'hangar',4,2)).toBeNull();
    const expanded=dockingPort(game);
    expect(expanded.entrance.y).toBe(starter.entrance.y-138);
    expect(expanded.tractor.y).toBe(starter.tractor.y-138);
    expect(expanded.departure.y).toBe(starter.departure.y-138);
    const berth=berthWorldPosition({...game.ships[0],berth:4});
    const inbound=dockingRoute({x:HOME.x+100,y:HOME.y+250},berth,expanded);
    expect(inbound.some(w=>w.stage==='entry'&&w.point.y===expanded.entrance.y)).toBe(true);
    expect(departureRoute(berth,expanded).at(-1)!.point).toEqual(expanded.departure);
  });
  it('starts laser with a forward tip and retracts the tail after release', () => {
    expect(beamExtent(.025,0).end).toBeCloseTo(.175);
    expect(beamExtent(1,0)).toEqual({start:0,end:1,strength:1});
    const cooling=beamExtent(1,.1);
    expect(cooling.start).toBeCloseTo(.48);
    expect(cooling.end).toBe(1);
    expect(beamExtent(1,1).strength).toBe(0);
  });

  it('additional hangar capacity moves parking rows toward the side', () => {
    const game=makeNewGame();
    const berth0=berthWorldPosition({...game.ships[0],berth:0});
    const berth4=berthWorldPosition({...game.ships[0],berth:4});
    expect(berth4.y).toBeLessThan(berth0.y);
    expect(hangarCapacity(game)).toBe(4);
  });
});
