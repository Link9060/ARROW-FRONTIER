import { describe,expect,it } from 'vitest';
import { HOME, cargoTotal, makeNewGame, storedTotal } from '../src/sim/model';
import {
  activeShip, assignShipOrder, dockShip, fleetShipStatus,
  runAutomation, shipOrder, switchShip,
} from '../src/sim/engine';
import { saveGame, loadGame } from '../src/sim/persistence';
import { berthWorldPosition } from '../src/sim/hangar';
import { vi,afterEach } from 'vitest';

function parkedMiner(){
  const game=makeNewGame(1000);
  const miner=game.ships[1];
  miner.x=HOME.x;miner.y=HOME.y-600;
  expect(dockShip(game,miner)).toBe('docked');
  expect(miner.berth).toBe(2);
  return {game,miner};
}

describe('dispatchable RAVIN fleet missions',()=>{
  it('sends docked ships mining immediately without manual launch or pilot transfer',()=>{
    const {game,miner}=parkedMiner();
    expect(assignShipOrder(game,miner.id,'hold')).toBe('assigned');
    expect(miner.mode).toBe('hold');
    expect(assignShipOrder(game,miner.id,'mine')).toBe('assigned');
    expect(miner.mode).toBe('auto');
    expect(shipOrder(miner)).toBe('mine');
    expect(activeShip(game).id).toBe('scout');
    const previous=berthWorldPosition(miner);
    runAutomation(game,.2);
    expect(miner.docked).toBe(false);
    expect(Math.hypot(miner.x-previous.x,miner.y-previous.y)).toBeGreaterThan(700);
    expect(activeShip(game).docked).toBe(true);
    expect(assignShipOrder(game,'scout','mine')).toBe('active-ship');
    expect(assignShipOrder(game,'nonexistent','mine')).toBe('not-found');
  });

  it('cycles mine → full cargo → dock → unload → redeploy for multiple trips',()=>{
    const {game,miner}=parkedMiner();
    expect(assignShipOrder(game,'miner','mine')).toBe('assigned');
    let unloads=0,relaunches=0,wasDocked=miner.docked;
    for(let i=0;i<2400;i++){
      runAutomation(game,.1);
      if(!wasDocked&&miner.docked)unloads++;
      if(wasDocked&&!miner.docked)relaunches++;
      wasDocked=miner.docked;
    }
    expect(unloads).toBeGreaterThanOrEqual(2);
    expect(relaunches).toBeGreaterThanOrEqual(2);
    expect(storedTotal(game.stored)).toBeGreaterThan(90);
    expect(shipOrder(miner)).toBe('mine');
    expect(miner.mode).toBe('auto');
    expect(cargoTotal(miner.cargo)).toBeLessThanOrEqual(miner.capacity);
  });

  it('waits visibly when storage is full, preserving the mining order and cargo',()=>{
    const {game,miner}=parkedMiner();
    miner.cargo.iron=30;
    game.stored.iron=game.storageCapacity;
    expect(assignShipOrder(game,'miner','mine')).toBe('assigned');
    runAutomation(game,3);
    expect(miner.docked).toBe(true);
    expect(miner.mode).toBe('auto');
    expect(shipOrder(miner)).toBe('mine');
    expect(miner.cargo.iron).toBe(30);
    expect(fleetShipStatus(game,miner)).toContain('STORAGE FULL');

    game.stored.iron-=150;
    runAutomation(game,.1);
    expect(miner.cargo.iron).toBeCloseTo(0);
    expect(game.stored.iron).toBeCloseTo(280);
    runAutomation(game,2);
    expect(miner.docked).toBe(false);
    expect(shipOrder(miner)).toBe('mine');
  });

  it('recalls a ship, docks it, then keeps it parked until explicitly redeployed',()=>{
    const game=makeNewGame(1000);
    const miner=game.ships[1];
    expect(assignShipOrder(game,'miner','return')).toBe('assigned');
    for(let i=0;i<600&&!miner.docked;i++)runAutomation(game,.1);
    expect(miner.docked).toBe(true);
    expect(miner.order).toBe('hold');
    expect(miner.mode).toBe('hold');
    for(let i=0;i<100;i++)runAutomation(game,.1);
    expect(miner.docked).toBe(true);
    expect(assignShipOrder(game,'miner','mine')).toBe('assigned');
    runAutomation(game,2);
    expect(miner.docked).toBe(false);
  });

  it('holds a ship in space without commanding an unexpected return',()=>{
    const game=makeNewGame(1000),miner=game.ships[1];
    const position={x:miner.x,y:miner.y};
    expect(assignShipOrder(game,miner.id,'hold')).toBe('assigned');
    for(let i=0;i<100;i++)runAutomation(game,.1);
    expect(miner).toMatchObject({...position,docked:false,mode:'hold',order:'hold'});
    expect(fleetShipStatus(game,miner)).toBe('HOLDING POSITION');
  });

  it('supports legacy saves without a fleet order and carries orders through reload',()=>{
    const storage=new Map<string,string>();
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>storage.get(key)??null,
      setItem:(key:string,value:string)=>{storage.set(key,value);},
      removeItem:(key:string)=>{storage.delete(key);},
    });
    const game=makeNewGame(1000),miner=game.ships[1];
    delete miner.order;
    expect(shipOrder(miner)).toBe('mine');
    assignShipOrder(game,'miner','return');
    expect(saveGame(game,1000)).toBe(true);
    const loaded=loadGame(1000).state;
    const reloaded=loaded.ships.find(s=>s.id==='miner')!;
    expect(reloaded.order).toBe('return');
    expect(reloaded.mode).toBe('auto');
    expect(switchShip(loaded,'miner')).toBe(true);
    expect(reloaded.mode).toBe('manual');
    expect(switchShip(loaded,'scout')).toBe(true);
    expect(reloaded.order).toBe('return');
  });
});
afterEach(()=>vi.unstubAllGlobals());
