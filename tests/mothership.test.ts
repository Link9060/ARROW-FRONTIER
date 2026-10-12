import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildRoom, canBuild, canUpgradeShip, capacityFor, MODULES, powerReport,
  roomOnline, runIndustry, shipUpgradeCost, toggleRoom, upgradeRoom, upgradeShip,
} from '../src/sim/mothership';
import { cargoTotal, makeNewGame, storedTotal } from '../src/sim/model';
import { simulateOffline } from '../src/sim/engine';
import { loadGame, saveGame } from '../src/sim/persistence';

describe('v0.2 mothership construction', () => {
  test('rooms require grid bounds, cardinal adjacency, free slot and enough material', () => {
    const game = makeNewGame();
    expect(canBuild(game, 'storage', 5, 3)).toMatch(/connect/);
    expect(canBuild(game, 'storage', 2, 1)).toMatch(/occupied/);
    expect(canBuild(game, 'storage', -1, 1)).toMatch(/Outside/);
    expect(canBuild(game, 'storage', 1, 1)).toMatch(/resources/);

    game.stored.iron = 80;
    game.stored.copper = 30;
    expect(buildRoom(game, 'storage', 1, 1)).toBeNull();
    expect(game.rooms).toHaveLength(5);
    expect(game.stored.iron).toBe(80 - MODULES.storage.cost.iron);
    expect(game.stored.copper).toBe(30 - MODULES.storage.cost.copper);
    expect(game.storageCapacity).toBe(600);
    expect(capacityFor(game.rooms)).toBe(600);
    expect(buildRoom(game, 'storage', 1, 1)).toMatch(/occupied/);
  });

  test('power priority disables excess consumers without erasing them', () => {
    const game = makeNewGame();
    game.stored.iron = 500;
    game.stored.copper = 500;
    expect(buildRoom(game, 'refinery', 1, 1)).toBeNull();
    expect(buildRoom(game, 'refinery', 4, 1)).toBeNull();
    const report = powerReport(game);
    expect(report.output).toBe(22);
    expect(report.demand).toBe(23);
    expect(report.load).toBe(15);
    expect(report.onlineIds.has('room-5')).toBe(true);
    expect(report.onlineIds.has('room-6')).toBe(false);
    expect(toggleRoom(game, 'room-5')).toBeNull();
    expect(powerReport(game).onlineIds.has('room-6')).toBe(true);
    expect(toggleRoom(game, 'room-1')).toMatch(/Core/);
  });

  test('refinery consumes actual iron/copper, produces alloy at rate and respects power', () => {
    const game = makeNewGame();
    game.stored.iron = 100;
    game.stored.copper = 60;
    expect(buildRoom(game, 'refinery', 1, 1)).toBeNull();
    expect(roomOnline(game, 'refinery')).toBe(true);
    const before = storedTotal(game.stored);
    expect(runIndustry(game, 12)).toBe(3);
    expect(game.stored.alloy).toBe(3);
    expect(storedTotal(game.stored)).toBeCloseTo(before - 6);
    expect(game.lifetimeAlloy).toBe(3);
    const reactor = game.rooms.find((room) => room.type === 'reactor')!;
    expect(toggleRoom(game, reactor.id)).toBeNull();
    expect(roomOnline(game, 'refinery')).toBe(false);
    expect(runIndustry(game, 20)).toBe(0);
    expect(game.stored.alloy).toBe(3);
  });

  test('room upgrades require alloy and permanently increase storage and generation', () => {
    const game = makeNewGame();
    const storage = game.rooms.find((room) => room.type === 'storage')!;
    const reactor = game.rooms.find((room) => room.type === 'reactor')!;
    game.stored.iron = 120;
    game.stored.copper = 90;
    expect(upgradeRoom(game, storage.id)).toMatch(/resources/);
    game.stored.alloy = 20;
    expect(upgradeRoom(game, storage.id)).toBeNull();
    expect(game.storageCapacity).toBe(550);
    expect(upgradeRoom(game, reactor.id)).toBeNull();
    expect(powerReport(game).output).toBe(32);
    expect(reactor.level).toBe(2);
  });

  test('ship fabricator requires power, docking and cost; upgrades modify ship stats', () => {
    const game = makeNewGame();
    game.stored.iron = 220;
    game.stored.copper = 140;
    game.stored.alloy = 25;
    const scout = game.ships[0];
    expect(canUpgradeShip(game, scout, 'mining')).toMatch(/fabricator/);
    expect(buildRoom(game, 'fabricator', 1, 1)).toBeNull();
    expect(roomOnline(game, 'fabricator')).toBe(true);
    const laserBefore = scout.miningRate;
    const cost = shipUpgradeCost(scout, 'mining');
    const storedBefore = { ...game.stored };
    expect(upgradeShip(game, scout.id, 'mining')).toBeNull();
    expect(scout.miningRate).toBe(laserBefore + 3);
    expect(scout.upgrades.mining).toBe(1);
    expect(game.stored.alloy).toBe(storedBefore.alloy - cost.alloy);
    expect(game.stored.iron).toBe(storedBefore.iron - cost.iron);
    expect(canUpgradeShip(game, game.ships[1], 'cargo')).toMatch(/Dock/);
    expect(upgradeShip(game, scout.id, 'cargo')).toBeNull();
    expect(scout.capacity).toBe(85);
  });

  test('offline progression manufactures only available input, without real-time APIs', () => {
    const game = makeNewGame(1000);
    game.ships[1].mode = 'hold';
    game.stored.iron = 90;
    game.stored.copper = 65;
    expect(buildRoom(game, 'refinery', 1, 1)).toBeNull();
    const before = storedTotal(game.stored);
    expect(simulateOffline(game, 16)).toBe(16);
    expect(game.stored.alloy).toBe(4);
    expect(storedTotal(game.stored)).toBe(before - 8);
    expect(cargoTotal(game.ships[1].cargo)).toBe(0);
  });

  test('building cannot duplicate resources after successful transaction', () => {
    const game = makeNewGame();
    game.stored.iron = 22;
    game.stored.copper = 8;
    expect(buildRoom(game, 'storage', 1, 1)).toBeNull();
    expect(game.stored.iron).toBe(0);
    expect(game.stored.copper).toBe(0);
    expect(buildRoom(game, 'storage', 1, 2)).toMatch(/resources/);
    expect(game.rooms).toHaveLength(5);
  });
});

describe('v0.1 save migration and v0.2 persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  function memoryStorage() {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    };
    vi.stubGlobal('localStorage', storage);
    return storage;
  }

  test('converts legacy saves without resetting earned ore or ships', () => {
    const storage = memoryStorage();
    const old = makeNewGame(1000);
    old.stored.iron = 90;
    old.stored.copper = 40;
    old.ships[1].mode = 'hold';
    const legacy = { ...old, version: 1, stored: { iron: 90, copper: 40 } };
    storage.setItem('arrow-frontier-first-flight-v1', JSON.stringify(legacy));
    const result = loadGame(1000);
    expect(result.migrated).toBe(true);
    expect(result.recovered).toBe(true);
    expect(result.state.version).toBe(2);
    expect(result.state.rooms).toHaveLength(4);
    expect(result.state.stored.iron).toBe(90);
    expect(result.state.stored.copper).toBe(40);
    expect(result.state.stored.alloy).toBe(0);
    expect(result.state.ships).toHaveLength(2);
    expect(storage.getItem('arrow-frontier-expansion-v2')).not.toBeNull();
  });

  test('persists constructed rooms, alloy and ship upgrades across reload', () => {
    memoryStorage();
    const game = makeNewGame(1000);
    game.ships[1].mode = 'hold';
    game.stored.iron = 100;
    game.stored.copper = 60;
    game.stored.alloy = 8;
    expect(buildRoom(game, 'storage', 1, 1)).toBeNull();
    expect(saveGame(game, 1000)).toBe(true);
    const restored = loadGame(1000);
    expect(restored.migrated).toBe(false);
    expect(restored.state.rooms).toHaveLength(5);
    expect(restored.state.storageCapacity).toBe(600);
    expect(restored.state.stored.alloy).toBe(8);
  });
});
