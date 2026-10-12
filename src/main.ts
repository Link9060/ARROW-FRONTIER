import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/FlightScene';
import { activeShip, roundCargo } from './sim/engine';
import { cargoTotal, distance, DOCK_RADIUS, HOME, storedTotal } from './sim/model';
import { powerReport } from './sim/mothership';
import { loadGame, resetGame, saveGame } from './sim/persistence';
import { BuilderUI } from './ui/BuilderUI';
import type { ViewMode } from './game/FlightScene';
import { dockedBerthCount, hangarCapacity } from './sim/hangar';

const loaded = loadGame();
const state = loaded.state;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('Missing FRONTIER interface element: ' + id);
  return found as T;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notice(message: string): void {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3300);
}
function persist(showNotice = false): void {
  const saved = saveGame(state);
  if (showNotice) notice(saved ? 'EXPEDITION SAVED TO THIS BROWSER' : 'SAVE FAILED · CHECK BROWSER STORAGE');
}

let started = false;
let commandOpen = false;

// Build the whole UI before Phaser starts and invokes scene.create().
const scene = new FlightScene(state, updatePanel, notice, () => persist(), (view: ViewMode) => {
  document.body.dataset.frontierView = view;
  const status = byId('cinematic-status');
  if (view === 'transition') {
    status.textContent = 'DOCKING / FLIGHT TRANSITION IN PROGRESS';
    status.classList.add('visible');
  } else {
    status.classList.remove('visible');
    status.textContent = '';
  }
  updatePanel();
});
const builder = new BuilderUI(state, () => {
  scene.drawMothership();
  updatePanel();
  persist();
}, (opened) => {
  if (opened) setCommandOpen(false);
  setFlightInputLock();
}, notice);

function setFlightInputLock(): void {
  scene.setControlsBlocked(!started || commandOpen || builder.isOpen);
}
function setCommandOpen(open: boolean): void {
  if (!started && open) return;
  if (open && builder.isOpen) builder.close();
  commandOpen = open;
  const layer = byId('command-overlay');
  layer.classList.toggle('hidden', !open);
  layer.setAttribute('aria-hidden', String(!open));
  byId('command-btn').classList.toggle('is-active', open);
  setFlightInputLock();
  if (open) byId<HTMLButtonElement>('command-close').focus();
  else byId<HTMLButtonElement>('command-btn').focus();
}
function updatePanel(): void {
  const ship = activeShip(state);
  const aboard = cargoTotal(ship.cargo);
  const stored = storedTotal(state.stored);
  const nearestHome = distance(ship, HOME);
  const closeEnough = nearestHome <= DOCK_RADIUS;
  const power = powerReport(state);

  // Flight panel contains ONLY information for the manually controlled vessel.
  byId('ship-name').textContent = ship.name;
  byId('ship-class').textContent = ship.role;
  byId('ship-state').textContent = ship.docked ? 'DOCKED' : 'IN FLIGHT';
  byId('ship-position').textContent = ship.docked
    ? 'HANGAR / BAY ' + String((ship.berth ?? 0) + 1).padStart(2, '0')
    : Math.round(nearestHome) + ' UNITS FROM HOME';
  byId('hangar-active-ship').textContent = ship.name;
  byId('hangar-active-berth').textContent = ship.docked
    ? String((ship.berth ?? 0) + 1).padStart(2, '0') : 'IN FLIGHT';
  byId('hangar-occupancy').textContent = dockedBerthCount(state) + ' / ' +
    hangarCapacity(state) + ' SPACES';
  byId('hangar-camera-zoom').textContent = Math.round(scene.getCameraStatus().zoom * 100) + '%';
  byId('cargo').textContent = roundCargo(aboard) + ' / ' + ship.capacity;
  byId('cargo-fill').style.width = Math.min(100, 100 * aboard / ship.capacity) + '%';
  byId('ship-iron').textContent = roundCargo(ship.cargo.iron);
  byId('ship-copper').textContent = roundCargo(ship.cargo.copper);
  byId('pilot-tip').textContent = ship.docked
    ? 'Ready for launch. Enter the interior with B to build or upgrade the mothership.'
    : aboard >= ship.capacity - 0.001
      ? 'Cargo full. Return to the mothership and unload before continuing.'
      : closeEnough
        ? 'Docking range reached. Press E to return to your hangar.'
        : 'Scan the field. Hold click on an asteroid or press SPACE to mine the nearest deposit.';

  // Strategic data lives in Command Mode, not scattered across the flight HUD.
  byId('storage').textContent = roundCargo(stored) + ' / ' + state.storageCapacity;
  byId('storage-fill').style.width = Math.min(100, 100 * stored / state.storageCapacity) + '%';
  byId('stored-iron').textContent = roundCargo(state.stored.iron);
  byId('stored-copper').textContent = roundCargo(state.stored.copper);
  byId('stored-alloy').textContent = roundCargo(state.stored.alloy);
  byId('power-summary').textContent = power.load + ' / ' + power.output;

  const launch = byId<HTMLButtonElement>('launch-btn');
  launch.disabled = !ship.docked || scene.viewMode === 'transition';
  launch.innerHTML = ship.docked ? 'LAUNCH SHIP <span>↗</span>' : 'SHIP DEPLOYED <span>◇</span>';
  const dock = byId<HTMLButtonElement>('dock-btn');
  dock.disabled = ship.docked || scene.viewMode === 'transition';
  dock.classList.toggle('ready', !ship.docked && closeEnough);
  byId<HTMLButtonElement>('hangar-launch-btn').disabled = !ship.docked || scene.viewMode === 'transition';
  const interior = byId('builder-btn');
  interior.classList.toggle('available', ship.docked);
  interior.setAttribute('aria-disabled', String(!ship.docked));
  interior.title = ship.docked ? 'Enter mothership interior (B)' : 'Dock your active ship to enter the interior';

  byId('mission-text').textContent = scene.viewMode === 'transition' ? 'HANGAR TRANSITION / AUTOPILOT ENGAGED'
    : ship.docked ? 'MOTHERSHIP ONLINE  /  HANGAR DECK'
    : aboard >= ship.capacity - 0.001 ? 'CARGO FULL  /  RETURN TO HOME'
      : closeEnough ? 'DOCKING SIGNAL AVAILABLE' : 'LOCAL EXPEDITION  /  MINING ENABLED';

  const fleet = byId('fleet');
  for (const member of state.ships) {
    let button = fleet.querySelector<HTMLButtonElement>('[data-ship="' + member.id + '"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'fleet-ship';
      button.dataset.ship = member.id;
      const identity = document.createElement('span');
      identity.className = 'fleet-identity';
      const name = document.createElement('strong');
      name.className = 'fleet-name';
      const role = document.createElement('small');
      role.className = 'fleet-role';
      identity.append(name, role);
      const status = document.createElement('span');
      status.className = 'fleet-state';
      button.append(identity, status);
      button.addEventListener('click', () => {
        scene.selectShip(member.id);
        setCommandOpen(false);
        updatePanel();
      });
      fleet.appendChild(button);
    }
    button.classList.toggle('selected', member.id === state.activeShipId);
    button.querySelector('.fleet-name')!.textContent = member.name;
    button.querySelector('.fleet-role')!.textContent = member.role;
    button.querySelector('.fleet-state')!.textContent = member.id === state.activeShipId
      ? '● PILOTING' : member.mode === 'auto' ? '◉ AUTONOMOUS' : '○ IDLE / DOCKED';
  }
  builder.tick();
}

// Phaser 3.90 intentionally removed GameConfig.resolution.
// Instead render a device-density-sized canvas and let FIT display it in CSS
// pixels. The scene camera zoom uses the same ratio to preserve world scale.
const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05080d',
  scale: {
    mode: Phaser.Scale.FIT,
    width: Math.round(window.innerWidth * pixelRatio),
    height: Math.round(window.innerHeight * pixelRatio),
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { pixelArt: false, antialias: true, antialiasGL: true, roundPixels: false },
  scene: [scene],
});
window.addEventListener('resize', () => {
  game.scale.setGameSize(Math.round(window.innerWidth * pixelRatio), Math.round(window.innerHeight * pixelRatio));
  scene.refreshCameraZoom();
});
setFlightInputLock();

byId('start-btn').addEventListener('click', () => {
  byId('start-overlay').classList.add('hidden');
  started = true;
  setFlightInputLock();
  notice(loaded.recovered
    ? (loaded.migrated ? 'SAVE MIGRATED  /  ' : 'WELCOME BACK  /  ') +
       Math.round(loaded.offlineSeconds / 60) + ' MINUTES OF OFFLINE PROGRESSION'
    : 'WELCOME TO FRONTIER  /  FIRST EXPEDITION READY');
});
function requestLaunchOrDock(): void {
  if (!started || scene.viewMode === 'transition') return;
  if (builder.isOpen) builder.close();
  if (commandOpen) setCommandOpen(false);
  scene.launchOrDock();
}
byId('launch-btn').addEventListener('click', () => {
  if (activeShip(state).docked) requestLaunchOrDock();
});
byId('dock-btn').addEventListener('click', () => {
  if (!activeShip(state).docked) requestLaunchOrDock();
});
byId('hangar-launch-btn').addEventListener('click', () => requestLaunchOrDock());
byId('hangar-build-btn').addEventListener('click', () => builder.open());
byId('zoom-in-btn').addEventListener('click', () => scene.zoomInterior(1));
byId('zoom-out-btn').addEventListener('click', () => scene.zoomInterior(-1));
byId('recenter-btn').addEventListener('click', () => scene.recenterInterior());
byId('command-btn').addEventListener('click', () => setCommandOpen(!commandOpen));
byId('quick-command-btn').addEventListener('click', () => setCommandOpen(true));
byId('command-close').addEventListener('click', () => setCommandOpen(false));
byId('command-overlay').addEventListener('pointerdown', (event) => {
  if (event.target === byId('command-overlay')) setCommandOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (!started || event.repeat) return;
  if (event.key === 'Escape' && commandOpen) {
    setCommandOpen(false);
    event.preventDefault();
  } else if (event.key.toLowerCase() === 'c' &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)) {
    setCommandOpen(!commandOpen);
    event.preventDefault();
  } else if ((event.code === 'KeyE' || event.key.toLowerCase() === 'e') &&
      !commandOpen && !builder.isOpen) {
    requestLaunchOrDock();
    event.preventDefault();
  } else if ((event.code === 'KeyQ' || event.key.toLowerCase() === 'q') &&
      !commandOpen && !builder.isOpen && scene.viewMode !== 'transition') {
    scene.nextShip();
    event.preventDefault();
  }
});

byId('save-btn').addEventListener('click', () => persist(true));
byId('fleet-resume').addEventListener('click', () => {
  let count = 0;
  for (const member of state.ships) {
    if (member.id === state.activeShipId || member.mode !== 'hold') continue;
    member.mode = 'auto';
    count++;
  }
  notice(count ? count + ' SHIPS RESUMED BY LOCAL RAVIN CONTROLLER' : 'NO IDLE SHIPS TO RESUME');
  updatePanel();
  persist();
});
byId('reset-btn').addEventListener('click', () => {
  if (window.confirm('Erase your local FRONTIER save and restart your expedition?')) {
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
