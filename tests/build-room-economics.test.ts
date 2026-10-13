import { describe,expect,it } from 'vitest';
import { BUILDABLE, MODULES, buildRoom, powerReport, runIndustry, upgradeRoom } from '../src/sim/mothership';
import { makeNewGame } from '../src/sim/model';
import { roomEconomics, affordability } from '../src/ui/roomEconomics';

describe('contextual Build room economics are grounded in the simulation',()=>{
  it('describes construction cost, operational inputs, outputs, perks and drawbacks for every available module',()=>{
    for(const type of BUILDABLE){
      const spec=MODULES[type];
      const info=roomEconomics(type);
      expect(info.cost).toEqual(spec.cost);
      expect(info.power).toBeTruthy();
      expect(info.purpose.length).toBeGreaterThan(15);
      expect(info.inputs.length).toBeGreaterThan(5);
      expect(info.outputs.length).toBeGreaterThan(5);
      expect(info.benefits.length).toBeGreaterThan(0);
      expect(info.drawbacks.length).toBeGreaterThan(0);
    }
  });
  it('shows warehouse capacity per level matching actual upgraded storage',()=>{
    const state=makeNewGame();
    const storage=state.rooms.find(room=>room.type==='storage')!;
    state.stored={iron:400,copper:240,alloy:80};
    const previousCapacity=state.storageCapacity;
    expect(roomEconomics('storage',1).outputs).toContain('+200');
    expect(upgradeRoom(state,storage.id)).toBeNull();
    expect(state.storageCapacity-previousCapacity).toBe(150);
    expect(roomEconomics('storage',2).outputs).toContain('+350');
    expect(upgradeRoom(state,storage.id)).toBeNull();
    expect(roomEconomics('storage',3).outputs).toContain('+500');
    expect(state.storageCapacity).toBe(700);
  });
  it('reactor generation and refinery consumptions reflect live production',()=>{
    const state=makeNewGame();
    state.stored={iron:200,copper:140,alloy:30};
    const reactor=state.rooms.find(room=>room.type==='reactor')!;
    expect(powerReport(state).output).toBe(22);
    expect(roomEconomics('reactor',1).outputs).toContain('22 power');
    expect(upgradeRoom(state,reactor.id)).toBeNull();
    expect(powerReport(state).output).toBe(32);
    expect(roomEconomics('reactor',2).outputs).toContain('32 power');
    expect(buildRoom(state,'refinery',1,1)).toBeNull();
    const before={...state.stored};
    expect(runIndustry(state,4)).toBe(1);
    expect(state.stored.iron).toBe(before.iron-2);
    expect(state.stored.copper).toBe(before.copper-1);
    expect(state.stored.alloy).toBe(before.alloy+1);
    expect(roomEconomics('refinery').inputs).toContain('2 iron + 1 copper');
    expect(roomEconomics('refinery').outputs).toContain('1 alloy every 4 seconds');
  });
  it('pricing reports shortages without marking module as unselectable',()=>{
    const cost=MODULES.fabricator.cost;
    expect(affordability({iron:0,copper:100,alloy:0},cost)).toBe(false);
    expect(affordability({...cost},cost)).toBe(true);
    expect(roomEconomics('fabricator').outputs).toMatch(/no passive ore or alloy production/);
    expect(roomEconomics('hangar',3).outputs).toContain('+12');
  });
});
