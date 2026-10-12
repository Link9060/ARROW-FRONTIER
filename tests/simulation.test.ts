import { describe, expect, test } from 'vitest';
import { activeShip, depositCargo, dockShip, extractOre, runAutomation, simulateOffline, switchShip } from '../src/sim/engine';
import { cargoTotal, HOME, makeNewGame, OFFLINE_CAP_SECONDS } from '../src/sim/model';

describe('FRONTIER simulation and save invariants', () => {
  test('first save has two ships and finite asteroid resources', () => {
    const state = makeNewGame(1);
    expect(state.ships).toHaveLength(2);
    expect(state.asteroids.length).toBeGreaterThan(15);
    expect(state.asteroids.every((asteroid) => asteroid.remaining > 0)).toBe(true);
  });

  test('mining decreases asteroid reserves and increases ship cargo by the same amount', () => {
    const state = makeNewGame(1);
    const ship = activeShip(state);
    const asteroid = state.asteroids[0];
    ship.docked = false;
    ship.x = asteroid.x;
    ship.y = asteroid.y;
    const before = asteroid.remaining;
    expect(extractOre(state, ship, asteroid, 20)).toBe(20);
    expect(asteroid.remaining).toBe(before - 20);
    expect(cargoTotal(ship.cargo)).toBe(20);
    expect(extractOre(state, ship, asteroid, 10000)).toBe(40);
    expect(cargoTotal(ship.cargo)).toBe(60);
    expect(extractOre(state, ship, asteroid, 1)).toBe(0);
  });

  test('docking cannot teleport cargo and mothership storage has a hard cap', () => {
    const state = makeNewGame(1);
    const ship = activeShip(state);
    ship.docked = false;
    ship.x = HOME.x + 400;
    ship.y = HOME.y;
    ship.cargo.iron = 45;
    expect(dockShip(state, ship)).toBe('too-far');
    expect(depositCargo(state, ship)).toBe(0);
    ship.x = HOME.x + 145;
    state.stored.iron = 390;
    expect(dockShip(state, ship)).toBe('docked');
    expect(state.stored.iron).toBe(400);
    expect(ship.cargo.iron).toBe(35);
    expect(cargoTotal(state.stored)).toBeLessThanOrEqual(state.storageCapacity);
  });

  test('switching ships restores RAVIN mining on the former manual ship', () => {
    const state = makeNewGame(1);
    const former = activeShip(state);
    former.docked = false;
    expect(switchShip(state, 'miner')).toBe(true);
    expect(former.mode).toBe('auto');
    expect(activeShip(state).mode).toBe('manual');
    expect(switchShip(state, 'nonsense')).toBe(false);
  });

  test('RAVIN mines autonomously without generating ore from nothing', () => {
    const state = makeNewGame(1);
    const startingOre = state.asteroids.reduce((sum, ore) => sum + ore.remaining, 0);
    for (let i = 0; i < 1200; i++) runAutomation(state, 0.1);
    const remainingOre = state.asteroids.reduce((sum, ore) => sum + ore.remaining, 0);
    const produced = cargoTotal(state.stored) + state.ships.reduce((sum, ship) => sum + cargoTotal(ship.cargo), 0);
    expect(produced).toBeGreaterThan(0);
    expect(produced).toBeCloseTo(startingOre - remainingOre, 5);
    expect(cargoTotal(state.stored)).toBeLessThanOrEqual(state.storageCapacity);
  });

  test('offline simulation has a bounded duration and cannot exceed storage capacity', () => {
    const state = makeNewGame(1);
    expect(simulateOffline(state, 100000)).toBe(OFFLINE_CAP_SECONDS);
    expect(cargoTotal(state.stored)).toBeLessThanOrEqual(state.storageCapacity);
    expect(simulateOffline(state, -1)).toBe(0);
    expect(simulateOffline(state, Number.NaN)).toBe(0);
  });
});
