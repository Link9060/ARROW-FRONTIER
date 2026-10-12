import Phaser from 'phaser';
import { activeShip, dockShip, extractOre, launchShip, nearestDeposit, runAutomation, switchShip } from '../sim/engine';
import { distance, HOME, MINE_RANGE, WORLD } from '../sim/model';
import type { Asteroid, GameState, Ship } from '../sim/model';

export class FlightScene extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private shipViews = new Map<string, Phaser.GameObjects.Container>();
  private asteroidViews = new Map<string, Phaser.GameObjects.Container>();
  private beam!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private state: GameState;
  private onStateChange: () => void;
  private announce: (text: string) => void;
  private timeToSave = 0;
  private timeToUpdateUI = 0;
  private saving: () => void;

  constructor(state: GameState, onStateChange: () => void, announce: (text: string) => void, saving: () => void) {
    super({ key: 'Flight' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.announce = announce;
    this.saving = saving;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05070b');
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.drawBackground();
    this.drawMothership();

    for (const asteroid of this.state.asteroids) {
      this.asteroidViews.set(asteroid.id, this.makeAsteroid(asteroid));
    }

    for (const ship of this.state.ships) {
      this.shipViews.set(ship.id, this.makeShip(ship));
    }

    this.beam = this.add.graphics().setDepth(22);
    this.overlay = this.add.graphics().setDepth(5);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q') as Record<string, Phaser.Input.Keyboard.Key>;

    const active = this.shipViews.get(this.state.activeShipId);
    if (active) this.cameras.main.startFollow(active, true, 0.08, 0.08);

    this.onStateChange();
    this.announce('COMMAND LINK ESTABLISHED · PRESS E TO LAUNCH');
  }

  private drawBackground(): void {
    const backdrop = this.add.graphics().setDepth(-30);
    backdrop.fillGradientStyle(0x08101a, 0x05070b, 0x05070b, 0x030508);
    backdrop.fillRect(0, 0, WORLD.width, WORLD.height);

    // Repeatable pseudo-random star field, independent of save data.
    let seed = 44071;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 520; i++) {
      const x = random() * WORLD.width;
      const y = random() * WORLD.height;
      const radius = random() > 0.94 ? 1.55 : 0.55;
      backdrop.fillStyle(random() > 0.75 ? 0xdde8f4 : 0x697d99, 0.13 + random() * 0.58);
      backdrop.fillCircle(x, y, radius);
    }

    backdrop.lineStyle(1, 0x324152, 0.11);
    for (let x = 0; x < WORLD.width; x += 160) backdrop.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y < WORLD.height; y += 160) backdrop.lineBetween(0, y, WORLD.width, y);
    backdrop.lineStyle(1, 0x668099, 0.22);
    backdrop.strokeCircle(HOME.x, HOME.y, 305);
    backdrop.strokeCircle(HOME.x, HOME.y, 660);

    this.add.text(120, 120, 'VESTA / OUTER EXPANSE', {
      fontFamily: 'monospace', fontSize: '15px', color: '#60768e', letterSpacing: 4,
    }).setDepth(-1);
  }

  private drawMothership(): void {
    const ship = this.add.container(HOME.x, HOME.y).setDepth(3);
    const shape = this.add.graphics();
    shape.lineStyle(2, 0xb6c5d8, 0.85);
    shape.fillStyle(0x111c2a, 1);
    shape.fillRoundedRect(-130, -79, 250, 156, 14);
    shape.strokeRoundedRect(-130, -79, 250, 156, 14);

    // Distinct visible compartments mimic the planned modular cutaway.
    const cells = [
      { x: -112, y: -60, w: 108, h: 48, t: 'COMMAND' },
      { x: 4, y: -60, w: 98, h: 48, t: 'REACTOR' },
      { x: -112, y: -4, w: 108, h: 48, t: 'STORAGE' },
      { x: 4, y: -4, w: 98, h: 48, t: 'HANGAR' },
    ];
    for (const cell of cells) {
      shape.lineStyle(1, 0x8fabc5, 0.36);
      shape.fillStyle(0x152436, 1);
      shape.fillRoundedRect(cell.x, cell.y, cell.w, cell.h, 5);
      shape.strokeRoundedRect(cell.x, cell.y, cell.w, cell.h, 5);
      const label = this.add.text(cell.x + cell.w / 2, cell.y + cell.h / 2, cell.t, {
        fontFamily: 'monospace', fontSize: '9px', color: '#9eb6cb',
      }).setOrigin(0.5);
      ship.add(label);
    }
    shape.lineStyle(2, 0xe6effb, 0.65);
    shape.lineBetween(120, -47, 177, -22);
    shape.lineBetween(120, 46, 177, 22);
    shape.lineBetween(177, -22, 177, 22);
    shape.fillStyle(0xa9cafa, 0.25);
    shape.fillCircle(-145, 0, 26);
    shape.fillStyle(0xf1f6ff, 0.85);
    shape.fillCircle(-145, 0, 8);
    ship.addAt(shape, 0);

    ship.add(this.add.text(-125, 93, 'ARROW-01 / MOTHERSHIP', {
      fontFamily: 'monospace', fontSize: '12px', color: '#f0f6ff', letterSpacing: 1,
    }));

    const dock = this.add.graphics().setDepth(2);
    dock.lineStyle(1, 0xc5d4e8, 0.22);
    dock.strokeCircle(HOME.x, HOME.y, 190);
    dock.lineStyle(1, 0x9cb4cc, 0.12);
    dock.strokeCircle(HOME.x, HOME.y, 208);
    this.add.text(HOME.x + 177, HOME.y - 98, 'DOCKING RADIUS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#627a90',
    }).setDepth(3);
  }

  private makeAsteroid(asteroid: Asteroid): Phaser.GameObjects.Container {
    const container = this.add.container(asteroid.x, asteroid.y).setDepth(6);
    const shape = this.add.graphics();
    const r = asteroid.size;
    shape.fillStyle(asteroid.ore === 'copper' ? 0x6a7588 : 0x748499, 0.45);
    shape.lineStyle(1.4, asteroid.ore === 'copper' ? 0xb7ab9b : 0xc2d5e9, 0.8);
    shape.beginPath();
    for (let i = 0; i <= 8; i++) {
      const angle = i * Math.PI / 4;
      const irregular = 0.7 + 0.3 * Math.abs(Math.sin((i + asteroid.size) * 2.4));
      const x = Math.cos(angle) * r * irregular;
      const y = Math.sin(angle) * r * irregular;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    shape.fillPath();
    shape.strokePath();
    shape.lineStyle(1, 0xe6edf5, 0.15);
    shape.lineBetween(-r * 0.25, -r * 0.25, r * 0.4, r * 0.2);
    container.add(shape);
    const label = this.add.text(0, -r - 22, asteroid.ore.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '10px', color: '#849cb4',
    }).setOrigin(0.5);
    container.add(label);
    container.setVisible(asteroid.remaining > 0);
    return container;
  }

  private makeShip(ship: Ship): Phaser.GameObjects.Container {
    const view = this.add.container(ship.x, ship.y).setDepth(18);
    const graphics = this.add.graphics();
    graphics.fillStyle(ship.id === 'scout' ? 0xeaf5ff : 0xb2c6dc, 0.9);
    graphics.lineStyle(1.5, 0xffffff, 0.95);
    graphics.beginPath();
    graphics.moveTo(31, 0);
    graphics.lineTo(-16, -16);
    graphics.lineTo(-9, -2);
    graphics.lineTo(-16, 16);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    graphics.fillStyle(0x060c13);
    graphics.fillTriangle(-3, -7, 11, 0, -3, 7);
    graphics.fillStyle(0x96c5ff, 0.58);
    graphics.fillTriangle(-15, -6, -28, 0, -15, 6);
    const label = this.add.text(0, -36, ship.name, {
      fontFamily: 'monospace', fontSize: '11px', color: '#b8c9dc',
    }).setOrigin(0.5).setRotation(0);
    // The label stays horizontal because it is not a child of the rotating vessel.
    view.add(graphics);
    this.add.existing(label);
    view.setData('label', label);
    return view;
  }

  private refreshViews(): void {
    for (const ship of this.state.ships) {
      const view = this.shipViews.get(ship.id);
      if (!view) continue;
      view.setPosition(ship.x, ship.y);
      view.setRotation(ship.angle);
      view.setVisible(!ship.docked);
      const label = view.getData('label') as Phaser.GameObjects.Text | undefined;
      if (label) {
        label.setPosition(ship.x, ship.y - 34);
        label.setVisible(!ship.docked);
        label.setColor(ship.id === this.state.activeShipId ? '#ffffff' : '#849db6');
      }
    }
    for (const asteroid of this.state.asteroids) {
      const visual = this.asteroidViews.get(asteroid.id);
      if (!visual) continue;
      visual.setVisible(asteroid.remaining > 0);
      visual.setAlpha(0.4 + Math.min(0.6, asteroid.remaining / 100));
    }

    this.overlay.clear();
    const ship = activeShip(this.state);
    if (!ship.docked) {
      this.overlay.lineStyle(1, 0xdde9f8, 0.16);
      this.overlay.strokeCircle(ship.x, ship.y, MINE_RANGE);
    }
  }

  private moveManual(seconds: number): void {
    const ship = activeShip(this.state);
    if (ship.docked) return;
    let dx = 0; let dy = 0;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.hypot(dx, dy);
      ship.x = Phaser.Math.Clamp(ship.x + dx / magnitude * ship.speed * seconds, 38, WORLD.width - 38);
      ship.y = Phaser.Math.Clamp(ship.y + dy / magnitude * ship.speed * seconds, 38, WORLD.height - 38);
    }
    const pointer = this.input.activePointer;
    if (pointer) {
      ship.angle = Phaser.Math.Angle.Between(ship.x, ship.y, pointer.worldX, pointer.worldY);
    }
  }

  private updateMining(seconds: number): void {
    this.beam.clear();
    const ship = activeShip(this.state);
    if (ship.docked) return;

    let target: Asteroid | undefined;
    const pointer = this.input.activePointer;
    if (pointer.isDown) {
      let best = 62;
      for (const asteroid of this.state.asteroids) {
        if (asteroid.remaining <= 0) continue;
        const hit = Math.hypot(pointer.worldX - asteroid.x, pointer.worldY - asteroid.y);
        if (hit <= best) { best = hit; target = asteroid; }
      }
    }
    if (!target && this.keys.SPACE.isDown) target = nearestDeposit(this.state, ship);
    if (!target || distance(ship, target) > MINE_RANGE) return;

    const quantity = extractOre(this.state, ship, target, seconds * ship.miningRate);
    if (quantity > 0) {
      this.beam.lineStyle(2.5, 0xf1f7ff, 0.86);
      this.beam.lineBetween(ship.x, ship.y, target.x, target.y);
      this.beam.lineStyle(7, 0x97badb, 0.14);
      this.beam.lineBetween(ship.x, ship.y, target.x, target.y);
    }
  }

  launchOrDock(): void {
    const ship = activeShip(this.state);
    if (ship.docked) {
      if (launchShip(ship)) this.announce(ship.name + ' · LAUNCH CONFIRMED');
    } else {
      const result = dockShip(this.state, ship);
      if (result === 'too-far') this.announce('TOO FAR FROM MOTHERSHIP · GET WITHIN THE DOCKING RING');
      else this.announce('DOCKED · CARGO TRANSFERRED TO MOTHERSHIP');
    }
    this.refreshViews();
    this.onStateChange();
  }

  selectShip(id: string): void {
    if (!switchShip(this.state, id)) return;
    const view = this.shipViews.get(id);
    if (view) this.cameras.main.startFollow(view, true, 0.08, 0.08);
    this.announce('CONTROL TRANSFER · ' + activeShip(this.state).name);
    this.onStateChange();
  }

  nextShip(): void {
    const index = this.state.ships.findIndex((ship) => ship.id === this.state.activeShipId);
    this.selectShip(this.state.ships[(index + 1) % this.state.ships.length].id);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.launchOrDock();
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.nextShip();
    this.moveManual(dt);
    this.updateMining(dt);
    runAutomation(this.state, dt);
    this.refreshViews();

    this.timeToUpdateUI += dt;
    this.timeToSave += dt;
    if (this.timeToUpdateUI >= 0.12) {
      this.onStateChange();
      this.timeToUpdateUI = 0;
    }
    if (this.timeToSave >= 12) {
      this.saving();
      this.timeToSave = 0;
    }
  }
}
