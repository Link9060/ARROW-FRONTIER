import Phaser from 'phaser';
import type { GameState, RoomType } from '../sim/model';
import { hangarCapacity, MAX_BERTHS, berthLocalPosition } from '../sim/hangar';
import { MODULES, powerReport } from '../sim/mothership';

export interface MothershipArtwork {
  roof: Phaser.GameObjects.Container;
  interior: Phaser.GameObjects.Container;
}

type Vector = [number, number];
function polygon(graphics: Phaser.GameObjects.Graphics, points: Vector[], fill: number,
  stroke: number, width = 2, alpha = 1): void {
  graphics.fillStyle(fill, alpha);
  graphics.lineStyle(width, stroke, .9);
  graphics.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  });
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}
function text(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number,
  message: string, size = 12, color = '#c9def0', origin = 0.5): void {
  parent.add(scene.add.text(x, y, message, {
    fontFamily: 'monospace', fontSize: size + 'px', color,
    letterSpacing: 1, align: 'center',
  }).setOrigin(origin));
}

const SHAPE: Vector[] = [
  [-548,-200],[-445,-206],[-304,-350],[-45,-335],
  [290,-176],[568,0],[290,176],[-45,335],
  [-304,350],[-445,206],[-548,200],[-450,0],
];
const ARMOR: Vector[] = [
  [-486,-154],[-393,-155],[-268,-294],[-80,-284],
  [260,-125],[488,0],[260,125],[-80,284],
  [-268,294],[-393,155],[-486,154],[-383,0],
];

const MODULE_LOCATIONS: Vector[] = [
  [-411,-249],[-265,-251],[-119,-267],[26,-270],[171,-238],[312,-186],
  [392,-95],[405,98],[322,196],[163,263],[12,269],[-130,264],
  [-274,249],[-410,245],[-465,100],[-467,-97],
  [-371,-8],[-335,-154],[-335,154],[345,0],
];

function drawRoom(scene: Phaser.Scene, container: Phaser.GameObjects.Container, roomType: RoomType,
  x: number, y: number, level: number, powered: boolean): void {
  const g = scene.add.graphics();
  container.add(g);
  const width = 119, height = 80;
  g.fillStyle(powered ? 0x182c3e : 0x101925, 1);
  g.lineStyle(1.5, powered ? 0x779dbd : 0x3b5165, .75);
  g.fillRoundedRect(x-width/2, y-height/2, width, height, 7);
  g.strokeRoundedRect(x-width/2, y-height/2, width, height, 7);
  g.fillStyle(powered ? 0xc7dff3 : 0x6e8398, .28);
  // Distinct working equipment, not just identical room boxes.
  if (roomType === 'reactor') {
    g.lineStyle(2, 0x91b7d6, .7);
    g.strokeCircle(x, y-8, 24);
    g.fillStyle(powered ? 0xb6dbfa : 0x364b5d, .5);
    g.fillCircle(x, y-8, 12);
    g.lineStyle(1, 0xe3f2ff, .55);
    g.lineBetween(x-23,y-8,x+23,y-8);
  } else if (roomType === 'storage') {
    for (let i=0;i<3;i++){
      g.fillStyle(0x537591,.35); g.fillRoundedRect(x-41+i*29,y-24,24,30,3);
      g.lineStyle(1,0xa3bdd4,.65);g.strokeRoundedRect(x-41+i*29,y-24,24,30,3);
    }
  } else if (roomType === 'refinery') {
    g.fillStyle(0x688fb0,.4);g.fillRoundedRect(x-42,y-19,82,21,3);
    for(let i=0;i<4;i++){g.lineStyle(2,0xb5d0e5,.55);g.lineBetween(x-36+i*23,y-19,x-36+i*23,y+7);}
  } else if (roomType === 'fabricator') {
    g.lineStyle(3,0xa5c9e5,.75);
    g.lineBetween(x-33,y+2,x-18,y-21);g.lineBetween(x-18,y-21,x+8,y-7);g.lineBetween(x+8,y-7,x+28,y-23);
    g.fillStyle(0xe7f7ff,.7);g.fillCircle(x+28,y-23,6);
  } else {
    g.lineStyle(2,0x8cabc6,.65);
    g.strokeRoundedRect(x-36,y-22,72,28,4);
    g.lineBetween(x-19,y-22,x-19,y+6);
    g.lineBetween(x+19,y-22,x+19,y+6);
  }
  text(scene,container,x,y+27, MODULES[roomType].code+' / '+level,10,powered?'#cae0f2':'#6f869b');
}

export function buildMothershipArtwork(scene: Phaser.Scene, state: GameState, homeX: number, homeY: number): MothershipArtwork {
  const interior = scene.add.container(homeX,homeY).setDepth(7);
  const deck = scene.add.graphics();
  interior.add(deck);

  polygon(deck,SHAPE,0x0a1420,0x99bedc,4);
  polygon(deck,ARMOR,0x112234,0x496b86,2);
  // Walkway spine, engineering ribs, dimensional rails.
  deck.fillStyle(0x172d3f,.86);
  deck.fillRoundedRect(-512,-53,920,106,12);
  deck.lineStyle(2,0x829fba,.55);
  deck.strokeRoundedRect(-512,-53,920,106,12);
  for(let i=0;i<12;i++){
    const xx=-475+i*75;
    deck.lineStyle(1,0x9fb6cb,.19);
    deck.lineBetween(xx,-320,xx,320);
  }
  deck.lineStyle(3,0x6686a2,.4);
  deck.lineBetween(-460,-242,270,-242);
  deck.lineBetween(-460,242,270,242);

  // Selected rooms occupy peripheral engineering spaces around the hangar.
  const powered=powerReport(state).onlineIds;
  const displayRooms=state.rooms.filter(room=>room.type!=='hangar');
  for(let i=0;i<displayRooms.length && i<MODULE_LOCATIONS.length;i++){
    const room=displayRooms[i];
    const [x,y]=MODULE_LOCATIONS[i];
    drawRoom(scene,interior,room.type,x,y,room.level,powered.has(room.id));
  }

  // Real hangar with floor markings, landing rail, crane gantry and parking.
  const floor=scene.add.graphics();
  interior.add(floor);
  floor.fillStyle(0x0a1622,1);
  floor.lineStyle(4,0x8db0cf,.95);
  floor.fillRoundedRect(-278,-185,562,371,17);
  floor.strokeRoundedRect(-278,-185,562,371,17);
  floor.fillStyle(0x132a3d,1);
  floor.fillRoundedRect(-259,-163,524,329,11);
  floor.lineStyle(1,0x406583,.8);
  floor.strokeRoundedRect(-259,-163,524,329,11);
  // Exhaust and maintenance trenches.
  for(let i=0;i<6;i++){
    floor.lineStyle(2,0x65849f,.22);
    floor.lineBetween(-255,-143+i*54,260,-143+i*54);
  }
  floor.lineStyle(3,0x96b8d7,.7);
  floor.lineBetween(-251,-179,250,-179);
  floor.lineBetween(-251,177,250,177);
  // Vertical gantry cranes and hanger service track.
  floor.fillStyle(0x294861,.8);
  floor.fillRoundedRect(-248,-152,13,298,5);
  floor.fillRoundedRect(244,-152,13,298,5);
  floor.lineStyle(2,0xc3d8eb,.7);
  floor.lineBetween(-242,-152,252,-152);
  floor.lineBetween(-242,146,252,146);
  for(let i=0;i<11;i++){
    floor.fillStyle(0x9dc5e5,i%2===0?.6:.2);
    floor.fillCircle(-245+i*48,-153,3);
    floor.fillCircle(-245+i*48,148,3);
  }
  // A marked aperture on the northern side receives arriving ships.
  floor.lineStyle(5,0xd3e4f5,.88);
  floor.lineBetween(46,-185,190,-185);
  floor.lineStyle(2,0x87b4d8,.7);
  floor.lineBetween(67,-165,67,-120);
  floor.lineBetween(170,-165,170,-120);
  text(scene,interior,120,-201,'AIRLOCK 01 / ENTRY',11,'#c4dff3');
  text(scene,interior,-175,166,'SHIP STORAGE • ACTIVE',10,'#92b4d0');

  const berthCount=hangarCapacity(state);
  for(let berth=0;berth<berthCount && berth<MAX_BERTHS;berth++){
    const pos=berthLocalPosition(berth);
    const px=pos.x,py=pos.y;
    floor.lineStyle(1.5,0x8eaeca,.6);
    floor.strokeRoundedRect(px-61,py-34,122,68,7);
    floor.lineStyle(3,0x9ac0dc,.45);
    floor.lineBetween(px-54,py-27,px-54,py+27);
    floor.lineBetween(px+54,py-27,px+54,py+27);
    floor.lineStyle(1,0xb2c8db,.4);
    floor.lineBetween(px,py-29,px,py+29);
    text(scene,interior,px,py+45,'BAY '+String(berth+1).padStart(2,'0'),9,'#9bb6cd');
  }
  // Service equipment lives on and around the hangar.
  for(const x of [-262,266]){
    for(const y of [-125,-40,50,132]){
      floor.fillStyle(0xa1bdcf,.6);
      floor.fillCircle(x,y,5);
      floor.lineStyle(1.4,0xc9deed,.6);
      floor.strokeCircle(x,y,9);
    }
  }
  text(scene,interior,-12,214,'HANGAR DECK • PRESS B FOR CONSTRUCTION',11,'#cee2f4');
  text(scene,interior,400,-303,'SYSTEMS / ONLINE',11,'#a9c6de');

  // Roof is a wholly opaque arrow craft in flight; its alpha fades while docking.
  const roof=scene.add.container(homeX,homeY).setDepth(26);
  const armor=scene.add.graphics(); roof.add(armor);
  polygon(armor,SHAPE,0x101b29,0xd8ebff,4);
  polygon(armor,ARMOR,0x1a2b3d,0x6688a5,2);
  const cockpit: Vector[]=[[80,-71],[273,-82],[460,0],[273,82],[80,71],[177,0]];
  polygon(armor,cockpit,0x08131f,0xa8cfe9,2);
  armor.lineStyle(2,0x92b7d2,.65);
  armor.lineBetween(-325,-310,198,-104);
  armor.lineBetween(-325,310,198,104);
  armor.lineBetween(-440,-166,-89,-88);
  armor.lineBetween(-440,166,-89,88);
  // Broad illuminated engine cowlings.
  for(const yy of [-171,171]){
    armor.fillStyle(0x10253b,1);
    armor.fillRoundedRect(-565,yy-38,110,76,9);
    armor.lineStyle(2,0xadc9e3,.82);
    armor.strokeRoundedRect(-565,yy-38,110,76,9);
    armor.fillStyle(0xd8eaff,.72);
    armor.fillRoundedRect(-570,yy-25,12,50,6);
    armor.fillStyle(0x5b9ad2,.25);
    armor.fillEllipse(-603,yy,60,47);
  }
  armor.fillStyle(0x18334a,1);
  armor.fillRoundedRect(59,-338,144,41,6);
  armor.lineStyle(2,0xb2cddd,.86);
  armor.strokeRoundedRect(59,-338,144,41,6);
  for(let i=0;i<7;i++){
    armor.lineStyle(1,0x88b1d0,.58);
    armor.lineBetween(71+i*18,-333,71+i*18,-301);
  }
  // Hull segment markings adapt visually as the player expands the ship.
  for(let i=0;i<Math.max(2,Math.min(11,state.rooms.length-2));i++){
    const xx=-285+i*61;
    armor.lineStyle(1.5,0x9dbbd4,.55);
    armor.lineBetween(xx,-286,xx+37,-280);
    armor.lineBetween(xx,286,xx+37,280);
  }
  text(scene,roof,-210,-20,'A R R O W',19,'#d5e9f8');
  text(scene,roof,-210,10,'FRONTIER / MOTHERSHIP',11,'#89a6be');
  text(scene,roof,132,-350,'DOCK / HANGAR 01',12,'#ecf6ff');
  text(scene,roof,0,390,'ARROW-01 · INTERSTELLAR MOBILE BASE',13,'#b1c9df');

  return {roof,interior};
}
