import {describe,it,expect} from 'vitest';
import {HOME,makeNewGame,distance,DOCK_RADIUS} from '../src/sim/model';
import {recoverInterruptedDocking} from '../src/sim/persistence';
import {launchShip} from '../src/sim/engine';

describe('FRONTIER screen and save transition recovery',()=>{
  it('recovers an undocked vessel caught inside opaque hull during old cinematic',()=>{
    const state=makeNewGame(1000);
    const ship=state.ships[0];
    launchShip(ship);
    ship.x=HOME.x+20;ship.y=HOME.y+40;
    expect(recoverInterruptedDocking(state)).toBe(true);
    expect(distance(ship,HOME)).toBeGreaterThan(DOCK_RADIUS);
    expect(ship.docked).toBe(false);
  });
  it('does not teleport active ships legitimately flying outside the hull',()=>{
    const state=makeNewGame(1000);
    const ship=state.ships[0];
    launchShip(ship);
    const original={x:ship.x,y:ship.y};
    expect(recoverInterruptedDocking(state)).toBe(false);
    expect(ship.x).toBe(original.x);
    expect(ship.y).toBe(original.y);
  });
  it('does not displace any ship properly docked in a berth',()=>{
    const state=makeNewGame(1000);
    const ship=state.ships[0];
    const original={x:ship.x,y:ship.y,berth:ship.berth};
    expect(recoverInterruptedDocking(state)).toBe(false);
    expect(ship).toMatchObject(original);
  });
});
