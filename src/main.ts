import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/FlightScene';
import type { ViewMode } from './game/FlightScene';
import { activeShip, assignShipOrder, fleetShipStatus, roundCargo, shipOrder } from './sim/engine';
import { cargoTotal, distance, DOCK_RADIUS, HOME, storedTotal } from './sim/model';
import type { FleetOrder } from './sim/model';
import { dockedBerthCount, hangarCapacity, sideForBerth } from './sim/hangar';
import { powerReport } from './sim/mothership';
import { loadGame, saveGame, resetGame } from './sim/persistence';
import { BuilderUI } from './ui/BuilderUI';

const loaded=loadGame();
const state=loaded.state;
const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{
  const value=document.getElementById(id);
  if(!value)throw new Error('Missing ARROW element: '+id);
  return value as T;
};
let started=false;
let fleetOpen=false;
let toastTimer:ReturnType<typeof setTimeout>|undefined;
let lastView:ViewMode='interior';

function notice(text:string):void{
  const toast=$('toast');
  // Scene messages describe technical stages. Surface only compact,
  // user-facing status so nothing obscures the ship.
  const pretty=/launch complete/i.test(text)?'Ship launched':
    /docking complete/i.test(text)?'Docked safely':
    /autodock engaged/i.test(text)?'Approaching hangar…':
    /hangar open/i.test(text)?'Hangar opening…':
    /departure authorized/i.test(text)?'Launching…':
    /welcome to frontier/i.test(text)?'Welcome to Frontier':text;
  toast.textContent=pretty.length>62?pretty.slice(0,59)+'…':pretty;
  toast.classList.add('visible');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('visible'),2700);
}
function persist(feedback=false):void{
  // Never write the in-between taxi position: the last saved checkpoint
  // remains valid and playable if the page closes during a cinematic.
  if(scene.viewMode==='transition'){
    if(feedback)notice('Docking in progress. Saving after arrival.');
    return;
  }
  const saved=saveGame(state);
  if(feedback)notice(saved?'Progress saved':'Save unavailable in this browser');
}

const scene=new FlightScene(state,updateUI,notice,()=>persist(),(view:ViewMode)=>{
  if(view==='transition'){
    // Save the pre-animation position before cinematics move an undocked ship.
    saveGame(state);
    if(builder.isOpen)builder.close();
    if(fleetOpen)setFleetOpen(false);
  }
  lastView=view;
  document.body.dataset.frontierView=view;
  if(view!=='flight')clearVirtualControls();
  updateUI();
});

const builder=new BuilderUI(state,()=>{
  scene.drawMothership();
  updateUI();
  persist();
},(open:boolean)=>{
  if(open)setFleetOpen(false);
  document.body.dataset.uiPanel=open?'build':fleetOpen?'fleet':'none';
  scene.drawMothership();
  scene.refreshCameraZoom();
  updateFlightLock();
},notice);
scene.setDeckSelectionHandler((x,y)=>builder.selectCell(x,y));
const virtualKeys=new Set<string>();
const keyboardDirections=new Set<string>();
let touchMine=false;
function updateVirtualControls():void{
  const pressed=new Set([...virtualKeys,...keyboardDirections]);
  const x=(pressed.has('right')?1:0)-(pressed.has('left')?1:0);
  const y=(pressed.has('down')?1:0)-(pressed.has('up')?1:0);
  scene.setVirtualInput(x,y,touchMine);
}
function clearVirtualControls():void{
  virtualKeys.clear();
  keyboardDirections.clear();
  touchMine=false;
  document.querySelectorAll('.touch-pad button,.mine-button').forEach(element=>element.classList.remove('pressed'));
  updateVirtualControls();
}
function updateFlightLock():void{
  scene.setControlsBlocked(!started||fleetOpen||builder.isOpen);
}
function setFleetOpen(value:boolean):void{
  if(scene.viewMode==='transition'&&value)return;
  if(value&&builder.isOpen)builder.close();
  fleetOpen=value;
  $('fleet-panel').classList.toggle('open',value);
  $('fleet-panel').setAttribute('aria-hidden',String(!value));
  $('fleet-toggle').setAttribute('aria-expanded',String(value));
  document.body.dataset.uiPanel=value?'fleet':builder.isOpen?'build':'none';
  scene.refreshCameraZoom();
  updateFlightLock();
  if(value){
    builder.renderFabricator();
    updateUI();
  }
}
function requestLaunchOrDock():void{
  if(!started||scene.viewMode==='transition')return;
  if(builder.isOpen)builder.close();
  if(fleetOpen)setFleetOpen(false);
  clearVirtualControls();
  scene.launchOrDock();
}

function commandFleetShip(shipId:string,order:FleetOrder):void {
  if(!started||scene.viewMode==='transition'){
    notice('Finish the current docking sequence first.');
    return;
  }
  const target=state.ships.find(ship=>ship.id===shipId);
  if(!target)return;
  if(shipId===state.activeShipId){
    // A ship cannot be both player-piloted and autonomously assigned. Hand
    // controls to another existing ship instead of forcing the player to
    // manually launch and switch before dispatching this one.
    const replacement=state.ships.find(ship=>ship.id!==shipId&&ship.docked&&!ship.navigation) ??
      state.ships.find(ship=>ship.id!==shipId&&!ship.navigation);
    if(!replacement){
      notice('Another ship is required before delegating your own ship.');
      return;
    }
    scene.selectShip(replacement.id);
  }
  const result=assignShipOrder(state,shipId,order);
  if(result!=='assigned'){
    notice('Could not assign fleet order.');
    return;
  }
  updateUI();
  persist();
  notice(order==='mine'?target.name+' · continuous mining assigned':
    order==='return'?target.name+' · returning to mothership':
    target.name+' · holding position');
}

function updateUI():void{
  const ship=activeShip(state);
  const cargo=cargoTotal(ship.cargo);
  const stored=storedTotal(state.stored);
  const dist=distance(ship,HOME);
  const power=powerReport(state);
  const transitioning=scene.viewMode==='transition';

  $('ship-name').textContent=ship.name;
  $('ship-class').textContent=ship.role.includes('MINER')?'MINER':'SCOUT';
  $('ship-state').textContent=transitioning?'AUTODOCK':ship.docked?'DOCKED':'PILOTING';
  $('cargo').textContent=roundCargo(cargo)+' / '+ship.capacity;
  $('cargo-fill').style.width=Math.min(100,100*cargo/ship.capacity)+'%';
  $('ship-iron').textContent=roundCargo(ship.cargo.iron);
  $('ship-copper').textContent=roundCargo(ship.cargo.copper);
  $('pilot-tip').textContent=cargo>=ship.capacity-0.01?'Cargo full. Return to your mothership.':
    dist<=DOCK_RADIUS?'Within docking range. Press E or Dock.':
    (window.matchMedia('(pointer: coarse)').matches?
      '↑ thrust · ← → turn · ↓ brake · Hold Mine near an asteroid.':
      'W/↑ thrust · A/D turn · S/↓ brake · Space mine · E dock');

  $('hangar-occupancy').textContent=dockedBerthCount(state)+' / '+hangarCapacity(state)+' BAYS';
  $('hangar-summary').textContent='Hangar '+(sideForBerth(ship.berth??0)==='north'?'A':'B')+' · Bay '+String((ship.berth??0)+1).padStart(2,'0')+' · '+ship.name;
  $('hangar-camera-zoom').textContent=Math.round(scene.getCameraStatus().zoom*100)+'%';

  const launch=$<HTMLButtonElement>('launch-btn');
  const dock=$<HTMLButtonElement>('dock-btn');
  launch.disabled=!ship.docked||transitioning;
  dock.disabled=ship.docked||transitioning;
  $<HTMLButtonElement>('hangar-launch-btn').disabled=!ship.docked||transitioning;
  $('build-toggle').setAttribute('aria-disabled',String(!ship.docked||transitioning));
  $('action-eyebrow').textContent=dist<=DOCK_RADIUS?'MOTHERSHIP NEARBY':'IN FLIGHT';
  $('mission-text').textContent=dist<=DOCK_RADIUS?'Ready to dock':'Explore · mine · return';
  $('storage').textContent=roundCargo(stored)+' / '+state.storageCapacity;
  $('storage-fill').style.width=Math.min(100,100*stored/state.storageCapacity)+'%';
  $('stored-iron').textContent=roundCargo(state.stored.iron);
  $('stored-copper').textContent=roundCargo(state.stored.copper);
  $('stored-alloy').textContent=roundCargo(state.stored.alloy);
  $('power-summary').textContent=power.load+' / '+power.output;
  $('fleet-count').textContent=String(state.ships.length).padStart(2,'0');

  const list=$('fleet');
  for(const member of state.ships){
    let entry=list.querySelector<HTMLDivElement>('.fleet-entry[data-member-id="'+member.id+'"]');
    if(!entry){
      entry=document.createElement('div');
      entry.className='fleet-entry';
      entry.dataset.memberId=member.id;

      // Pilot and mission controls are separate buttons. No nested interactive
      // elements, accidental pilot changes or inaccessible click surfaces.
      const pilot=document.createElement('button');
      pilot.type='button';pilot.className='fleet-ship';
      pilot.dataset.shipId=member.id;
      pilot.title='Pilot '+member.name;
      const identity=document.createElement('span');
      identity.className='fleet-identity';
      const name=document.createElement('strong');name.className='fleet-name';
      const role=document.createElement('small');role.className='fleet-role';
      identity.append(name,role);
      const status=document.createElement('small');
      status.className='fleet-state';
      pilot.append(identity,status);
      pilot.addEventListener('click',()=>{
        if(scene.viewMode==='transition')return;
        scene.selectShip(member.id);
        setFleetOpen(false);
        updateUI();
      });
      const controls=document.createElement('div');
      controls.className='fleet-controls';
      for(const [order,label] of [
        ['mine','Mine ↗'],['return','Return ↙'],['hold','Hold']
      ] as const){
        const action=document.createElement('button');
        action.type='button';action.className='fleet-order';
        action.dataset.fleetOrder=order;
        action.dataset.shipId=member.id;
        action.textContent=label;
        action.setAttribute('aria-label',label+' with '+member.name);
        action.addEventListener('click',()=>commandFleetShip(member.id,order));
        controls.append(action);
      }
      entry.append(pilot,controls);
      list.append(entry);
    }
    const pilot=entry.querySelector<HTMLButtonElement>('.fleet-ship')!;
    pilot.classList.toggle('selected',member.id===state.activeShipId);
    pilot.disabled=!!member.navigation;
    pilot.title=member.navigation?'Autopilot taxi in progress · wait until clear':'Pilot '+member.name;
    pilot.dataset.worldX=member.x.toFixed(2);
    pilot.dataset.worldY=member.y.toFixed(2);
    pilot.dataset.docked=String(member.docked);
    pilot.dataset.order=shipOrder(member);
    pilot.dataset.cargo=cargoTotal(member.cargo).toFixed(2);
    pilot.querySelector('.fleet-name')!.textContent=member.name;
    pilot.querySelector('.fleet-role')!.textContent=
      member.role+' · '+roundCargo(cargoTotal(member.cargo))+'/'+member.capacity;
    const status=fleetShipStatus(state,member);
    pilot.querySelector('.fleet-state')!.textContent=status;
    for(const action of entry.querySelectorAll<HTMLButtonElement>('.fleet-order')){
      const order=action.dataset.fleetOrder as FleetOrder;
      const assigned=shipOrder(member)===order && member.mode!=='manual';
      action.classList.toggle('active',assigned);
      action.setAttribute('aria-pressed',String(assigned));
      action.disabled=transitioning;
      action.title=order==='mine'?'Mine, unload and automatically redeploy':
        order==='return'?'Return to mothership and stay docked':
        'Stop autonomous movement until reassigned';
    }
  }
  builder.tick();
}

const ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
const game=new Phaser.Game({
  type:Phaser.AUTO,
  parent:'game',
  backgroundColor:'#050506',
  scale:{
    mode:Phaser.Scale.FIT,
    width:Math.round(window.innerWidth*ratio),
    height:Math.round(window.innerHeight*ratio),
    autoCenter:Phaser.Scale.CENTER_BOTH,
  },
  render:{pixelArt:false,antialias:true,antialiasGL:true,roundPixels:false},
  scene:[scene],
});
window.addEventListener('resize',()=>{
  game.scale.setGameSize(Math.round(window.innerWidth*ratio),Math.round(window.innerHeight*ratio));
  scene.refreshCameraZoom();
});

$('start-btn').addEventListener('click',()=>{
  started=true;
  $('start-overlay').classList.add('hidden');
  updateFlightLock();
  // Entering the game should reveal the ship, not overlay it with a popup.
  if(loaded.migrated)notice('Previous save migrated safely');
});
$('fleet-toggle').addEventListener('click',()=>setFleetOpen(!fleetOpen));
$('fleet-close').addEventListener('click',()=>setFleetOpen(false));
$('build-toggle').addEventListener('click',()=>{
  if(fleetOpen)setFleetOpen(false);
  builder.toggle();
});
$('builder-close').addEventListener('click',()=>builder.close());
$('hangar-build-btn').addEventListener('click',()=>builder.open());
$('fleet-build').addEventListener('click',()=>{
  setFleetOpen(false);
  builder.open();
});
$('save-toggle').addEventListener('click',()=>persist(true));
$('reset-save').addEventListener('click',()=>{
  if(scene.viewMode==='transition'){notice('Wait until docking finishes.');return;}
  if(window.confirm('Restart this local universe? Your saved progress will be lost.')){
    resetGame();
    window.location.reload();
  }
});
$('launch-btn').addEventListener('click',requestLaunchOrDock);
$('dock-btn').addEventListener('click',requestLaunchOrDock);
$('hangar-launch-btn').addEventListener('click',requestLaunchOrDock);
$('zoom-in-btn').addEventListener('click',()=>scene.zoomInterior(1));
$('zoom-out-btn').addEventListener('click',()=>scene.zoomInterior(-1));
$('recenter-btn').addEventListener('click',()=>scene.recenterInterior());
$('fleet-resume').addEventListener('click',()=>{
  let resumed=0;
  for(const member of state.ships){
    if(member.id===state.activeShipId||member.mode!=='hold')continue;
    if(assignShipOrder(state,member.id,'mine')==='assigned')resumed++;
  }
  updateUI();
  persist();
  notice(resumed?resumed+' ship(s) sent mining':'No idle ships to dispatch');
});

// A native button can keep focus after Launch. Mirror the Asteroids-style
// flight inputs at window level so controls remain responsive. The scene
// treats Phaser and virtual inputs as a single boolean per command.
const keyDirection:Record<string,string>={
  KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',
  KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',
};
window.addEventListener('keydown',event=>{
  if(!started||event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement)return;
  const direction=keyDirection[event.code];
  if(direction){keyboardDirections.add(direction);updateVirtualControls();}
}, {passive:true});
window.addEventListener('keyup',event=>{
  const direction=keyDirection[event.code];
  if(direction){keyboardDirections.delete(direction);updateVirtualControls();}
});
window.addEventListener('blur',()=>{
  keyboardDirections.clear();
  updateVirtualControls();
});

window.addEventListener('keydown',event=>{
  if(!started||event.repeat)return;
  if(event.key==='Escape'){
    if(builder.isOpen)builder.close();
    else if(fleetOpen)setFleetOpen(false);
    event.preventDefault();
    return;
  }
  if(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement)return;
  const key=event.key.toLowerCase();
  if(key==='c'){setFleetOpen(!fleetOpen);event.preventDefault();}
  else if(key==='b'){
    if(fleetOpen)setFleetOpen(false);
    builder.toggle();
    event.preventDefault();
  }
  else if(key==='e'&&!builder.isOpen&&!fleetOpen){
    requestLaunchOrDock();
    event.preventDefault();
  }
  else if(key==='q'&&!builder.isOpen&&!fleetOpen&&scene.viewMode!=='transition'){
    scene.nextShip();
    event.preventDefault();
  }
});

for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')){
  const direction=button.dataset.move!;
  const start=(event:PointerEvent):void=>{
    event.preventDefault();
    virtualKeys.add(direction);
    button.classList.add('pressed');
    button.setPointerCapture(event.pointerId);
    updateVirtualControls();
  };
  const end=(event:PointerEvent):void=>{
    event.preventDefault();
    virtualKeys.delete(direction);
    button.classList.remove('pressed');
    updateVirtualControls();
  };
  button.addEventListener('pointerdown',start);
  button.addEventListener('pointerup',end);
  button.addEventListener('pointercancel',end);
  button.addEventListener('lostpointercapture',()=>{virtualKeys.delete(direction);updateVirtualControls();});
}
const mine=$<HTMLButtonElement>('touch-mine');
mine.addEventListener('pointerdown',event=>{
  event.preventDefault();
  touchMine=true;
  mine.classList.add('pressed');
  mine.setPointerCapture(event.pointerId);
  updateVirtualControls();
});
const stopMine=():void=>{touchMine=false;mine.classList.remove('pressed');updateVirtualControls();};
mine.addEventListener('pointerup',stopMine);
mine.addEventListener('pointercancel',stopMine);
mine.addEventListener('lostpointercapture',stopMine);

// An interrupted docking cinematic must not corrupt the stable world state.
window.addEventListener('pagehide',()=>persist());
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)persist();
});
document.body.dataset.frontierView=lastView;
document.body.dataset.uiPanel='none';
updateFlightLock();
updateUI();
void game;
