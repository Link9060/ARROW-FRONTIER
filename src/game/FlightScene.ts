import Phaser from 'phaser';
import {
  activeShip, advanceActiveSimulation, dockShip, extractOre, launchShip,
  nearestDeposit, switchShip,
} from '../sim/engine';
import { distance, DOCK_RADIUS, HOME, MINE_RANGE, WORLD } from '../sim/model';
import { berthLocalPosition, findAvailableBerth, MOTHERSHIP, shipBerthSpan } from '../sim/hangar';
import { buildMothershipArtwork } from './MothershipArt';
import type { MothershipArtwork } from './MothershipArt';
import type { Asteroid, GameState, Point, Ship } from '../sim/model';

export type ViewMode = 'flight' | 'interior' | 'transition';
interface PinchGesture { centerX: number; centerY: number; distance: number; }

export class FlightScene extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private shipViews = new Map<string, Phaser.GameObjects.Container>();
  private asteroidViews = new Map<string, Phaser.GameObjects.Container>();
  private art?: MothershipArtwork;
  private dockRing?: Phaser.GameObjects.Graphics;
  private beam!: Phaser.GameObjects.Graphics;
  private rangeIndicator!: Phaser.GameObjects.Graphics;
  private controlsBlocked = true;
  private cameraAnchor!: Phaser.GameObjects.Zone;
  private mode: ViewMode = 'flight';
  private pinch?: PinchGesture;
  private cameraTouched = false;
  private timeToSave = 0;
  private timeToUpdateUI = 0;
  private state: GameState;
  private onStateChange: () => void;
  private announce: (text: string) => void;
  private saving: () => void;
  private onViewChange: (view: ViewMode) => void;

  constructor(state: GameState, onStateChange: () => void, announce: (text: string) => void,
      saving: () => void, onViewChange: (view: ViewMode) => void) {
    super({ key: 'Flight' });
    this.state = state;
    this.onStateChange = onStateChange;
    this.announce = announce;
    this.saving = saving;
    this.onViewChange = onViewChange;
  }

  get viewMode(): ViewMode { return this.mode; }

  create(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor('#05080d');
    camera.setBounds(0, 0, WORLD.width, WORLD.height);
    this.drawBackground();
    this.drawMothership();

    for (const asteroid of this.state.asteroids) {
      this.asteroidViews.set(asteroid.id, this.makeAsteroid(asteroid));
    }
    for (const ship of this.state.ships) {
      this.shipViews.set(ship.id, this.makeShip(ship));
    }

    this.beam = this.add.graphics().setDepth(24);
    this.rangeIndicator = this.add.graphics().setDepth(4);
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q'
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameraAnchor = this.add.zone(HOME.x, HOME.y, 1, 1).setVisible(false);
    this.input.addPointer(3);
    this.game.canvas.style.touchAction = 'none';

    // A trackpad two-finger swipe pans. Trackpad pinch (ctrl+wheel) zooms.
    // Touchscreen two-finger pan/pinch is handled in updateTouchNavigation().
    this.game.canvas.addEventListener('wheel', (event: WheelEvent) => {
      if (this.mode !== 'interior') return;
      event.preventDefault();
      this.cameras.main.stopFollow();
      this.cameraTouched = true;
      if (event.ctrlKey || event.metaKey) {
        const rect = this.game.canvas.getBoundingClientRect();
        const px = (event.clientX - rect.left) * (this.scale.width / rect.width);
        const py = (event.clientY - rect.top) * (this.scale.height / rect.height);
        const next = this.cameras.main.zoom * Math.exp(-event.deltaY * .012);
        this.setInteriorZoom(next, { x: px, y: py });
      } else {
        this.cameras.main.scrollX += event.deltaX / this.cameras.main.zoom;
        this.cameras.main.scrollY += event.deltaY / this.cameras.main.zoom;
      }
    }, { passive: false });

    const ship = activeShip(this.state);
    this.mode = ship.docked ? 'interior' : 'flight';
    this.setArtworkOpacity(this.mode === 'interior' ? 0 : 1);
    this.refreshCameraZoom();
    this.onViewChange(this.mode);
    this.refreshViews();
    this.onStateChange();
    this.announce(ship.docked ? 'HANGAR READY · CHOOSE LAUNCH OR EXPLORE THE INTERIOR' :
      'SHIP CONTROL ONLINE · RETURN TO THE MOTHERSHIP TO DOCK');
  }

  private setArtworkOpacity(roofAlpha: number): void {
    if (!this.art) return;
    this.art.roof.setAlpha(roofAlpha);
    this.art.interior.setAlpha(1 - roofAlpha);
  }

  /** Rebuild exterior and interior artwork after the player changes rooms. */
  drawMothership(): void {
    const roofAlpha = this.mode === 'interior' ? 0 : 1;
    this.art?.roof.destroy(true);
    this.art?.interior.destroy(true);
    this.art = buildMothershipArtwork(this, this.state, HOME.x, HOME.y);
    this.setArtworkOpacity(roofAlpha);
    if (!this.dockRing) {
      this.dockRing = this.add.graphics().setDepth(3);
      this.dockRing.lineStyle(1, 0x6789a7, .32);
      this.dockRing.strokeCircle(HOME.x, HOME.y, DOCK_RADIUS);
      this.dockRing.lineStyle(1, 0x7595b0, .13);
      this.dockRing.strokeCircle(HOME.x, HOME.y, DOCK_RADIUS + 20);
      const dockMarker = this.add.text(MOTHERSHIP.entrance.x, MOTHERSHIP.entrance.y - 67,
        'HANGAR 01 / APPROACH', {
          fontFamily: 'monospace', fontSize: '13px', color: '#bad5e9', letterSpacing: 2,
        }).setOrigin(.5).setDepth(5);
      dockMarker.setData('purpose', 'hangar-entry');
    }
  }

  private deviceScale(): number {
    return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  }
  private flightZoom(): number {
    return (window.innerWidth < 680 ? .87 : window.innerWidth < 1100 ? 1.05 : 1.16) * this.deviceScale();
  }
  private interiorZoom(): number {
    const reservedWidth = window.innerWidth >= 1000 ? 390 : window.innerWidth >= 700 ? 180 : 0;
    const availableWidth = Math.max(280, window.innerWidth - reservedWidth - 75);
    const availableHeight = Math.max(300, window.innerHeight - 185);
    return Math.max(.26, Math.min(1.05, availableWidth / 1220, availableHeight / 850)) * this.deviceScale();
  }
  private interiorFocus(): Point {
    const rightPanelOffset = window.innerWidth >= 1000 ? 165 : window.innerWidth >= 700 ? 80 : 0;
    const zoomCss = this.interiorZoom() / this.deviceScale();
    return { x: HOME.x + rightPanelOffset / Math.max(.25, zoomCss), y: HOME.y };
  }
  getCameraStatus(): { zoom: number; worldX: number; worldY: number } {
    const camera=this.cameras?.main;
    if (!camera) return { zoom: 1, worldX: HOME.x, worldY: HOME.y };
    return {
      zoom: camera.zoom/this.deviceScale(),
      worldX: camera.midPoint.x,
      worldY: camera.midPoint.y,
    };
  }

  /** Device-independent camera sizes and safe layout on window resize. */
  refreshCameraZoom(): void {
    if (!this.cameras?.main) return;
    if (this.mode === 'transition') return;
    if (this.mode === 'interior') {
      if (this.cameraTouched) return;
      const center = this.interiorFocus();
      this.cameras.main.setZoom(this.interiorZoom());
      this.cameras.main.centerOn(center.x, center.y);
    } else {
      const ship = activeShip(this.state);
      this.cameras.main.setZoom(this.flightZoom());
      this.cameras.main.centerOn(ship.docked ? HOME.x : ship.x, ship.docked ? HOME.y : ship.y);
    }
  }
  private setViewMode(mode: ViewMode): void {
    this.mode = mode;
    this.pinch = undefined;
    this.onViewChange(mode);
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-50);
    g.fillGradientStyle(0x091524, 0x05080d, 0x050b15, 0x020509);
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    let seed = 41097;
    const rand = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 1150; i++) {
      g.fillStyle(rand() > .8 ? 0xbdd9f4 : 0x67849c, .15 + rand() * .53);
      g.fillCircle(rand() * WORLD.width, rand() * WORLD.height, rand() > .95 ? 1.5 : .6);
    }
    g.lineStyle(1, 0x486884, .1);
    for (let x = 0; x < WORLD.width; x += 200) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y < WORLD.height; y += 200) g.lineBetween(0, y, WORLD.width, y);
    g.lineStyle(1, 0x7598b5, .12);
    g.strokeCircle(HOME.x, HOME.y, 920);
    g.strokeCircle(HOME.x, HOME.y, 1250);
    this.add.text(HOME.x - 1050, HOME.y - 1200, 'VESTA / ANCHOR POINT', {
      fontFamily: 'monospace', fontSize: '17px', color: '#7790ac', letterSpacing: 3,
    }).setDepth(-1);
  }

  private makeAsteroid(asteroid: Asteroid): Phaser.GameObjects.Container {
    const object = this.add.container(asteroid.x, asteroid.y).setDepth(10);
    const graphics = this.add.graphics();
    const size = asteroid.size;
    graphics.fillStyle(asteroid.ore === 'copper' ? 0x475d70 : 0x667d93, .78);
    graphics.lineStyle(2, asteroid.ore === 'copper' ? 0xb6afad : 0xd1e2f5, .87);
    graphics.beginPath();
    for (let i=0;i<=8;i++) {
      const angle = i * Math.PI / 4;
      const irregular = .77 + .23 * Math.abs(Math.sin((i + size) * 2.4));
      if (i===0) graphics.moveTo(Math.cos(angle)*size*irregular,Math.sin(angle)*size*irregular);
      else graphics.lineTo(Math.cos(angle)*size*irregular,Math.sin(angle)*size*irregular);
    }
    graphics.closePath();graphics.fillPath();graphics.strokePath();
    graphics.lineStyle(1,0xd2e0ee,.4);
    graphics.lineBetween(-size*.3,-size*.24,size*.37,size*.18);
    object.add(graphics);
    object.add(this.add.text(0,-size-26,asteroid.ore.toUpperCase(),{
      fontFamily:'monospace',fontSize:'12px',color:'#9db8cc',
    }).setOrigin(.5));
    object.setVisible(asteroid.remaining > 0);
    return object;
  }

  private makeShip(ship: Ship): Phaser.GameObjects.Container {
    const view = this.add.container(ship.x, ship.y).setDepth(19);
    const g = this.add.graphics();
    const size = shipBerthSpan(ship) > 1 ? 1.22 : 1;
    g.fillStyle(ship.id==='scout'?0xeaf6ff:0xb3cee3,.96);
    g.lineStyle(1.8,0xffffff,.95);
    g.beginPath();g.moveTo(30,0);g.lineTo(-16,-17);g.lineTo(-9,-3);
    g.lineTo(-16,17);g.closePath();g.fillPath();g.strokePath();
    g.fillStyle(0x071421,1);g.fillTriangle(-6,-8,12,0,-6,8);
    g.fillStyle(0x8bbce4,.8);g.fillTriangle(-16,-7,-31,0,-16,7);
    g.lineStyle(1,0x6a879f,.8);g.lineBetween(-11,0,-23,0);
    view.add(g); view.setScale(size);
    const label = this.add.text(ship.x,ship.y-42,ship.name,{
      fontFamily:'monospace',fontSize:'12px',color:'#c5d9e9',
    }).setOrigin(.5).setDepth(20);
    view.setData('label',label);
    return view;
  }

  private refreshViews(): void {
    for(const ship of this.state.ships) {
      const view = this.shipViews.get(ship.id);
      if(!view)continue;
      // Keep the vessel visible during in-hangar parking and departure.
      const visible = !ship.docked || this.mode==='interior' || this.mode==='transition';
      view.setVisible(visible);
      view.setPosition(ship.x,ship.y);
      view.setRotation(ship.angle);
      const label=view.getData('label') as Phaser.GameObjects.Text;
      label.setPosition(ship.x,ship.y-43);
      label.setVisible(visible);
      label.setColor(ship.id===this.state.activeShipId?'#eaf6ff':'#9db3c8');
    }
    for(const asteroid of this.state.asteroids){
      const view=this.asteroidViews.get(asteroid.id);
      view?.setVisible(asteroid.remaining > 0);
    }
    this.rangeIndicator.clear();
    const active=activeShip(this.state);
    if(this.mode==='flight'&&!active.docked){
      this.rangeIndicator.lineStyle(1,0xb5d6f5,.17);
      this.rangeIndicator.strokeCircle(active.x,active.y,MINE_RANGE);
    }
  }

  private stepManual(dt: number): void {
    const ship=activeShip(this.state);
    if(ship.docked)return;
    let dx=0,dy=0;
    if(this.keys.W.isDown||this.keys.UP.isDown)dy--;
    if(this.keys.S.isDown||this.keys.DOWN.isDown)dy++;
    if(this.keys.A.isDown||this.keys.LEFT.isDown)dx--;
    if(this.keys.D.isDown||this.keys.RIGHT.isDown)dx++;
    if(dx||dy){
      const length=Math.hypot(dx,dy);
      ship.x=Phaser.Math.Clamp(ship.x+dx/length*ship.speed*dt,35,WORLD.width-35);
      ship.y=Phaser.Math.Clamp(ship.y+dy/length*ship.speed*dt,35,WORLD.height-35);
    }
    const pointer=this.input.activePointer;
    ship.angle=Phaser.Math.Angle.Between(ship.x,ship.y,pointer.worldX,pointer.worldY);
  }

  private stepMining(dt:number):void {
    this.beam.clear();
    const ship=activeShip(this.state);
    if(ship.docked)return;
    let target: Asteroid | undefined;
    const pointer=this.input.activePointer;
    if(pointer.isDown){
      let best=65;
      for(const asteroid of this.state.asteroids){
        if(asteroid.remaining<=0)continue;
        const hit=Math.hypot(pointer.worldX-asteroid.x,pointer.worldY-asteroid.y);
        if(hit<best){best=hit;target=asteroid;}
      }
    }
    if(!target && this.keys.SPACE.isDown)target=nearestDeposit(this.state,ship);
    if(!target || distance(ship,target)>MINE_RANGE)return;
    const mined=extractOre(this.state,ship,target,dt*ship.miningRate);
    if(mined>0){
      this.beam.lineStyle(8,0x7bbae8,.15);
      this.beam.lineBetween(ship.x,ship.y,target.x,target.y);
      this.beam.lineStyle(2,0xeaf7ff,.9);
      this.beam.lineBetween(ship.x,ship.y,target.x,target.y);
    }
  }

  /** Smoothly move a ship and camera through a single cinematic sequence. */
  private animateShip(ship:Ship, end:Point, duration:number, endZoom:number,
      onComplete:()=>void):void {
    const camera=this.cameras.main;
    const from={x:ship.x,y:ship.y,zoom:camera.zoom,scrollX:camera.scrollX,scrollY:camera.scrollY};
    const tween=this.tweens.addCounter({
      from:0,to:1,duration,ease:'Sine.InOut',
      onUpdate:(t)=>{
        const progress=t.getValue() ?? 0;
        ship.x=Phaser.Math.Linear(from.x,end.x,progress);
        ship.y=Phaser.Math.Linear(from.y,end.y,progress);
        ship.angle=-Math.PI/2;
        camera.setZoom(Phaser.Math.Linear(from.zoom,endZoom,progress));
        const viewX=Phaser.Math.Linear(from.x,end.x,progress);
        const viewY=Phaser.Math.Linear(from.y,end.y,progress);
        camera.centerOn(viewX,viewY);
      },
      onComplete,
    });
    void tween;
  }

  private animateCameraTo(target:Point, targetZoom:number, duration:number,
      onComplete?:()=>void):void {
    const camera=this.cameras.main;
    const start={x:camera.midPoint.x,y:camera.midPoint.y,zoom:camera.zoom};
    // Camera.midPoint follows centerOn on every tween update.
    this.tweens.addCounter({
      from:0,to:1,duration,ease:'Sine.InOut',
      onUpdate:(t)=>{
        const p=t.getValue() ?? 0;
        camera.setZoom(Phaser.Math.Linear(start.zoom,targetZoom,p));
        camera.centerOn(Phaser.Math.Linear(start.x,target.x,p),Phaser.Math.Linear(start.y,target.y,p));
      },
      onComplete,
    });
  }

  /** Cinematic landing: approach roof hatch, dissolve armor, taxi to unique berth. */
  private beginDocking():void {
    if(this.mode!=='flight')return;
    const ship=activeShip(this.state);
    if(ship.docked)return;
    if(distance(ship,HOME)>DOCK_RADIUS){
      this.announce('APPROACH MOTHERSHIP BEFORE REQUESTING DOCKING');return;
    }
    const slot=findAvailableBerth(this.state,ship);
    if(slot===null){this.announce('HANGAR FULL · EXPAND OR UPGRADE THE HANGAR');return;}
    this.cameraTouched=false;
    this.cameras.main.stopFollow();
    this.setViewMode('transition');
    this.announce('AUTODOCK ENGAGED · ALIGNING WITH HANGAR 01');
    this.animateShip(ship,MOTHERSHIP.approach,1100,this.flightZoom()*1.08,()=>{
      this.animateShip(ship,MOTHERSHIP.entrance,850,this.flightZoom()*1.25,()=>{
        if(!this.art)return;
        this.tweens.add({targets:this.art.roof,alpha:0,duration:1050,ease:'Sine.InOut'});
        this.tweens.add({targets:this.art.interior,alpha:1,duration:1050,ease:'Sine.InOut'});
        const local=berthLocalPosition(slot,shipBerthSpan(ship));
        const destination={x:HOME.x+local.x,y:HOME.y+local.y};
        this.announce('HANGAR OPEN · BAY '+String(slot+1).padStart(2,'0')+' RESERVED');
        this.animateShip(ship,destination,1550,this.flightZoom()*1.1,()=>{
          const result=dockShip(this.state,ship);
          if(result!=='docked'){
            this.setArtworkOpacity(1);
            this.setViewMode('flight');
            this.refreshCameraZoom();
            this.announce('DOCKING CANCELED · '+result.toUpperCase());
            return;
          }
          ship.angle=0;
          this.animateCameraTo(this.interiorFocus(),this.interiorZoom(),1300,()=>{
            this.setArtworkOpacity(0);
            this.setViewMode('interior');
            this.cameraTouched=false;
            this.refreshCameraZoom();
            this.onStateChange();
            this.saving();
            this.announce('DOCKING COMPLETE · PARKED IN BAY '+String((ship.berth??0)+1).padStart(2,'0'));
          });
        });
      });
    });
  }

  /** Launch is the same continuous world sequence played outward. */
  private beginLaunching():void {
    if(this.mode!=='interior')return;
    const ship=activeShip(this.state);
    if(!ship.docked)return;
    this.cameraTouched=false;
    this.cameras.main.stopFollow();
    this.setViewMode('transition');
    this.announce('HANGAR DEPARTURE AUTHORIZED · OPENING AIRLOCK');
    this.animateShip(ship,MOTHERSHIP.entrance,1500,this.flightZoom()*1.23,()=>{
      if(this.art){
        this.tweens.add({targets:this.art.roof,alpha:1,duration:1060,ease:'Sine.InOut'});
        this.tweens.add({targets:this.art.interior,alpha:0,duration:1060,ease:'Sine.InOut'});
      }
      this.animateShip(ship,MOTHERSHIP.departure,1300,this.flightZoom(),()=>{
        launchShip(ship);
        this.setArtworkOpacity(1);
        this.setViewMode('flight');
        this.cameras.main.setZoom(this.flightZoom());
        this.cameraAnchor.setPosition(ship.x,ship.y);
        this.cameras.main.startFollow(this.cameraAnchor,true,.09,.09);
        this.onStateChange();
        this.saving();
        this.announce('LAUNCH COMPLETE · YOU ARE CLEAR OF THE MOTHERSHIP');
      });
    });
  }

  /** Keyboard E and the action bar use identical stateful transitions. */
  launchOrDock():void {
    if(this.mode==='transition')return;
    if(activeShip(this.state).docked)this.beginLaunching();
    else this.beginDocking();
  }

  selectShip(id:string):void {
    if(this.mode==='transition')return;
    if(!switchShip(this.state,id))return;
    const ship=activeShip(this.state);
    if(ship.docked){
      this.setArtworkOpacity(0);
      this.setViewMode('interior');
      this.cameraTouched=false;
      this.cameras.main.stopFollow();
      this.refreshCameraZoom();
    }else{
      this.setArtworkOpacity(1);
      this.setViewMode('flight');
      this.cameraAnchor.setPosition(ship.x,ship.y);
      this.cameras.main.startFollow(this.cameraAnchor,true,.09,.09);
      this.refreshCameraZoom();
    }
    this.announce('CONTROL TRANSFER · '+ship.name);
    this.onStateChange();
  }

  nextShip():void {
    const index=this.state.ships.findIndex(ship=>ship.id===this.state.activeShipId);
    this.selectShip(this.state.ships[(index+1)%this.state.ships.length].id);
  }
  setControlsBlocked(blocked:boolean):void {
    this.controlsBlocked=blocked;
    if(blocked&&this.beam)this.beam.clear();
  }

  /** User may open the visual cutaway at any time when docked. */
  recenterInterior():void {
    if(this.mode!=='interior')return;
    this.cameraTouched=false;
    this.pinch=undefined;
    this.animateCameraTo(this.interiorFocus(),this.interiorZoom(),480);
  }
  private setInteriorZoom(zoom:number,point?:Point):void {
    if(this.mode!=='interior')return;
    const camera=this.cameras.main;
    const dpr=this.deviceScale();
    const before=point?camera.getWorldPoint(point.x,point.y):undefined;
    camera.setZoom(Phaser.Math.Clamp(zoom,.23*dpr,2.45*dpr));
    if(point&&before){
      const after=camera.getWorldPoint(point.x,point.y);
      camera.scrollX += before.x-after.x;
      camera.scrollY += before.y-after.y;
    }
    this.cameraTouched=true;
  }
  zoomInterior(direction:number):void {
    if(this.mode!=='interior')return;
    this.cameras.main.stopFollow();
    this.setInteriorZoom(this.cameras.main.zoom*(direction>0?1.22:1/1.22));
  }

  /** Finger gestures act on the cutaway, not the world/ship or game controls. */
  private updateTouchNavigation():void {
    if(this.mode!=='interior'){this.pinch=undefined;return;}
    const held=this.input.manager.pointers.filter(pointer=>pointer.isDown);
    if(held.length<2){this.pinch=undefined;return;}
    const [one,two]=held;
    const cx=(one.x+two.x)/2,cy=(one.y+two.y)/2;
    const separation=Math.max(8,Math.hypot(one.x-two.x,one.y-two.y));
    const camera=this.cameras.main;
    camera.stopFollow();
    if(this.pinch){
      const oldWorld=camera.getWorldPoint(this.pinch.centerX,this.pinch.centerY);
      const targetZoom=camera.zoom*(separation/Math.max(8,this.pinch.distance));
      this.setInteriorZoom(targetZoom,{x:cx,y:cy});
      const nowWorld=camera.getWorldPoint(cx,cy);
      camera.scrollX+=oldWorld.x-nowWorld.x;
      camera.scrollY+=oldWorld.y-nowWorld.y;
    }
    this.pinch={centerX:cx,centerY:cy,distance:separation};
    this.cameraTouched=true;
  }

  update(_time:number,delta:number):void {
    const manualStep=Math.min(.05,Math.max(0,delta/1000));
    this.updateTouchNavigation();
    if(!this.controlsBlocked && this.mode!=='transition'){
      // E and Q are handled centrally in main.ts, including when UI buttons have focus.
      if(this.mode==='flight'){
        this.stepManual(manualStep);
        this.stepMining(manualStep);
      }
    }
    // Cinematics pause the autonomous fleet for a few seconds to reserve a
    // stable berth and prevent a parallel docking task from stealing its slot.
    const elapsed=this.mode==='transition'?0:advanceActiveSimulation(this.state,delta/1000);
    if(this.mode==='flight' && !this.cameraTouched){
      const ship=activeShip(this.state);
      this.cameraAnchor.setPosition(ship.x,ship.y);
    }
    this.refreshViews();
    this.timeToUpdateUI+=delta/1000;
    this.timeToSave+=elapsed;
    if(this.timeToUpdateUI>=.15){
      this.onStateChange();
      this.timeToUpdateUI=0;
    }
    if(this.timeToSave>=12){
      this.saving();
      this.timeToSave=0;
    }
  }
}
