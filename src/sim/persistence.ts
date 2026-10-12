import { makeNewGame, WORLD } from './model';
import type { GameState } from './model';
import { simulateOffline } from './engine';

const SAVE_KEY = 'arrow-frontier-first-flight-v1';

function validCargo(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return ['iron', 'copper'].every((ore) =>
    typeof entry[ore] === 'number' && Number.isFinite(entry[ore]) && (entry[ore] as number) >= 0
  );
}

function validSave(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  if (state.version !== 1 || !Array.isArray(state.ships) || !Array.isArray(state.asteroids) ||
      typeof state.activeShipId !== 'string' || typeof state.savedAt !== 'number' ||
      !Number.isFinite(state.savedAt) || !validCargo(state.stored) ||
      typeof state.storageCapacity !== 'number' || state.storageCapacity < 0 ||
      typeof state.lifetimeMined !== 'number' || !Number.isFinite(state.lifetimeMined)) return false;
  if (!state.ships.some((ship) => ship.id === state.activeShipId)) return false;
  if (!state.ships.every((ship) =>
      typeof ship.id === 'string' && typeof ship.name === 'string' &&
      ['manual', 'auto', 'hold'].includes(ship.mode) &&
      typeof ship.docked === 'boolean' && validCargo(ship.cargo) &&
      [ship.x, ship.y, ship.angle, ship.capacity, ship.speed, ship.miningRate].every(
        (n) => typeof n === 'number' && Number.isFinite(n)
      ) && ship.x >= 0 && ship.x <= WORLD.width && ship.y >= 0 && ship.y <= WORLD.height &&
      ship.capacity > 0 && ship.speed > 0 && ship.miningRate > 0
  )) return false;
  if (!state.asteroids.every((asteroid) =>
      typeof asteroid.id === 'string' && ['iron', 'copper'].includes(asteroid.ore) &&
      [asteroid.x, asteroid.y, asteroid.remaining, asteroid.size].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0
      )
  )) return false;
  return true;
}

export interface LoadResult { state: GameState; offlineSeconds: number; recovered: boolean; }

export function loadGame(now = Date.now()): LoadResult {
  try {
    const stored = localStorage.getItem(SAVE_KEY);
    if (stored) {
      const decoded: unknown = JSON.parse(stored);
      if (validSave(decoded)) {
        const seconds = simulateOffline(decoded, Math.max(0, (now - decoded.savedAt) / 1000));
        decoded.savedAt = now;
        return { state: decoded, offlineSeconds: seconds, recovered: true };
      }
    }
  } catch (error) {
    console.warn('FRONTIER: unable to load save, starting new game', error);
  }
  return { state: makeNewGame(now), offlineSeconds: 0, recovered: false };
}

export function saveGame(state: GameState, now = Date.now()): boolean {
  try {
    state.savedAt = now;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('FRONTIER: unable to save progress', error);
    return false;
  }
}

export function resetGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
