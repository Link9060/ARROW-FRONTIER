import Phaser from 'phaser';
import {
  activeShip, advanceActiveSimulation, dockShip, extractOre, launchShip,
  nearestDeposit, switchShip,
} from '../sim/engine';
import { distance, DOCK_RADIUS, HOME, MINE_RANGE, WORLD } from '../sim/model';
import { berthWorldPosition, dockingPort, findAvailableBerth } from '../sim/hangar';
import { arrowOutline, hullSize } from '../sim/arrowGeometry';
import { dockingRoute, departureRoute, inTractorStage, segmentDuration, shortestAngle } from '../sim/dockingRoute';
import type { DockWaypoint } from '../sim/dockingRoute';
import { buildMothershipArtwork } from './MothershipArt';
import type { MothershipArtwork } from './MothershipArt';
import { locateDeckCell } from './deckLayout';
import { resolveHullMovement } from '../sim/hullCollision';
import { MiningEffects } from './MiningEffects';
import type { Asteroid, GameState, Point, Ship } from '../sim/model';

export type ViewMode = 'flight' | 'interior' | 'transition';
interface PinchGesture { centerX: number; centerY: number; distance: number; }

export class FlightScene extends Phaser.Scene {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private shipViews = new Map<string, Phaser.GameObjects.Container>();
  private asteroidViews = new Map<string, Phaser.GameObjects.Container>();
  private art?: MothershipArtwork;
  private dockRing?: Phaser.GameObjects.Graphics;
  private miningEffects!: MiningEffects;
  private rangeIndicator!: Phaser.GameObjects.Graphics;
  private tractorBeam!: Phaser.GameObjects.Graphics;
  private tractorPhase = 0;
  private controlsBlocked = true;
  private virtualMove = {x:0,y:0};
  private virtualMining = false;
  private velocity = new Map<string,{x:number,y:number}>();
  private cameraAnchor!: Phaser.GameObjects.Zone;
  private mode: ViewMode = 'flight';
  private pinch?: PinchGesture;
  private cameraTouched = false;
  private deckClick?: (x:number,y:number)=>void;
  private hadMultitouch = false;
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
  setDeckSelectionHandler(handler:(x:number,y:number)=>void):void {
    this.deckClick=handler;
  }

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

    this.miningEffects = new MiningEffects(this);
    this.tractorBeam = this.add.graphics().setDepth(28);
    this.rangeIndicator = this.add.graphics().setDepth(4);
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q'
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameraAnchor = this.add.zone(HOME.x, HOME.y, 1, 1).setVisible(false);
    this.input.addPointer(3);
    this.game.canvas.style.touchAction = 'none';
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>{
      if(this.mode!=='interior'||document.body.dataset.uiPanel!=='build')return;
      if(this.hadMultitouch)return;
      const x=pointer.worldX-HOME.x;
      const y=pointer.worldY-HOME.y;
      const cell=locateDeckCell(x,y);
      if(cell)this.deckClick?.(cell.x,cell.y);
    });

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
      // Entry is indicated by the actual roof airlock; no floating debug labels.
    }
  }

  private deviceScale(): number {
    return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  }
  private flightZoom(): number {
    return (window.innerWidth < 680 ? .87 : window.innerWidth < 1100 ? 1.05 : 1.16) * this.deviceScale();
  }
  private interiorMargins(): {left:number;right:number} {
    const panelOpen = document.body.dataset.uiPanel === 'build' ||
      document.body.dataset.uiPanel === 'fleet';
    return {
      left:window.innerWidth > 760 ? 300 : 0,
      right:panelOpen ? Math.min(365,window.innerWidth*.32) : 0,
    };
  }
  private interiorZoom(): number {
    const margins=this.interiorMargins();
    const availableWidth=Math.max(240,window.innerWidth-margins.left-margins.right-55);
    const availableHeight=Math.max(280,window.innerHeight-155);
    return Math.max(.24,Math.min(1.12,availableWidth/1220,availableHeight/850))*this.deviceScale();
  }
  private interiorFocus(): Point {
    const margins=this.interiorMargins();
    const offset=(margins.left-margins.right)/2;
    const cssZoom=this.interiorZoom()/this.deviceScale();
    return {x:HOME.x-offset/Math.max(.24,cssZoom),y:HOME.y};
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
    if(mode !== 'flight')this.velocity.clear();
    this.pinch = undefined;
    this.onViewChange(mode);
  }

  private drawBackground(): void {
    const base=this.add.graphics().setDepth(-80);
    base.fillGradientStyle(0x080809,0x050506,0x0a0a0b,0x020203);
    base.fillRect(0,0,WORLD.width,WORLD.height);

    let seed=9060;
    const rnd=():number=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    };

    // Immense softly graded gas fields, almost black. Nested ellipses simulate
    // the nebula glow without images, heavy filters, or a giant screenshot.
    const clouds=[
      {x:HOME.x+1100,y:HOME.y-950,w:1300,h:740},
      {x:HOME.x-1200,y:HOME.y+850,w:1500,h:1020},
      {x:HOME.x+300,y:HOME.y+1050,w:650,h:490},
    ];
    for(const cloud of clouds){
      for(let layer=11;layer>=1;layer--){
        base.fillStyle(layer%2?0x7a7a83:0x9d9d9f,(12-layer)*.0035);
        base.fillEllipse(cloud.x,cloud.y,cloud.w*layer/12,cloud.h*layer/12);
      }
    }

    // Three depths of white star fields with different parallax. UI belongs
    // above these; no tiled editor grid or floating system text.
    const far=this.add.graphics().setDepth(-70).setScrollFactor(.96);
    for(let i=0;i<960;i++){
      const x=rnd()*WORLD.width,y=rnd()*WORLD.height;
      const alpha=.12+rnd()*.58,r=rnd()>.965?1.4:.35+rnd()*.48;
      far.fillStyle(rnd()>.87?0xf1f1f1:0x929296,alpha);
      far.fillCircle(x,y,r);
    }
    const nearer=this.add.graphics().setDepth(-62).setScrollFactor(.88);
    for(let i=0;i<155;i++){
      const x=rnd()*WORLD.width,y=rnd()*WORLD.height;
      const r=1+rnd()*1.5;
      nearer.fillStyle(0xe4e4e7,.08+rnd()*.36);
      nearer.fillCircle(x,y,r);
      if(i%25===0){
        nearer.lineStyle(.6,0xe4e4e7,.13);
        nearer.lineBetween(x-5,y,x+5,y);
        nearer.lineBetween(x,y-5,x,y+5);
      }
    }

    // Sparse drifting logo-like craft/shards echo the ARROW experience page.
    const motes=this.add.graphics().setDepth(-50).setScrollFactor(.78);
    for(let i=0;i<38;i++){
      const x=rnd()*WORLD.width,y=rnd()*WORLD.height,s=2+rnd()*5;
      const alpha=.1+rnd()*.18;
      motes.fillStyle(0xc9c9cb,alpha);
      motes.fillTriangle(x+s,y,x-s*.7,y-s*.54,x-s*.32,y);
      motes.fillTriangle(x+s,y,x-s*.7,y+s*.54,x-s*.32,y);
    }

    // Navigation halo stays at physical home, deliberately almost invisible.
    const navigation=this.add.graphics().setDepth(-45);
    navigation.lineStyle(.75,0xbdbdbf,.045);
    navigation.strokeCircle(HOME.x,HOME.y,900);
    navigation.strokeCircle(HOME.x,HOME.y,1390);
    navigation.lineStyle(.75,0x9e9ea0,.028);
    navigation.strokeCircle(HOME.x,HOME.y,1800);
  }

  private makeAsteroid(asteroid: Asteroid): Phaser.GameObjects.Container {
    const object = this.add.container(asteroid.x, asteroid.y).setDepth(10);
    const graphics = this.add.graphics();
    const size = asteroid.size;
    graphics.fillStyle(asteroid.ore === 'copper' ? 0x656567 : 0x7d7d7f, .8);
    graphics.lineStyle(1.5, asteroid.ore === 'copper' ? 0xc7c7c8 : 0xe1e1e1, .85);
    graphics.beginPath();
    for (let i=0;i<=8;i++) {
      const angle = i * Math.PI / 4;
      const irregular = .77 + .23 * Math.abs(Math.sin((i + size) * 2.4));
      if (i===0) graphics.moveTo(Math.cos(angle)*size*irregular,Math.sin(angle)*size*irregular);
      else graphics.lineTo(Math.cos(angle)*size*irregular,Math.sin(angle)*size*irregular);
    }
    graphics.closePath();graphics.fillPath();graphics.strokePath();
    graphics.lineStyle(1,0xd1d1d1,.4);
    graphics.lineBetween(-size*.3,-size*.24,size*.37,size*.18);
    object.add(graphics);
    object.add(this.add.text(0,-size-26,asteroid.ore.toUpperCase(),{
      fontFamily:'Inter, sans-serif',fontSize:'11px',color:'#ababac',
    }).setOrigin(.5));
    object.setVisible(asteroid.remaining > 0);
    return object;
  }

  /** Every craft uses the exact same 4-vertex mark as the ARROW website. */
  private makeShip(ship: Ship): Phaser.GameObjects.Container {
    const view = this.add.container(ship.x, ship.y).setDepth(19);
    const g = this.add.graphics();
    const size = hullSize(ship);
    const outline = arrowOutline(size.length,size.widthScale);
    g.fillStyle(ship.id==='scout'?0xf7f7f7:0xcacacc,1);
    g.lineStyle(1.4,0xffffff,.95);
    g.beginPath();
    outline.forEach(([x,y],i)=>{if(i===0)g.moveTo(x,y);else g.lineTo(x,y);});
    g.closePath();g.fillPath();g.strokePath();
    // Subtle material seams and the recognizable inward tail notch remain.
    g.lineStyle(1,0x666669,.77);
    g.lineBetween(-size.length*.30,-size.length*.11,size.length*.25,0);
    g.lineBetween(-size.length*.30,size.length*.11,size.length*.25,0);
    g.fillStyle(0x101012,.92);
    g.fillTriangle(size.length*.17,-size.length*.047,size.length*.38,0,size.length*.17,size.length*.047);
    if(/miner|industrial/i.test(ship.role)){
      g.lineStyle(2,0x8b8b8d,.86);
      g.lineBetween(-size.length*.25,-size.length*.27,-size.length*.08,-size.length*.19);
      g.lineBetween(-size.length*.25,size.length*.27,-size.length*.08,size.length*.19);
      g.fillStyle(0xebebec,.8);
      g.fillCircle(-size.length*.13,-size.length*.21,3);
      g.fillCircle(-size.length*.13,size.length*.21,3);
    }
    view.add(g);
    const label = this.add.text(ship.x,ship.y-51,ship.name,{
      fontFamily:'Inter, sans-serif',fontSize:'12px',color:'#d8d8da',
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
      // Flight already has an active-ship HUD. Hide duplicate active labels
      // and nearby nonactive names that obscure asteroids and other vessels.
      const active=activeShip(this.state);
      label.setVisible(visible && (this.mode==='interior' ||
        (ship.id!==active.id && distance(ship,active)>105)));
      label.setColor(ship.id===this.state.activeShipId?'#eeeeee':'#99999c');
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
    dy+=this.virtualMove.y;
    if(this.keys.S.isDown||this.keys.DOWN.isDown)dy++;
    if(this.keys.A.isDown||this.keys.LEFT.isDown)dx--;
    if(this.keys.D.isDown||this.keys.RIGHT.isDown)dx++;
    dx+=this.virtualMove.x;
    // Acceleration and gentle damping make piloting feel like a vehicle, not
    // moving a cursor around a desktop. The speed cap is unchanged.
    const v=this.velocity.get(ship.id)??{x:0,y:0};
    const length=Math.hypot(dx,dy);
    const acceleration=ship.speed*4.5;
    if(length>0){
      v.x+=(dx/length)*acceleration*dt;
      v.y+=(dy/length)*acceleration*dt;
    }
    const drag=Math.exp(-3.8*dt);
    v.x*=drag;v.y*=drag;
    const speed=Math.hypot(v.x,v.y);
    if(speed>ship.speed){v.x*=ship.speed/speed;v.y*=ship.speed/speed;}
    const resolved=resolveHullMovement(ship,{
      x:Phaser.Math.Clamp(ship.x+v.x*dt,35,WORLD.width-35),
      y:Phaser.Math.Clamp(ship.y+v.y*dt,35,WORLD.height-35),
    },this.state);
    if(Math.abs(resolved.x-ship.x)<.001)v.x=0;
    if(Math.abs(resolved.y-ship.y)<.001)v.y=0;
    ship.x=resolved.x;ship.y=resolved.y;
    this.velocity.set(ship.id,v);
    const pointer=this.input.activePointer;
    if(this.virtualMove.x||this.virtualMove.y){
      ship.angle=Math.atan2(this.virtualMove.y,this.virtualMove.x);
    }else if(pointer){
      ship.angle=Phaser.Math.Angle.Between(ship.x,ship.y,pointer.worldX,pointer.worldY);
    }
  }

  private stepMining(dt:number):void {
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
    if(!target && (this.keys.SPACE.isDown||this.virtualMining))target=nearestDeposit(this.state,ship);
    if(!target || distance(ship,target)>MINE_RANGE)return;
    const mined=extractOre(this.state,ship,target,dt*ship.miningRate);
    if(mined>0){
      this.miningEffects.fire(ship,target,mined);
    }
  }

  /** Smoothly move a ship and camera through a single cinematic sequence. */
  /** A subtle physical tether originates from the shoulder's tractor emitter. */
  private drawTractor(ship:Ship, progress:number):void {
    this.tractorBeam.clear();
    const port=dockingPort(this.state);
    const sx=port.tractor.x;
    const sy=port.tractor.y;
    const dx=ship.x-sx,dy=ship.y-sy,dist=Math.hypot(dx,dy);
    if(dist<6)return;
    const ux=dx/dist,uy=dy/dist,px=-uy,py=ux;
    const grow=Math.min(1,progress*3.5);
    const endX=sx+dx*grow,endY=sy+dy*grow;
    const width=8+Math.sin(this.tractorPhase*4)*1.5;
    this.tractorBeam.fillStyle(0xeaeaea,.075);
    this.tractorBeam.fillTriangle(
      sx+px*width*2,sy+py*width*2,
      sx-px*width*2,sy-py*width*2,
      endX,endY,
    );
    this.tractorBeam.lineStyle(2.2,0xffffff,.58);
    this.tractorBeam.lineBetween(sx,sy,endX,endY);
    this.tractorBeam.lineStyle(.9,0xe3e3e3,.68);
    this.tractorBeam.lineBetween(sx+px*4,sy+py*4,endX,endY);
    this.tractorBeam.lineBetween(sx-px*4,sy-py*4,endX,endY);
    // An energy pulse travels along the tether, not a static light stick.
    const p=(this.tractorPhase*1.5)%1;
    this.tractorBeam.fillStyle(0xffffff,.55);
    this.tractorBeam.fillCircle(sx+dx*p,sy+dy*p,3.2);
    this.tractorBeam.lineStyle(1,0xffffff,.3);
    this.tractorBeam.strokeCircle(endX,endY,7+2*Math.sin(this.tractorPhase*5));
  }

  /**
   * Fly each segment with speed derived from distance. Align the nose to the
   * direction of travel instead of teleporting or forcing the same heading.
   * Travel never moves through the opaque central hull.
   */
  private flyRoute(ship:Ship, waypoints:DockWaypoint[], leaving:boolean,
      onComplete:()=>void):void {
    let index=0,previousStage='';
    const next=():void=>{
      if(index>=waypoints.length){
        this.tractorBeam.clear();
        onComplete();
        return;
      }
      const destination=waypoints[index++];
      if(destination.stage!==previousStage){
        previousStage=destination.stage;
        if(!leaving&&destination.stage==='tractor'){
          this.announce('TRACTOR LOCK · GUIDING FINAL APPROACH');
        }
        if(!leaving&&destination.stage==='taxi'){
          if(this.art){
            this.tweens.add({targets:this.art.roof,alpha:0,duration:900,ease:'Sine.InOut'});
            this.tweens.add({targets:this.art.interior,alpha:1,duration:900,ease:'Sine.InOut'});
          }
        }
        if(leaving&&destination.stage==='clearance'){
          if(this.art){
            this.tweens.add({targets:this.art.roof,alpha:1,duration:950,ease:'Sine.InOut'});
            this.tweens.add({targets:this.art.interior,alpha:0,duration:950,ease:'Sine.InOut'});
          }
        }
      }
      const start={x:ship.x,y:ship.y,heading:ship.angle,zoom:this.cameras.main.zoom};
      const targetHeading=destination.heading ??
        Math.atan2(destination.point.y-start.y,destination.point.x-start.x);
      const heading=shortestAngle(start.heading,targetHeading);
      const duration=segmentDuration(start,destination.point,destination.speed);
      const targetZoom=this.flightZoom()*(
        destination.stage==='align'?.89:
        destination.stage==='approach'?1.04:
        destination.stage==='tractor'?1.16:
        destination.stage==='entry'?1.23:1.12
      );
      this.tweens.addCounter({
        from:0,to:1,duration,
        ease:destination.stage==='taxi'?'Sine.InOut':'Linear',
        onUpdate:(t)=>{
          const p=t.getValue()??0;
          ship.x=Phaser.Math.Linear(start.x,destination.point.x,p);
          ship.y=Phaser.Math.Linear(start.y,destination.point.y,p);
          ship.angle=Phaser.Math.Linear(start.heading,heading,Math.min(1,p*2.1));
          this.cameras.main.setZoom(Phaser.Math.Linear(start.zoom,targetZoom,p));
          this.cameras.main.centerOn(ship.x,ship.y);
          if(inTractorStage(destination.stage)){
            this.tractorPhase+=.022;
            this.drawTractor(ship,p);
          }else{
            this.tractorBeam.clear();
          }
        },
        onComplete:next,
      });
    };
    next();
  }

  private animateCameraTo(target:Point, targetZoom:number, duration:number,
      onComplete?:()=>void):void {
    const camera=this.cameras.main;
    const start={x:camera.midPoint.x,y:camera.midPoint.y,zoom:camera.zoom};
    this.tweens.addCounter({
      from:0,to:1,duration,ease:'Sine.InOut',
      onUpdate:(t)=>{
        const p=t.getValue()??0;
        camera.setZoom(Phaser.Math.Linear(start.zoom,targetZoom,p));
        camera.centerOn(
          Phaser.Math.Linear(start.x,target.x,p),
          Phaser.Math.Linear(start.y,target.y,p),
        );
      },
      onComplete,
    });
  }

  private beginDocking():void {
    if(this.mode!=='flight')return;
    const ship=activeShip(this.state);
    if(ship.docked)return;
    if(distance(ship,HOME)>DOCK_RADIUS){
      this.announce('MOVE CLOSER TO THE MOTHERSHIP TO DOCK');return;
    }
    const berth=findAvailableBerth(this.state,ship);
    if(berth===null){
      this.announce('HANGAR FULL · EXPAND THE HANGAR TO DOCK');return;
    }
    // Read the real berth position without modifying the ship or the save.
    const parked={...ship,berth};
    const destination=berthWorldPosition(parked);
    const waypoints=dockingRoute(ship,destination,dockingPort(this.state));
    this.cameraTouched=false;
    this.cameras.main.stopFollow();
    this.setViewMode('transition');
    this.announce('AUTOPILOT · ALIGNING WITH SIDE HANGAR');
    this.flyRoute(ship,waypoints,false,()=>{
      const result=dockShip(this.state,ship);
      if(result!=='docked'){
        this.setArtworkOpacity(1);
        this.setViewMode('flight');
        this.refreshCameraZoom();
        this.announce('DOCKING CANCELLED · '+result.toUpperCase());
        return;
      }
      // The destination exactly matches berthWorldPosition(). No position jump.
      ship.angle=0;
      this.animateCameraTo(this.interiorFocus(),this.interiorZoom(),1150,()=>{
        this.setArtworkOpacity(0);
        this.setViewMode('interior');
        this.cameraTouched=false;
        this.refreshCameraZoom();
        this.onStateChange();
        this.saving();
        this.announce('PARKED · BAY '+String((ship.berth??0)+1).padStart(2,'0'));
      });
    });
  }

  private beginLaunching():void {
    if(this.mode!=='interior')return;
    const ship=activeShip(this.state);
    if(!ship.docked)return;
    this.cameraTouched=false;
    this.cameras.main.stopFollow();
    this.setViewMode('transition');
    this.announce('UNDOCKING · RELEASE CLAMPS');
    const port=dockingPort(this.state);
    this.flyRoute(ship,departureRoute(ship,port),true,()=>{
      launchShip(ship);
      // Align the launch result with the actual expanded airlock, not the
      // original level-one departure location.
      ship.x=port.departure.x;
      ship.y=port.departure.y;
      this.setArtworkOpacity(1);
      this.setViewMode('flight');
      this.cameras.main.setZoom(this.flightZoom());
      this.cameraAnchor.setPosition(ship.x,ship.y);
      this.cameras.main.startFollow(this.cameraAnchor,true,.09,.09);
      this.onStateChange();
      this.saving();
      this.announce('CLEAR OF MOTHERSHIP · MANUAL CONTROL');
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
  setVirtualInput(x:number,y:number,mining:boolean):void {
    this.virtualMove={x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};
    this.virtualMining=mining;
  }
  setControlsBlocked(blocked:boolean):void {
    this.controlsBlocked=blocked;
    if(blocked)this.miningEffects?.clear();
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
    if(held.length<2){
      this.pinch=undefined;
      if(held.length===0)this.hadMultitouch=false;
      return;
    }
    this.hadMultitouch=true;
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
    this.miningEffects.update(delta/1000);
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
