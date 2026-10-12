import { describe,expect,it,afterEach,vi } from 'vitest';
import { HOME, makeNewGame, distance } from '../src/sim/model';
import { assignShipOrder, dockShip, runAutomation } from '../src/sim/engine';
import { findAvailableBerth } from '../src/sim/hangar';
import { loadGame, saveGame } from '../src/sim/persistence';

function dockMiner(){
  const state=makeNewGame(1000);
  const miner=state.ships[1];
  miner.x=HOME.x+50;miner.y=HOME.y-595;
  expect(dockShip(state,miner)).toBe('docked');
  return {state,miner};
}

describe('background ships follow real side-hangar routes',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('moves out of its physical berth gradually and reserves the exit lane',()=>{
    const {state,miner}=dockMiner();
    const before={x:miner.x,y:miner.y};
    expect(assignShipOrder(state,miner.id,'mine')).toBe('assigned');
    runAutomation(state,.1);
    expect(miner.docked).toBe(false);
    expect(miner.navigation?.kind).toBe('launch');
    expect(miner.navigation?.side).toBe('south');
    expect(miner.berth).toBe(2);
    // It cannot instantly teleport 800 units out of the hangar.
    expect(distance(miner,before)).toBeLessThan(1);
    runAutomation(state,.1);
    expect(distance(miner,before)).toBeGreaterThan(1);
    expect(distance(miner,before)).toBeLessThan(70);

    // A competing miner may not steal a berth while the first leaves it.
    const extra={...miner,id:'extra-miner',name:'EXTRA',
      docked:false,berth:undefined,navigation:undefined,
      x:HOME.x+700,y:HOME.y};
    state.ships.push(extra);
    expect(findAvailableBerth(state,extra)).toBeNull();

    const pathPositions=[{x:miner.x,y:miner.y}];
    for(let i=0;i<180;i++){
      runAutomation(state,.1);
      pathPositions.push({x:miner.x,y:miner.y});
      if(!miner.navigation)break;
    }
    expect(miner.navigation).toBeUndefined();
    expect(miner.berth).toBeUndefined();
    expect(distance(miner,HOME)).toBeGreaterThan(690);
    for(let i=1;i<pathPositions.length;i++){
      expect(distance(pathPositions[i],pathPositions[i-1])).toBeLessThanOrEqual(42);
    }
  });

  it('restores a launch animation in progress without moving the ship to emergency spawn',()=>{
    const storage=new Map<string,string>();
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>storage.get(key)??null,
      setItem:(key:string,v:string)=>{storage.set(key,v);},
      removeItem:(key:string)=>{storage.delete(key);},
    });
    const {state,miner}=dockMiner();
    assignShipOrder(state,miner.id,'mine');
    for(let i=0;i<12;i++)runAutomation(state,.1);
    expect(miner.navigation?.kind).toBe('launch');
    const previous={x:miner.x,y:miner.y,step:miner.navigation!.step};
    expect(saveGame(state,1000)).toBe(true);
    const loaded=loadGame(1000).state;
    const restored=loaded.ships.find(s=>s.id==='miner')!;
    expect(restored.navigation?.kind).toBe('launch');
    expect(restored.navigation?.step).toBe(previous.step);
    expect(restored.x).toBeCloseTo(previous.x);
    expect(restored.y).toBeCloseTo(previous.y);
    for(let i=0;i<150;i++)runAutomation(loaded,.1);
    expect(restored.navigation).toBeUndefined();
    expect(distance(restored,HOME)).toBeGreaterThan(690);
  });

  it('reserves the player cinematic berth against simultaneous miner arrivals',()=>{
    const state=makeNewGame(1000);
    const scout=state.ships[0],miner=state.ships[1];
    scout.docked=false;
    scout.berth=0;
    scout.navigation={
      kind:'dock',side:'north',berth:0,step:0,
      origin:{x:HOME.x+120,y:HOME.y-650},
    };
    scout.x=HOME.x+90;scout.y=HOME.y-560;
    miner.x=HOME.x+55;miner.y=HOME.y-590;
    expect(findAvailableBerth(state,miner)).toBe(2);
    expect(dockShip(state,miner)).toBe('docked');
    expect(miner.berth).toBe(2);
    expect(findAvailableBerth(state,scout)).toBe(0);
    expect(dockShip(state,scout)).toBe('docked');
    expect(scout.berth).toBe(0);
    expect(scout.navigation).toBeUndefined();
  });

  it('recall during departure waits for the airlock to clear before safely docking',()=>{
    const {state,miner}=dockMiner();
    assignShipOrder(state,miner.id,'mine');
    for(let i=0;i<6;i++)runAutomation(state,.1);
    expect(miner.navigation?.kind).toBe('launch');
    expect(assignShipOrder(state,miner.id,'return')).toBe('assigned');
    let docked=false;
    for(let i=0;i<550;i++){
      runAutomation(state,.1);
      if(miner.docked){docked=true;break;}
    }
    expect(docked).toBe(true);
    expect(miner.mode).toBe('hold');
    expect(miner.order).toBe('hold');
    expect(miner.navigation).toBeUndefined();
  });
});
