import { describe, expect, it, afterEach, vi } from 'vitest';
import { makeNewGame, HOME, distance } from '../src/sim/model';
import { dockShip, launchShip, activeShip, switchShip } from '../src/sim/engine';
import {
  MOTHERSHIP, berthWorldPosition, dockedBerthCount,
  findAvailableBerth, hangarCapacity, reconcileBerths,
  shipBerthSpan, berthLocalPosition,
} from '../src/sim/hangar';
import { buildRoom, upgradeRoom } from '../src/sim/mothership';
import { loadGame, saveGame } from '../src/sim/persistence';

describe('physical hangar parking rules', () => {
  it('provides four parking units with one starter hangar and unique berths', () => {
    const game = makeNewGame(1000);
    expect(hangarCapacity(game)).toBe(4);
    expect(activeShip(game).berth).toBe(0);
    const miner = game.ships[1];
    expect(shipBerthSpan(miner)).toBe(2);
    expect(findAvailableBerth(game, miner)).toBe(2);
    miner.x = HOME.x + 30;
    miner.y = HOME.y - 600;
    expect(dockShip(game, miner)).toBe('docked');
    expect(miner.berth).toBe(2);
    expect(dockedBerthCount(game)).toBe(3);
    expect(activeShip(game).berth).not.toBe(miner.berth);
    expect(miner.x).toBeCloseTo(berthWorldPosition(miner).x);
    expect(miner.y).toBeCloseTo(berthWorldPosition(miner).y);
  });

  it('never allows a fourth parked vessel to occupy a reserved bay', () => {
    const game = makeNewGame(1000);
    const miner = game.ships[1];
    miner.x = HOME.x + 10;
    miner.y = HOME.y - 600;
    expect(dockShip(game, miner)).toBe('docked');
    const spare = {
      ...game.ships[0], id: 'spare', name: 'SPARE-03',
      cargo: { iron: 0, copper: 0 }, docked: false, berth: undefined, mode: 'hold' as const,
    };
    spare.x = HOME.x + 10;
    spare.y = HOME.y - 600;
    game.ships.push(spare);
    expect(dockShip(game, spare)).toBe('docked');
    expect(spare.berth).toBe(1);
    const blocked = { ...spare, id: 'blocked', docked: false, berth: undefined };
    game.ships.push(blocked);
    expect(dockShip(game, blocked)).toBe('hangar-full');
    expect(blocked.docked).toBe(false);
    expect(dockedBerthCount(game)).toBe(4);
  });


  it('keeps a clear physical traffic aisle in all three hangar rows', () => {
    const game=makeNewGame(1000);
    game.stored.iron=300;game.stored.copper=200;game.stored.alloy=30;
    expect(buildRoom(game,'hangar',4,2)).toBeNull();
    const capacity=hangarCapacity(game);
    expect(capacity).toBe(8);
    for(let i=0;i<capacity;i++){
      const berth=berthLocalPosition(i);
      expect(Math.abs(berth.x)).toBeGreaterThan(96);
      expect(berth.y).toBe((i%4<2?-1:1)*[106,161,216][Math.floor(i/4)]);
    }
    const miner=game.ships[1];
    expect(findAvailableBerth(game,miner)).toBe(2);
  });

  it('allows expansion and upgrades to create more parking units', () => {
    const game = makeNewGame(1000);
    game.stored.iron = 250;
    game.stored.copper = 120;
    game.stored.alloy = 30;
    expect(buildRoom(game, 'hangar', 4, 2)).toBeNull();
    expect(hangarCapacity(game)).toBe(8);
    const extension = game.rooms.find((room) => room.type==='hangar' && room.x===4)!;
    expect(upgradeRoom(game, extension.id)).toBeNull();
    expect(hangarCapacity(game)).toBe(12);
  });

  it('reconciliation retains existing valid bays after loading', () => {
    const game = makeNewGame(1000);
    const scout = game.ships[0];
    const miner = game.ships[1];
    scout.docked = false;
    scout.berth = undefined;
    miner.x = HOME.x + 5;
    miner.y = HOME.y - 600;
    expect(dockShip(game, miner)).toBe('docked');
    expect(miner.berth).toBe(0);
    scout.x = HOME.x + 12;
    scout.y = HOME.y - 600;
    expect(dockShip(game, scout)).toBe('docked');
    expect(scout.berth).toBe(2);
    reconcileBerths(game);
    expect(scout.berth).toBe(2);
    expect(miner.berth).toBe(0);
  });

  it('launch clears berth and places ship beyond mothership approach radius', () => {
    const game = makeNewGame(1000);
    const scout = activeShip(game);
    expect(launchShip(scout)).toBe(true);
    expect(scout.berth).toBeUndefined();
    expect(distance(scout, HOME)).toBeGreaterThan(690);
    expect(scout.x).toBe(MOTHERSHIP.departure.x);
    expect(scout.y).toBe(MOTHERSHIP.departure.y);
    expect(findAvailableBerth(game, scout)).toBe(0);
  });

  it('instant switching does not falsely change a parked ship berth', () => {
    const game = makeNewGame(1000);
    expect(switchShip(game, 'miner')).toBe(true);
    expect(game.ships[0].berth).toBe(0);
    expect(game.ships[0].docked).toBe(true);
  });
});

describe('legacy coordinate and parking migration', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('moves old worlds and protects saves while upgrading hangar positions', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
      removeItem: (key: string) => { map.delete(key); },
    });
    const legacy = makeNewGame(1000);
    legacy.worldRevision = undefined;
    for (const ship of legacy.ships) {
      ship.x -= 900;
      ship.y -= 700;
      delete ship.berth;
    }
    legacy.asteroids.forEach((asteroid, i) => {
      const angle = i * 2.399963229728653;
      const radius = 315 + ((i * 91) % 510);
      asteroid.x = 1300 + Math.cos(angle) * radius;
      asteroid.y = 900 + Math.sin(angle) * radius;
    });
    expect(saveGame(legacy,1000)).toBe(true);
    const { state, recovered }=loadGame(1000);
    expect(recovered).toBe(true);
    expect(state.worldRevision).toBe(4);
    expect(state.ships[0].berth).toBe(0);
    expect(state.ships[0].x).toBe(berthWorldPosition(state.ships[0]).x);
    expect(state.asteroids.every((asteroid)=>distance(asteroid,HOME)>720)).toBe(true);
  });
});
