import { HOME, WORLD } from './model';
import type { Asteroid, GameState, Point } from './model';

export type DestinationKind='star'|'planet'|'moon'|'belt';
export interface Destination {
  id:string; name:string; kind:DestinationKind; parentId?:string;
  orbitRadius:number; orbitSpeed:number; phase:number; size:number;
  hue:string; description:string; subtitle:string;
  density:number; copperFraction:number; tint:number;
}

/** Orbit distances and speeds are scaled for readable, animated navigation. */
export const SOLAR_SYSTEM:readonly Destination[]=[
  {id:'helios',name:'Helios',kind:'star',orbitRadius:0,orbitSpeed:0,phase:0,size:23,hue:'#f4d9a0',subtitle:'G2 / CENTRAL STAR',description:'The heart of this system. Navigate its outer observation field, beyond the dangerous inner corona.',density:11,copperFraction:.25,tint:0x8c715a},
  {id:'vesta',name:'Vesta',kind:'planet',orbitRadius:120,orbitSpeed:.013,phase:-.48,size:12,hue:'#bfc5c6',subtitle:'ROCKY / HOME ORBIT',description:'Your home orbit: familiar rocks, dependable iron and the first ARROW mothership.',density:27,copperFraction:.34,tint:0x646c77},
  {id:'vesta-i',name:'Vesta I',kind:'moon',parentId:'vesta',orbitRadius:27,orbitSpeed:.068,phase:2.4,size:4,hue:'#a6a9a9',subtitle:'INNER MOON',description:'A compact rocky moon with scattered fragments and sparse iron deposits.',density:17,copperFraction:.22,tint:0x6e7277},
  {id:'aurex',name:'Aurex',kind:'planet',orbitRadius:192,orbitSpeed:.0085,phase:2.7,size:15,hue:'#ba9876',subtitle:'DESERT / MINERAL WORLD',description:'A warm, scarred world with copper-heavy mining territory.',density:39,copperFraction:.73,tint:0xa17a60},
  {id:'caelum',name:'Caelum',kind:'planet',orbitRadius:265,orbitSpeed:.006,phase:1.5,size:24,hue:'#9cb7c9',subtitle:'GAS GIANT / OUTER ATMOSPHERE',description:'A vast blue giant surrounded by debris and remote moon routes.',density:31,copperFraction:.41,tint:0x5e83a0},
  {id:'caelum-i',name:'Caelum I',kind:'moon',parentId:'caelum',orbitRadius:37,orbitSpeed:.050,phase:1.1,size:6,hue:'#d2c9b9',subtitle:'CAELUM / MOON I',description:'An ancient, cratered satellite overlooking the gas giant.',density:34,copperFraction:.32,tint:0x888179},
  {id:'caelum-ii',name:'Caelum II',kind:'moon',parentId:'caelum',orbitRadius:51,orbitSpeed:.036,phase:-1.2,size:5,hue:'#9b9fc7',subtitle:'CAELUM / MOON II',description:'A cold, mineral-rich moon in a wide orbit.',density:37,copperFraction:.58,tint:0x656988},
  {id:'thessa',name:'Thessa',kind:'planet',orbitRadius:342,orbitSpeed:.0045,phase:-2.5,size:15,hue:'#92bca7',subtitle:'TEMPERATE / FRONTIER WORLD',description:'A distant green world. Survey its mineral halo before future colonization.',density:26,copperFraction:.45,tint:0x537b69},
  {id:'nivalis',name:'Nivalis',kind:'planet',orbitRadius:415,orbitSpeed:.0032,phase:.65,size:17,hue:'#c0d5e2',subtitle:'FROZEN / OUTER WORLD',description:'Icy orbital terrain with fractured iron-bearing debris.',density:24,copperFraction:.16,tint:0x7191a5},
  {id:'nivalis-i',name:'Nivalis I',kind:'moon',parentId:'nivalis',orbitRadius:30,orbitSpeed:.03,phase:2.0,size:5,hue:'#d3dfe4',subtitle:'NIVALIS / MOON I',description:'A quiet moon among drifting ice fragments.',density:29,copperFraction:.13,tint:0x7897a2},
  {id:'inner-belt',name:'Inner Belt',kind:'belt',orbitRadius:227,orbitSpeed:0,phase:0,size:8,hue:'#a4a0a0',subtitle:'ASTEROID BELT / INNER SYSTEM',description:'Dense, fragmented rock lanes. High-yield mining routes for persistent fleet operations.',density:68,copperFraction:.56,tint:0x818080},
  {id:'outer-cluster',name:'Outer Cluster',kind:'belt',orbitRadius:457,orbitSpeed:0,phase:0,size:8,hue:'#8497ad',subtitle:'ASTEROID FIELD / OUTER SYSTEM',description:'Isolated high-density deposits near the edge of the known system.',density:58,copperFraction:.30,tint:0x61758a},
] as const;
export const START_DESTINATION='vesta';
export const destinationById=(id:string):Destination|undefined=>SOLAR_SYSTEM.find(d=>d.id===id);

/** Position in solar-system map units; moon positions follow their moving parent. */
export function orbitalPosition(destination:Destination,seconds:number):Point {
  const center=destination.parentId
    ?orbitalPosition(destinationById(destination.parentId)!,seconds):{x:0,y:0};
  const angle=destination.phase+seconds*destination.orbitSpeed;
  return {x:center.x+destination.orbitRadius*Math.cos(angle),
    y:center.y+destination.orbitRadius*Math.sin(angle)};
}

function seededHash(id:string):number {
  let hash=2166136261;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return hash>>>0;
}
/** Deterministic per-region fields: no re-roll exploit on reload or return. */
export function createDestinationAsteroids(id:string):Asteroid[] {
  const destination=destinationById(id);
  if(!destination)return [];
  let seed=seededHash(id);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return Array.from({length:destination.density},(_,i)=>{
    const angle=i*2.3999632297+random()*.5;
    const radius=780+random()*480;
    return {id:id+'-AST-'+String(i+1).padStart(3,'0'),
      x:Math.max(40,Math.min(WORLD.width-40,HOME.x+Math.cos(angle)*radius)),
      y:Math.max(40,Math.min(WORLD.height-40,HOME.y+Math.sin(angle)*radius)),
      ore:random()<destination.copperFraction?'copper':'iron',
      remaining:55+Math.round(random()*175),
      size:20+Math.round(random()*26)};
  });
}

export type TravelResult='arrived'|'same-destination'|'must-dock'|'unknown-destination';
/**
 * Move the mothership and its fleet into a different local region. Each
 * destination remembers its mined asteroid field; cargo, rooms, credits,
 * ships and their orders are retained. Only docked pilots may command a jump.
 */
export function travelToDestination(state:GameState,id:string):TravelResult {
  if(!destinationById(id))return 'unknown-destination';
  const current=state.currentDestinationId??START_DESTINATION;
  if(id===current)return 'same-destination';
  const active=state.ships.find(s=>s.id===state.activeShipId);
  if(!active?.docked||active.navigation)return 'must-dock';
  const snapshots=state.destinationAsteroids??{};
  snapshots[current]=state.asteroids.map(a=>({...a}));
  state.asteroids=(snapshots[id]??createDestinationAsteroids(id)).map(a=>({...a}));
  state.currentDestinationId=id;
  state.destinationAsteroids=snapshots;
  for(let i=0;i<state.ships.length;i++){
    const ship=state.ships[i];
    if(ship.docked)continue;
    // Other ships accompany the mothership outside the new region's hull,
    // retaining ore, mission orders and their manual/automatic mode.
    ship.navigation=undefined;
    ship.berth=undefined;
    ship.x=HOME.x+675+i*150;
    ship.y=HOME.y-850+i*45;
    ship.turnaround=0;
  }
  return 'arrived';
}
