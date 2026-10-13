import { MODULES } from '../sim/mothership';
import type { Resources, RoomType } from '../sim/model';

/**
 * Player-visible explanation of actual v0.6.x construction and simulation
 * rules. Do not imply that passive power draw consumes stored materials.
 */
export interface ModuleEconomics {
  purpose:string;
  benefits:string[];
  drawbacks:string[];
  inputs:string;
  outputs:string;
  power:string;
  cost:Resources;
}
export function roomEconomics(type:RoomType,level=1):ModuleEconomics {
  const tier=Math.max(1,Math.min(3,level));
  const spec=MODULES[type];
  const base={cost:spec.cost,power:spec.draw?'Uses '+spec.draw+' power while online':'Generates power'};
  switch(type){
    case 'command': return {
      ...base,purpose:'Coordinates the fleet and mothership systems.',
      benefits:['Core command module, provided with your mothership.'],
      drawbacks:['Consumes 3 power and has high power priority.'],
      inputs:'3 power while active · no ore consumed',
      outputs:'Fleet operations access',
    };
    case 'storage':return {
      ...base,purpose:'Stores materials mined and manufactured by your fleet.',
      benefits:['+'+(200+(tier-1)*150)+' total storage capacity at level '+tier,
        'Lets miners unload more ore before the mothership fills.'],
      drawbacks:['Takes one deck slot and uses 1 power. It does not produce materials.'],
      inputs:'1 power while active · no ore consumed',
      outputs:'+'+(200+(tier-1)*150)+' storage capacity (not free resources)',
    };
    case 'reactor':return {
      ...base,purpose:'Supplies electricity to powered rooms.',
      benefits:['Produces '+(22+(tier-1)*10)+' power at level '+tier,
        'Supports more active rooms and manufacturing.'],
      drawbacks:['Occupies a deck slot. Turning it off can shut other rooms down.'],
      inputs:'No operating materials currently consumed',
      outputs:(22+(tier-1)*10)+' power while enabled',
      power:'Generates '+(22+(tier-1)*10)+' power',
    };
    case 'refinery':return {
      ...base,purpose:'Converts mined iron and copper into alloy.',
      benefits:['Produces up to '+tier+' alloy per 4 seconds with enough inputs.',
        'Alloy is needed for ship fabrication and many room upgrades.'],
      drawbacks:['Requires 8 power; stops without iron, copper, or available power.'],
      inputs:'2 iron + 1 copper per alloy · 8 power',
      outputs:'Up to '+tier+' alloy every 4 seconds at level '+tier,
    };
    case 'fabricator':return {
      ...base,purpose:'Unlocks installing mining and cargo upgrades on docked ships.',
      benefits:['Upgrade a ship’s mining rate or cargo capacity from Fleet.',
        'Installed upgrades persist across missions.'],
      drawbacks:['Requires 7 power; each ship upgrade has an additional material cost.'],
      inputs:'7 power · upgrade materials spent only when installing',
      outputs:'Ship upgrades (no passive ore or alloy production)',
    };
    case 'hangar':return {
      ...base,purpose:'Expands physical parking capacity on both sides of the mothership.',
      benefits:['+'+(4*tier)+' parking units at level '+tier,
        'Adds mirrored bays to Hangars A and B.'],
      drawbacks:['Uses 3 power; larger industrial ships occupy multiple units.',
        'Total capacity is limited by the physical 12-bay hull.'],
      inputs:'3 power · no operating ore consumed',
      outputs:'+'+(4*tier)+' docking spaces (up to 12 across all hangars)',
    };
  }
}
export function affordability(stored:Resources,cost:Resources):boolean {
  return (['iron','copper','alloy'] as const)
    .every(ore=>stored[ore]+1e-6>=cost[ore]);
}
