import { describe, expect, it } from 'vitest';
import { makeNewGame, HOME } from '../src/sim/model';
import { SOLAR_SYSTEM, createDestinationAsteroids, destinationById,
  orbitalPosition, travelToDestination } from '../src/sim/solarSystem';

describe('Helios solar system and persistent travel',()=>{
  it('contains one star, five planets, four moons and two asteroid regions',()=>{
    expect(SOLAR_SYSTEM.filter(d=>d.kind==='star')).toHaveLength(1);
    expect(SOLAR_SYSTEM.filter(d=>d.kind==='planet')).toHaveLength(5);
    expect(SOLAR_SYSTEM.filter(d=>d.kind==='moon')).toHaveLength(4);
    expect(SOLAR_SYSTEM.filter(d=>d.kind==='belt')).toHaveLength(2);
    expect(SOLAR_SYSTEM.every(d=>d.orbitRadius>=0&&d.density>0)).toBe(true);
  });
  it('places moons around moving parents instead of the star',()=>{
    const parent=destinationById('caelum')!;
    const moon=destinationById('caelum-i')!;
    const at=orbitalPosition(parent,140);
    const satellite=orbitalPosition(moon,140);
    expect(Math.hypot(at.x-satellite.x,at.y-satellite.y)).toBeCloseTo(moon.orbitRadius,5);
    expect(orbitalPosition(parent,0)).not.toEqual(orbitalPosition(parent,140));
  });
  it('generates stable local fields with region-specific ore and density',()=>{
    const a=createDestinationAsteroids('aurex');
    expect(a).toEqual(createDestinationAsteroids('aurex'));
    expect(a.length).toBe(destinationById('aurex')!.density);
    expect(createDestinationAsteroids('inner-belt').length).toBeGreaterThan(a.length);
    expect(a.filter(rock=>rock.ore==='copper').length).toBeGreaterThan(a.length/2);
    expect(a.every(rock=>Math.hypot(rock.x-HOME.x,rock.y-HOME.y)>760)).toBe(true);
  });
  it('preserves fleet, resources, construction and mined-out deposits across jumps',()=>{
    const game=makeNewGame();
    const initialShip=game.ships[1];
    initialShip.cargo.iron=17;
    game.stored.iron=88;
    const savedRooms=JSON.stringify(game.rooms);
    game.asteroids[0].remaining=0;
    const oldField=JSON.stringify(game.asteroids);
    expect(travelToDestination(game,'aurex')).toBe('arrived');
    expect(game.currentDestinationId).toBe('aurex');
    expect(game.asteroids.length).toBe(39);
    game.asteroids[0].remaining=2;
    expect(travelToDestination(game,'vesta')).toBe('arrived');
    expect(JSON.stringify(game.asteroids)).toBe(oldField);
    expect(travelToDestination(game,'aurex')).toBe('arrived');
    expect(game.asteroids[0].remaining).toBe(2);
    expect(game.stored.iron).toBe(88);
    expect(game.ships[1].cargo.iron).toBe(17);
    expect(game.ships[1].order).toBe('mine');
    expect(JSON.stringify(game.rooms)).toBe(savedRooms);
  });
  it('disallows jumps from an undocked pilot and unknown destinations',()=>{
    const game=makeNewGame();
    expect(travelToDestination(game,'invalid')).toBe('unknown-destination');
    expect(travelToDestination(game,'vesta')).toBe('same-destination');
    game.ships[0].docked=false;
    expect(travelToDestination(game,'nivalis')).toBe('must-dock');
    expect(game.currentDestinationId).toBe('vesta');
  });
});
