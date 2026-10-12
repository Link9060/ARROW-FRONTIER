import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/FlightScene';
import type { ViewMode } from './game/FlightScene';
import { activeShip, roundCargo } from './sim/engine';
import { cargoTotal, distance, DOCK_RADIUS, HOME, storedTotal } from './sim/model';
import { dockedBerthCount, hangarCapacity } from './sim/hangar';
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
let touchMine=false;
function updateVirtualControls():void{
  const x=(virtualKeys.has('right')?1:0)-(virtualKeys.has('left')?1:0);
  const y=(virtualKeys.has('down')?1:0)-(virtualKeys.has('up')?1:0);
  scene.setVirtualInput(x,y,touchMine);
}
function clearVirtualControls():void{
  virtualKeys.clear();
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
  if(value)updateUI();
}
function requestLaunchOrDock():void{
  if(!started||scene.viewMode==='transition')return;
  if(builder.isOpen)builder.close();
  if(fleetOpen)setFleetOpen(false);
  clearVirtualControls();
  scene.launchOrDock();
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
      'Use the arrows to fly. Hold Mine near an asteroid.':
      'WASD to move · Space to mine · E to dock');

  $('hangar-occupancy').textContent=dockedBerthCount(state)+' / '+hangarCapacity(state)+' BAYS';
  $('hangar-summary').textContent='Hangar · Bay '+String((ship.berth??0)+1).padStart(2,'0')+' · '+ship.name;
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
    let row=list.querySelector<HTMLButtonElement>('[data-ship-id="'+member.id+'"]');
    if(!row){
      row=document.createElement('button');
      row.type='button';
      row.className='fleet-ship';
      row.dataset.shipId=member.id;
      const identity=document.createElement('span');
      identity.className='fleet-identity';
      const name=document.createElement('strong');
      name.className='fleet-name';
      const role=document.createElement('small');
      role.className='fleet-role';
      identity.append(name,role);
      const status=document.createElement('small');
      status.className='fleet-state';
      row.append(identity,status);
      row.addEventListener('click',()=>{
        if(scene.viewMode==='transition')return;
        scene.selectShip(member.id);
        setFleetOpen(false);
        updateUI();
      });
      list.appendChild(row);
    }
    row.classList.toggle('selected',member.id===state.activeShipId);
    row.querySelector('.fleet-name')!.textContent=member.name;
    row.querySelector('.fleet-role')!.textContent=member.role;
    row.querySelector('.fleet-state')!.textContent=member.id===state.activeShipId?
      'Piloting':member.mode==='auto'?'Automated':'Idle';
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
    member.mode='auto';
    resumed++;
  }
  updateUI();
  persist();
  notice(resumed?resumed+' idle ship(s) resumed':'No idle ships');
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
