import { activeShip, roundCargo } from '../sim/engine';
import {
  BUILDABLE, canBuild, canUpgrade, canUpgradeShip, MODULES, powerReport,
  shipUpgradeCost, toggleRoom, upgradeCost, upgradeRoom, upgradeShip,
  buildRoom, roomOnline,
} from '../sim/mothership';
import { ROOM_GRID } from '../sim/model';
import type { GameState, RoomType, Resources } from '../sim/model';
import type { ShipUpgrade } from '../sim/mothership';

type MutationCallback = () => void;
const get = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing mothership UI: ' + id);
  return element as T;
};
function costLabel(cost: Resources): string {
  return [cost.iron ? Math.round(cost.iron) + ' FE' : '', cost.copper ? Math.round(cost.copper) + ' CU' : '',
    cost.alloy ? Math.round(cost.alloy) + ' AL' : ''].filter(Boolean).join(' / ');
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  item.className = className;
  item.textContent = text;
  return item;
}

export class BuilderUI {
  private state: GameState;
  private afterMutation: MutationCallback;
  private onOpenChange: (open: boolean) => void;
  private notice: (message: string) => void;
  private selectedType: RoomType = 'refinery';
  private selectedRoomId: string | null = null;
  private selectedShipId: string | null = null;
  private visible = false;
  private lastRendered = 0;

  constructor(state: GameState, afterMutation: MutationCallback,
      onOpenChange: (open: boolean) => void, notice: (message: string) => void) {
    this.state = state;
    this.afterMutation = afterMutation;
    this.onOpenChange = onOpenChange;
    this.notice = notice;
    get('builder-close').addEventListener('click', () => this.close());
    get('builder-overlay').addEventListener('pointerdown', (event) => {
      if (event.target === get('builder-overlay')) this.close();
    });
    get('builder-btn').addEventListener('click', () => this.toggle());
    get('builder-open-mini').addEventListener('click', () => this.open());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.visible) { this.close(); event.preventDefault(); }
      else if (event.key.toLowerCase() === 'b' && !event.repeat &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)) {
        this.toggle();
      }
    });
  }
  get isOpen(): boolean { return this.visible; }
  open(): void {
    if (this.visible) return;
    if (!activeShip(this.state).docked) {
      this.notice('DOCK YOUR ACTIVE SHIP TO ACCESS MOTHERSHIP INTERIOR');
      return;
    }
    this.visible = true;
    get('builder-overlay').classList.remove('hidden');
    get('builder-overlay').setAttribute('aria-hidden', 'false');
    this.onOpenChange(true);
    this.render();
    get<HTMLButtonElement>('builder-close').focus();
  }
  close(): void {
    if (!this.visible) return;
    this.visible = false;
    get('builder-overlay').classList.add('hidden');
    get('builder-overlay').setAttribute('aria-hidden', 'true');
    this.onOpenChange(false);
    get<HTMLButtonElement>('builder-btn').focus();
  }
  toggle(): void { if (this.visible) this.close(); else this.open(); }
  private changed(message: string): void {
    this.notice(message);
    this.afterMutation();
    this.render();
  }
  private place(x: number, y: number): void {
    const occupied = this.state.rooms.find((room) => room.x === x && room.y === y);
    if (occupied) {
      this.selectedRoomId = occupied.id;
      this.render();
      return;
    }
    const problem = canBuild(this.state, this.selectedType, x, y);
    if (problem) { this.notice(problem.toUpperCase()); return; }
    const result = buildRoom(this.state, this.selectedType, x, y);
    if (result) { this.notice(result.toUpperCase()); return; }
    const room = this.state.rooms.find((item) => item.x === x && item.y === y);
    this.selectedRoomId = room?.id ?? null;
    this.changed(MODULES[this.selectedType].title.toUpperCase() + ' · CONSTRUCTION COMPLETE');
  }
  private makeGrid(): void {
    const parent = get('room-grid');
    parent.replaceChildren();
    const powered = powerReport(this.state).onlineIds;
    for (let y = 0; y < ROOM_GRID.rows; y++) {
      for (let x = 0; x < ROOM_GRID.columns; x++) {
        const room = this.state.rooms.find((item) => item.x === x && item.y === y);
        const cell = element('button', 'module-cell');
        cell.type = 'button';
        cell.title = room ? MODULES[room.type].title + ' · Level ' + room.level :
          'Empty deck slot (' + (x + 1) + ', ' + (y + 1) + ')';
        if (room) {
          const online = powered.has(room.id);
          cell.classList.add('occupied', online ? 'online' : 'offline');
          if (this.selectedRoomId === room.id) cell.classList.add('focused');
          cell.appendChild(element('strong', 'module-symbol', MODULES[room.type].code));
          cell.appendChild(element('small', 'module-level', 'LV ' + room.level));
          cell.setAttribute('aria-label', MODULES[room.type].title + ', level ' + room.level +
            (online ? ', online' : ', unpowered'));
        } else {
          const connected = this.state.rooms.some((item) => Math.abs(item.x - x) + Math.abs(item.y - y) === 1);
          cell.classList.add(connected ? 'connected' : 'empty');
          cell.appendChild(element('span', 'module-plus', connected ? '+' : '·'));
          cell.setAttribute('aria-label', connected ? 'Available build slot' : 'Unconnected slot');
        }
        cell.addEventListener('click', () => this.place(x, y));
        parent.appendChild(cell);
      }
    }
  }
  private makePalette(): void {
    const palette = get('room-palette');
    palette.replaceChildren();
    for (const type of BUILDABLE) {
      const spec = MODULES[type];
      const card = element('button', 'blueprint');
      card.type = 'button';
      if (this.selectedType === type) card.classList.add('active');
      card.append(
        element('span', 'blueprint-code', spec.code),
        element('strong', 'blueprint-title', spec.title),
        element('span', 'blueprint-cost', costLabel(spec.cost)),
      );
      card.setAttribute('aria-pressed', String(this.selectedType === type));
      card.addEventListener('click', () => {
        this.selectedType = type;
        this.selectedRoomId = null;
        this.render();
      });
      palette.appendChild(card);
    }
  }
  private makeDetails(): void {
    const section = get('room-details');
    section.replaceChildren();
    const room = this.state.rooms.find((item) => item.id === this.selectedRoomId);
    if (!room) {
      const blueprint = MODULES[this.selectedType];
      section.append(
        element('div', 'detail-kicker', 'SELECTED BLUEPRINT'),
        element('h3', 'detail-title', blueprint.title),
        element('p', 'detail-copy', blueprint.description),
        element('div', 'detail-info', 'BUILD COST   ' + costLabel(blueprint.cost)),
        element('div', 'detail-info', 'POWER DRAW   ' + blueprint.draw),
        element('p', 'detail-copy muted', 'Choose an empty slot that touches an existing module. Resources are deducted only after placement.'),
      );
      return;
    }
    const online = powerReport(this.state).onlineIds.has(room.id);
    section.append(
      element('div', 'detail-kicker', 'SELECTED ROOM / ' + room.id.toUpperCase()),
      element('h3', 'detail-title', MODULES[room.type].title),
      element('p', 'detail-copy', MODULES[room.type].description),
      element('div', 'detail-info', 'LEVEL ' + room.level + ' / 3   ·   ' + (online ? 'ONLINE' : room.enabled ? 'POWER LIMITED' : 'DISABLED')),
    );
    if (BUILDABLE.includes(room.type)) {
      const upgrade = element('button', 'primary builder-action', 'UPGRADE MODULE · ' + costLabel(upgradeCost(room)) + ' ↗');
      upgrade.type = 'button';
      const why = canUpgrade(this.state, room);
      upgrade.disabled = why !== null;
      if (why) upgrade.title = why;
      upgrade.addEventListener('click', () => {
        const error = upgradeRoom(this.state, room.id);
        if (error) return this.notice(error.toUpperCase());
        this.changed('ROOM UPGRADED TO LEVEL ' + room.level);
      });
      section.appendChild(upgrade);
    }
    if (room.type === 'reactor' || room.type === 'refinery' || room.type === 'fabricator') {
      const toggle = element('button', 'secondary builder-action', room.enabled ? 'DISABLE MODULE' : 'ENABLE MODULE');
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        const error = toggleRoom(this.state, room.id);
        if (error) return this.notice(error.toUpperCase());
        this.changed(room.enabled ? 'MODULE ONLINE REQUESTED' : 'MODULE DISABLED');
      });
      section.appendChild(toggle);
    }
    const clear = element('button', 'builder-back', '← BACK TO BLUEPRINTS');
    clear.type = 'button';
    clear.addEventListener('click', () => { this.selectedRoomId = null; this.render(); });
    section.appendChild(clear);
  }
  private makeFabricator(): void {
    const parent = get('fabricator-panel');
    parent.replaceChildren();
    const power = roomOnline(this.state, 'fabricator');
    if (!power) {
      parent.append(element('p', 'detail-copy', 'Build and power a ship fabricator to install mining and cargo upgrades.'));
      return;
    }
    let chosen = this.state.ships.find((ship) => ship.id === this.selectedShipId);
    if (!chosen) {
      chosen = this.state.ships.find((ship) => ship.docked) ?? activeShip(this.state);
      this.selectedShipId = chosen.id;
    }
    const picker = element('select', 'fabricator-ship') as HTMLSelectElement;
    picker.setAttribute('aria-label', 'Choose ship for fabrication');
    for (const ship of this.state.ships) {
      const item = document.createElement('option');
      item.value = ship.id;
      item.textContent = ship.name + (ship.docked ? ' · DOCKED' : ' · IN FLIGHT');
      item.selected = ship.id === this.selectedShipId;
      picker.appendChild(item);
    }
    picker.addEventListener('change', () => { this.selectedShipId = picker.value; this.render(); });
    parent.append(picker);
    for (const kind of ['mining', 'cargo'] as ShipUpgrade[]) {
      const cost = shipUpgradeCost(chosen, kind);
      const label = kind === 'mining' ? 'MINING LASER · +3 EXTRACTION' : 'CARGO HOLD · +25 CAPACITY';
      const row = element('div', 'fabricator-upgrade');
      row.append(
        element('strong', 'fabricator-label', label),
        element('small', 'fabricator-cost', 'LEVEL ' + chosen.upgrades[kind] + '/3 · ' + costLabel(cost)),
      );
      const action = element('button', 'secondary builder-action', 'INSTALL UPGRADE ↗');
      action.type = 'button';
      const problem = canUpgradeShip(this.state, chosen, kind);
      action.disabled = problem !== null;
      if (problem) action.title = problem;
      action.addEventListener('click', () => {
        const error = upgradeShip(this.state, chosen.id, kind);
        if (error) return this.notice(error.toUpperCase());
        this.changed(chosen.name + ' · ' + kind.toUpperCase() + ' UPGRADED');
      });
      row.appendChild(action);
      parent.appendChild(row);
    }
  }
  refreshCounters(): void {
    if (!this.visible) return;
    const report = powerReport(this.state);
    get('builder-output').textContent = String(report.output);
    get('builder-load').textContent = String(report.load);
    get('builder-demand').textContent = String(report.demand);
    get('builder-count').textContent = this.state.rooms.length + ' / ' + (ROOM_GRID.columns * ROOM_GRID.rows);
    get('builder-iron').textContent = roundCargo(this.state.stored.iron);
    get('builder-copper').textContent = roundCargo(this.state.stored.copper);
    get('builder-alloy').textContent = roundCargo(this.state.stored.alloy);
    get('refinery-status').textContent = roomOnline(this.state, 'refinery') ?
      'REFINING' : this.state.rooms.some((room) => room.type === 'refinery') ? 'OFFLINE / NO POWER' : 'NOT BUILT';
    get('refinery-produced').textContent = roundCargo(this.state.lifetimeAlloy);
  }
  render(): void {
    if (!this.visible) return;
    this.lastRendered = Date.now();
    this.makeGrid();
    this.makePalette();
    this.makeDetails();
    this.makeFabricator();
    this.refreshCounters();
  }
  tick(): void {
    if (this.visible) {
      this.refreshCounters();
      if (Date.now() - this.lastRendered >= 1200) this.render();
    }
  }
}
