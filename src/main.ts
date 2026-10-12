import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/FlightScene';
import { activeShip, roundCargo } from './sim/engine';
import { cargoTotal, distance, HOME, storedTotal } from './sim/model';
import { powerReport } from './sim/mothership';
import { BuilderUI } from './ui/BuilderUI';
import { loadGame, resetGame, saveGame } from './sim/persistence';

const loaded = loadGame();
const state = loaded.state;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing required FRONTIER UI element: ' + id);
  return element as T;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notice(message: string): void {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300);
}

function updatePanel(): void {
  const ship = activeShip(state);
  const usedStorage = storedTotal(state.stored);
  const power = powerReport(state);
  const cargo = cargoTotal(ship.cargo);
  const nearby = distance(ship, HOME) < 190;
  byId('storage').textContent = roundCargo(usedStorage) + ' / ' + state.storageCapacity;
  byId('storage-fill').style.width = (100 * usedStorage / state.storageCapacity) + '%';
  byId('stored-iron').textContent = roundCargo(state.stored.iron);
  byId('stored-copper').textContent = roundCargo(state.stored.copper);
  byId('stored-alloy').textContent = roundCargo(state.stored.alloy);
  byId('power-summary').textContent = power.load + ' / ' + power.output;
  byId('ship-name').textContent = ship.name;
  byId('ship-class').textContent = ship.role;
  byId('cargo').textContent = roundCargo(cargo) + ' / ' + ship.capacity;
  byId('cargo-fill').style.width = (100 * cargo / ship.capacity) + '%';
  byId('ship-state').textContent = ship.docked ? 'DOCKED' : 'MANUAL PILOT';
  byId('ship-position').textContent = ship.docked ? 'HANGAR' : Math.round(distance(ship, HOME)) + ' UNITS OUT';
  byId('mission-text').textContent = ship.docked
    ? 'PRESS E OR LAUNCH VESSEL TO BEGIN'
    : cargo >= ship.capacity ? 'CARGO FULL · RETURN TO MOTHERSHIP'
      : nearby ? 'DOCKING SIGNAL AVAILABLE · PRESS E' : 'SCAN THE BELT · HOLD CLICK OR SPACE TO MINE';

  const launchButton = byId<HTMLButtonElement>('launch-btn');
  launchButton.disabled = !ship.docked;
  launchButton.innerHTML = ship.docked ? 'LAUNCH VESSEL <span>↗</span>' : 'VESSEL IN FLIGHT <span>◆</span>';
  const dockButton = byId<HTMLButtonElement>('dock-btn');
  dockButton.disabled = ship.docked;
  dockButton.classList.toggle('ready', !ship.docked && nearby);

  const fleet = byId('fleet');
  for (const member of state.ships) {
    let button = fleet.querySelector<HTMLButtonElement>('[data-ship="' + member.id + '"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'fleet-ship';
      button.dataset.ship = member.id;
      button.addEventListener('click', () => scene.selectShip(member.id));
      const name = document.createElement('strong');
      name.className = 'fleet-name';
      const status = document.createElement('small');
      status.className = 'fleet-state';
      button.append(name, status);
      fleet.appendChild(button);
    }
    button.classList.toggle('selected', member.id === state.activeShipId);
    button.querySelector('.fleet-name')!.textContent = member.name;
    button.querySelector('.fleet-state')!.textContent =
      member.id === state.activeShipId ? '● ACTIVE / MANUAL'
        : member.mode === 'auto' ? '◉ RAVIN / MINING'
          : '◯ WAITING / DOCKED';
  }
  builder?.tick();
}

function persist(showNotice = false): void {
  if (saveGame(state)) {
    if (showNotice) notice('PROGRESS SAVED TO THIS BROWSER');
  } else if (showNotice) notice('SAVE FAILED · CHECK BROWSER STORAGE');
}

const scene = new FlightScene(state, updatePanel, notice, () => persist());
let started = false;
scene.setControlsBlocked(true);
const builder = new BuilderUI(state, () => {
  scene.drawMothership();
  updatePanel();
  persist();
}, (open) => scene.setControlsBlocked(open || !started), notice);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070b',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { pixelArt: false, antialias: true },
  scene: [scene],
});

byId('start-btn').addEventListener('click', () => {
  byId('start-overlay').classList.add('hidden');
  started = true;
  scene.setControlsBlocked(builder.isOpen);
  if (loaded.recovered) {
    notice((loaded.migrated ? 'SAVE UPGRADED · ' : 'WELCOME BACK · ') + Math.round(loaded.offlineSeconds / 60) + ' MINUTES OF OFFLINE SIMULATED');
  } else {
    notice('FIRST FLIGHT · WELCOME TO FRONTIER');
  }
});

byId('launch-btn').addEventListener('click', () => {
  if (activeShip(state).docked) scene.launchOrDock();
});
byId('dock-btn').addEventListener('click', () => {
  if (!activeShip(state).docked) scene.launchOrDock();
});
byId('save-btn').addEventListener('click', () => persist(true));
byId('fleet-resume').addEventListener('click', () => {
  let count = 0;
  for (const member of state.ships) {
    if (member.id === state.activeShipId || member.mode !== 'hold') continue;
    member.mode = 'auto';
    count++;
  }
  notice(count ? count + ' IDLE VESSEL(S) RESUMED' : 'NO IDLE VESSELS TO RESUME');
  updatePanel();
  persist();
});
byId('reset-btn').addEventListener('click', () => {
  if (window.confirm('Erase your local FRONTIER save and start a new expedition?')) {
    resetGame();
    window.location.reload();
  }
});

window.addEventListener('pagehide', () => persist());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});

updatePanel();
void game;
