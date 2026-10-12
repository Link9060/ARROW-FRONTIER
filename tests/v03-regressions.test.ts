import { describe, expect, it } from 'vitest';
import { advanceActiveSimulation, activeShip, dockShip, launchShip, switchShip } from '../src/sim/engine';
import { canEnterInterior, buildRoom } from '../src/sim/mothership';
import { distance, DOCK_RADIUS, HOME, makeNewGame } from '../src/sim/model';

describe('v0.3 visual and gameplay safety', () => {
  it('requires controlled ship to dock before entering interior mode', () => {
    const game = makeNewGame(1000);
    expect(canEnterInterior(game)).toBe(true);
    expect(launchShip(activeShip(game))).toBe(true);
    expect(canEnterInterior(game)).toBe(false);
    expect(distance(activeShip(game), HOME)).toBeGreaterThan(DOCK_RADIUS);
    expect(dockShip(game, activeShip(game))).toBe('too-far');
    activeShip(game).x = HOME.x + DOCK_RADIUS - 15;
    activeShip(game).y = HOME.y;
    expect(dockShip(game, activeShip(game))).toBe('docked');
    expect(canEnterInterior(game)).toBe(true);
  });

  it('switching to an undocked ship revokes interior access', () => {
    const game = makeNewGame(1000);
    expect(canEnterInterior(game)).toBe(true);
    expect(switchShip(game, 'miner')).toBe(true);
    expect(canEnterInterior(game)).toBe(false);
    expect(switchShip(game, 'scout')).toBe(true);
    expect(canEnterInterior(game)).toBe(true);
  });

  it('preserves correct refinery time at 60 FPS and 12 FPS', () => {
    const fast = makeNewGame(1000);
    fast.ships[1].mode = 'hold';
    fast.stored.iron = 140;
    fast.stored.copper = 100;
    expect(buildRoom(fast, 'refinery', 1, 1)).toBeNull();
    const slow = structuredClone(fast);
    for (let i = 0; i < 480; i++) advanceActiveSimulation(fast, 1 / 60);
    for (let i = 0; i < 96; i++) advanceActiveSimulation(slow, 1 / 12);
    expect(fast.stored.alloy).toBe(2);
    expect(slow.stored.alloy).toBe(2);
    expect(fast.stored.alloy).toBe(slow.stored.alloy);
    expect(fast.stored.iron).toBe(slow.stored.iron);
    expect(fast.stored.copper).toBe(slow.stored.copper);
  });

  it('refining tracks real elapsed time across slow frames', () => {
    const game = makeNewGame(1000);
    game.ships[1].mode = 'hold';
    game.stored.iron = 100;
    game.stored.copper = 80;
    expect(buildRoom(game, 'refinery', 1, 1)).toBeNull();
    for (let i = 0; i < 4; i++) expect(advanceActiveSimulation(game, 1)).toBe(1);
    expect(game.stored.alloy).toBe(1);
    expect(advanceActiveSimulation(game, Number.NaN)).toBe(0);
    expect(advanceActiveSimulation(game, -5)).toBe(0);
  });
});
