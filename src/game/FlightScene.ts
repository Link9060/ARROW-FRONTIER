import Phaser from 'phaser';
import { activeShip, advanceActiveSimulation, dockShip, extractOre, launchShip, nearestDeposit, switchShip } from '../sim/engine';
import { distance, DOCK_RADIUS, HOME, MINE_RANGE, WORLD } from '../sim/model';
import type { Asteroid, GameState, Ship } from '../sim/model';

export class FlightScene extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private shipViews = new Map<string, Phaser.GameObjects.Container>();
  private asteroidViews = new Map<string, Phaser.GameObjects.Container>();
  private beam!: Phaser.GameObjects.Graphics;
  private mothershipView?: Phaser.GameObjects.Container;
  private dockRingDrawn = false;
  private controlsBlocked = false;
  private cameraAnchor!: Phaser.GameObjects.Zone;
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
    this.cameras.main.setZoom(window.innerWidth < 720 ? 1.05 : window.innerWidth < 1100 ? 1.18 : 1.34);
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

    this.cameraAnchor = this.add.zone(HOME.x, HOME.y, 1, 1).setVisible(false);
    this.cameras.main.startFollow(this.cameraAnchor, true, 0.085, 0.085);
    this.cameras.main.centerOn(HOME.x, HOME.y);

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

  /**
   * Opaque ARROW silhouette. Internal rooms are NEVER rendered in space.
   * The construction grid is accessible only while docked in interior mode.
   */
  drawMothership(): void {
    this.mothershipView?.destroy(true);
    const vessel = this.add.container(HOME.x, HOME.y).setDepth(8);
    this.mothershipView = vessel;
    const hull = this.add.graphics();
    vessel.add(hull);

    // Exterior: sharpened prow, broad delta wings and a recessed stern.
    const perimeter: [number, number][] = [
      [-228, -71], [-144, -71], [-64, -114], [18, -114],
      [120, -58], [242, 0], [120, 58], [18, 114],
      [-64, 114], [-144, 71], [-228, 71], [-146, 0],
    ];
    const drawPath = (points: [number, number][], fill: number, line: number, alpha = 1): void => {
      hull.fillStyle(fill, alpha);
      hull.lineStyle(2, line, 0.9);
      hull.beginPath();
      points.forEach(([x, y], index) => { if (index === 0) hull.moveTo(x, y); else hull.lineTo(x, y); });
      hull.closePath();
      hull.fillPath();
      hull.strokePath();
    };
    // Outer armor completely blocks views of individual internal modules.
    drawPath(perimeter, 0x101d2a, 0xb9cde0);
    drawPath(
      [[-112, -49], [-42, -87], [32, -87], [154, -25], [201, 0],
       [154, 25], [32, 87], [-42, 87], [-112, 49], [-76, 0]],
      0x1d3043, 0x527592,
    );
    drawPath([[12, -29], [93, -29], [166, 0], [93, 29], [12, 29], [56, 0]], 0x07111d, 0x9bbbd8);
    hull.lineStyle(2, 0xe0efff, 0.85);
    hull.lineBetween(-71, -92, 100, 0);
    hull.lineBetween(-71, 92, 100, 0);
    hull.lineStyle(2, 0x8daeca, 0.85);
    hull.lineBetween(-183, -53, -77, -53);
    hull.lineBetween(-183, 53, -77, 53);
    hull.lineStyle(1, 0x9ab6ce, 0.45);
    hull.lineBetween(-119, 0, -34, 0);
    hull.lineBetween(100, 0, 198, 0);
    // Engine pods and exhaust.
    for (const y of [-54, 54]) {
      hull.fillStyle(0x122b41, 1);
      hull.fillRoundedRect(-235, y - 13, 44, 26, 5);
      hull.lineStyle(1.5, 0x789fc1, 0.85);
      hull.strokeRoundedRect(-235, y - 13, 44, 26, 5);
      hull.fillStyle(0xd3e9ff, 0.8);
      hull.fillRoundedRect(-239, y - 8, 7, 16, 3);
      hull.fillStyle(0x7cb0e4, 0.12);
      hull.fillEllipse(-261, y, 43, 21);
    }
    // External expansion plating, without exposing room plans.
    const extras = Math.max(0, this.state.rooms.length - 4);
    if (extras) {
      const plates = Math.min(4, Math.ceil(extras / 3));
      for (let i = 0; i < plates; i++) {
        const x = -78 + i * 29;
        hull.lineStyle(2, 0x759bbf, 0.65);
        hull.lineBetween(x, -102, x + 22, -105);
        hull.lineBetween(x, 102, x + 22, 105);
      }
    }

    const callsign = this.add.text(-108, 134, 'A R R O W   /   M O T H E R S H I P', {
      fontFamily: 'monospace', fontSize: '12px', color: '#c6dff5', letterSpacing: 1,
    }).setOrigin(0, 0);
    vessel.add(callsign);

    if (!this.dockRingDrawn) {
      const ring = this.add.graphics().setDepth(2);
      ring.lineStyle(1, 0x9cb8d4, 0.36);
      ring.strokeCircle(HOME.x, HOME.y, DOCK_RADIUS);
      ring.lineStyle(1, 0x68829d, 0.13);
      ring.strokeCircle(HOME.x, HOME.y, DOCK_RADIUS + 16);
      ring.lineStyle(2, 0xb9d1e8, 0.45);
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        ring.beginPath();
        ring.arc(HOME.x, HOME.y, DOCK_RADIUS, angle, angle + 0.09);
        ring.strokePath();
      }
      this.add.text(HOME.x + 169, HOME.y - 235, 'DOCKING RANGE', {
        fontFamily: 'monospace', fontSize: '11px', color: '#819ab5',
      }).setDepth(3);
      this.dockRingDrawn = true;
    }
  }

  /** Disable flight commands when a modal menu is open. Simulation continues. */
  setControlsBlocked(blocked: boolean): void {
    this.controlsBlocked = blocked;
    if (blocked && this.beam) this.beam.clear();
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
      fontFamily: 'monospace', fontSize: '12px', color: '#9eb5cb',
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
    const label = this.add.text(0, -41, ship.name, {
      fontFamily: 'monospace', fontSize: '12px', color: '#b8c9dc',
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
    const ship = activeShip(this.state);
    this.cameraAnchor.setPosition(ship.docked ? HOME.x : ship.x, ship.docked ? HOME.y : ship.y);
    this.announce('CONTROL TRANSFER · ' + activeShip(this.state).name);
    this.onStateChange();
  }

  nextShip(): void {
    const index = this.state.ships.findIndex((ship) => ship.id === this.state.activeShipId);
    this.selectShip(this.state.ships[(index + 1) % this.state.ships.length].id);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (!this.controlsBlocked) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.launchOrDock();
      if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.nextShip();
      this.moveManual(dt);
      this.updateMining(dt);
    }
    // The world clock consumes real elapsed time (in stable substeps), while
    // manual movement uses a separate bounded input step.
    const elapsed = advanceActiveSimulation(this.state, delta / 1000);
    const followed = activeShip(this.state);
    this.cameraAnchor.setPosition(followed.docked ? HOME.x : followed.x, followed.docked ? HOME.y : followed.y);
    this.refreshViews();

    this.timeToUpdateUI += elapsed;
    this.timeToSave += elapsed;
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
