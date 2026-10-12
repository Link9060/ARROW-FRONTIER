import Phaser from 'phaser';
import type { GameState, Room } from '../sim/model';
import { HOME, ROOM_GRID } from '../sim/model';
import { berthLocalPosition, dockingPort, hangarCapacity, MAX_BERTHS } from '../sim/hangar';
import { MODULES, powerReport } from '../sim/mothership';
import { CELL_SIZE, deckCellPoint } from './deckLayout';
import { arrowOutline, FLAGSHIP_LENGTH } from '../sim/arrowGeometry';

export interface MothershipArtwork {
  roof:Phaser.GameObjects.Container;
  interior:Phaser.GameObjects.Container;
  doors:Phaser.GameObjects.Container;
  doorLeft:Phaser.GameObjects.Container;
  doorRight:Phaser.GameObjects.Container;
  doorCenterX:number;
}
type XY=readonly [number,number];
// Both sides come from the official ARROW mark, not an unrelated polygon.
const HULL=arrowOutline(FLAGSHIP_LENGTH);
const INNER=arrowOutline(1000,.86);
function path(g:Phaser.GameObjects.Graphics,pts:readonly XY[],color:number,stroke:number,w=2):void{
  g.fillStyle(color,1);
  g.lineStyle(w,stroke,.85);
  g.beginPath();
  pts.forEach(([x,y],i)=>{if(i===0)g.moveTo(x,y);else g.lineTo(x,y);});
  g.closePath();g.fillPath();g.strokePath();
}
function label(scene:Phaser.Scene,container:Phaser.GameObjects.Container,
  x:number,y:number,text:string,size=11,color='#bbbbbc'):void{
  container.add(scene.add.text(x,y,text,{
    fontFamily:'Inter, Arial, sans-serif',fontSize:size+'px',
    color,align:'center',
  }).setOrigin(.5));
}
function moduleTile(scene:Phaser.Scene,parent:Phaser.GameObjects.Container,
  room:Room,online:boolean):void{
  const {x,y}=deckCellPoint(room.x,room.y);
  const g=scene.add.graphics();parent.add(g);
  const w=CELL_SIZE.width-6,h=CELL_SIZE.height-7;
  g.fillStyle(online?0x272729:0x19191a,1);
  g.lineStyle(online?1.8:1,online?0xbebec0:0x555558,online?.95:.6);
  g.fillRoundedRect(x-w/2,y-h/2,w,h,6);
  g.strokeRoundedRect(x-w/2,y-h/2,w,h,6);
  g.lineStyle(1,0x7a7a7c,.4);
  g.lineBetween(x-w/2+12,y+4,x+w/2-12,y+4);
  // Distinct interior equipment is drawn without sci-fi glowing outlines.
  if(room.type==='reactor'){
    g.lineStyle(1.8,0xe0e0e0,.7);
    g.strokeCircle(x-37,y-10,12);
    g.lineBetween(x-37,y-22,x-37,y+2);
    g.lineBetween(x-49,y-10,x-25,y-10);
  }else if(room.type==='storage'){
    for(let i=0;i<3;i++){
      g.lineStyle(1,0xbdbdbd,.65);
      g.strokeRoundedRect(x-51+i*19,y-18,14,17,2);
    }
  }else if(room.type==='command'){
    g.lineStyle(1,0xd9d9da,.65);
    g.strokeRoundedRect(x-52,y-18,51,18,4);
    g.lineBetween(x-37,y-18,x-37,y-1);
  }else if(room.type==='refinery'){
    g.lineStyle(2,0xbcbcbc,.7);
    g.lineBetween(x-47,y-17,x-14,y-17);
    g.lineBetween(x-47,y-12,x-14,y-12);
  }else{
    g.lineStyle(1,0xc4c4c5,.65);
    g.strokeRoundedRect(x-51,y-18,37,18,3);
  }
  label(scene,parent,x+26,y-9,MODULES[room.type].code,11,online?'#e6e6e6':'#858585');
  label(scene,parent,x,y+17,MODULES[room.type].title.toUpperCase()+'  '+room.level,8,online?'#b2b2b3':'#737376');
}

export function buildMothershipArtwork(scene:Phaser.Scene,state:GameState,
  homeX=HOME.x,homeY=HOME.y):MothershipArtwork {
  const interior=scene.add.container(homeX,homeY).setDepth(7);
  const structural=scene.add.graphics();interior.add(structural);
  path(structural,HULL,0x101011,0xcfcfd1,3);
  path(structural,INNER,0x1b1b1d,0x626264,1.4);

  // Real structural trusses connect split-tail propulsion to the working
  // center deck. Each line is part of the ship, not a floating label.
  path(structural,[[-493,-314],[-424,-322],[-166,-61],[-207,-24]],0x222225,0x77777a,1);
  path(structural,[[-493,314],[-424,322],[-166,61],[-207,24]],0x222225,0x77777a,1);
  structural.lineStyle(1,0xaaaaac,.36);
  for(let i=0;i<7;i++){
    const x=-410+i*34;
    const t=(x+410)/245;
    const y=284*(1-t)+45*t;
    structural.lineBetween(x,y-18,x+22,y+18);
    structural.lineBetween(x,-y+18,x+22,-y-18);
  }

  // The official mark's hollowed rear splits into two engine assemblies.
  for(const side of [-1,1]){
    const y=side*293;
    structural.fillStyle(0x242426,1);
    structural.lineStyle(2,0xbbbcbf,.9);
    structural.fillRoundedRect(-515,y-48,189,96,9);
    structural.strokeRoundedRect(-515,y-48,189,96,9);
    structural.lineStyle(1,0x828286,.68);
    for(let i=0;i<4;i++) structural.lineBetween(-487+i*29,y-30,-487+i*29,y+30);
    structural.fillStyle(0xe2e2e2,.5);
    structural.fillCircle(-445,y,15);
    label(scene,interior,-401,y+30,'PROPULSION',9,'#b9b9bc');
  }

  // The point of the arrow is always the fixed command centre.
  structural.fillStyle(0x28282b,1);
  structural.lineStyle(2,0xceced0,.78);
  structural.fillRoundedRect(278,-47,135,94,13);
  structural.strokeRoundedRect(278,-47,135,94,13);
  structural.lineStyle(1,0xbbbbbd,.7);
  structural.lineBetween(310,-23,385,-23);
  structural.lineBetween(310,-9,385,-9);
  label(scene,interior,348,22,'COMMAND',10,'#dedee0');

  // Clear central utility spine connects the bridge and both hangar shoulders.
  structural.fillStyle(0x141416,1);
  structural.lineStyle(1,0x7a7a7d,.46);
  structural.fillRoundedRect(-249,-35,540,70,8);
  structural.strokeRoundedRect(-249,-35,540,70,8);
  structural.lineStyle(1.2,0xc4c4c6,.32);
  structural.lineBetween(-244,0,289,0);

  // Hangar floor: additional owned berth rows extend the SIDE superstructure.
  const capacity=Math.min(MAX_BERTHS,hangarCapacity(state));
  const rowCount=Math.max(1,Math.ceil(capacity/4));
  const floorTop=-183-(rowCount-1)*112;
  const floorBottom=-45;
  const floorHeight=floorBottom-floorTop;
  structural.fillStyle(0x0b0b0d,1);
  structural.lineStyle(3,0xc7c7c9,.85);
  structural.fillRoundedRect(-284,floorTop,568,floorHeight,14);
  structural.strokeRoundedRect(-284,floorTop,568,floorHeight,14);
  structural.lineStyle(1,0x89898c,.12);
  for(let x=-270;x<278;x+=35)structural.lineBetween(x,floorTop+7,x,floorBottom-7);
  for(let y=floorTop+14;y<floorBottom;y+=36)structural.lineBetween(-277,y,279,y);

  // Service rails, physical bay lanes, locking clamps and numbered ground marks.
  structural.fillStyle(0x39393b,.9);
  structural.fillRoundedRect(-277,floorTop+10,10,Math.max(30,floorHeight-20),4);
  structural.fillRoundedRect(269,floorTop+10,10,Math.max(30,floorHeight-20),4);
  for(let berth=0;berth<capacity;berth++){
    const p=berthLocalPosition(berth);
    structural.lineStyle(1.8,0xc4c4c5,.6);
    structural.strokeRoundedRect(p.x-61,p.y-36,122,72,6);
    structural.lineStyle(3,0xe4e4e5,.32);
    structural.lineBetween(p.x-55,p.y-26,p.x-55,p.y+26);
    structural.lineBetween(p.x+55,p.y-26,p.x+55,p.y+26);
    structural.fillStyle(0xe9e9e9,.47);
    structural.fillCircle(p.x-55,p.y+26,3);
    structural.fillCircle(p.x+55,p.y+26,3);
    label(scene,interior,p.x,p.y+46,String(berth+1).padStart(2,'0'),10,'#b9b9ba');
  }
  label(scene,interior,50,floorBottom+24,'HANGAR / DOCKING',11,'#d3d3d3');

  // Physical side access: door housing, passage and a tractor emitter.
  const port=dockingPort(state);
  const doorY=port.entrance.y-homeY;
  // Airlock passage is a solid continuation of the hangar floor.
  const passageTop=doorY+21;
  const passageBottom=floorTop+18;
  const passageLength=Math.max(20,passageBottom-passageTop);
  structural.fillStyle(0x252527,1);
  structural.lineStyle(1.8,0x929294,.85);
  structural.fillRoundedRect(-157,passageTop,84,passageLength,6);
  structural.strokeRoundedRect(-157,passageTop,84,passageLength,6);
  structural.lineStyle(1,0xd0d0d2,.27);
  structural.lineBetween(-115,passageTop+6,-115,passageTop+passageLength-6);
  structural.fillStyle(0x272729,1);
  structural.lineStyle(2.2,0xe3e3e3,.87);
  structural.fillRoundedRect(-174,doorY-13,116,41,7);
  structural.strokeRoundedRect(-174,doorY-13,116,41,7);
  structural.lineStyle(1,0xffffff,.38);
  for(let i=0;i<7;i++)structural.lineBetween(-161+i*15,doorY-9,-161+i*15,doorY+24);
  structural.lineStyle(2,0xa1a1a1,.5);
  structural.lineBetween(-114,doorY+29,-114,floorTop+4);
  structural.fillStyle(0xf4f4f4,.83);
  structural.fillCircle(port.tractor.x-homeX,port.tractor.y-homeY,7);
  label(scene,interior,-114,doorY-36,'AIRLOCK A',10,'#e1e1e1');

  // Existing room ids/coordinates remain the same; each renderer uses the
  // exact physical deck mapping also used by direct mouse selection.
  const online=powerReport(state).onlineIds;
  const buildMode=document.body.dataset.uiPanel==='build';
  if(buildMode){
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        if(state.rooms.some(room=>room.x===x&&room.y===y))continue;
        const connected=state.rooms.some(room=>Math.abs(room.x-x)+Math.abs(room.y-y)===1);
        if(!connected)continue;
        const p=deckCellPoint(x,y);
        const g=scene.add.graphics();interior.add(g);
        g.lineStyle(1,0xb0b0b2,.32);
        g.strokeRoundedRect(p.x-CELL_SIZE.width/2,p.y-CELL_SIZE.height/2,
          CELL_SIZE.width,CELL_SIZE.height,6);
        label(scene,interior,p.x,p.y,'+',15,'#818184');
      }
    }
  }
  // Permanent bridge, first reactor and installed hangar have full-sized
  // physical facilities above. Never overlay second tiny "rooms" over them.
  for(const room of state.rooms){
    if(room.type==='command'||room.type==='hangar'||room.id==='room-2')continue;
    const p=deckCellPoint(room.x,room.y);
    structural.lineStyle(1.6,0x8b8b8d,.53);
    structural.lineBetween(p.x,p.y,p.x,Math.sign(p.y)*58);
    moduleTile(scene,interior,room,online.has(room.id));
  }

  // Opaque logo-based upper hull. The door is a distinct physical hatch,
  // rather than fading out every room as one identical rectangular slab.
  const roof=scene.add.container(homeX,homeY).setDepth(26);
  const armor=scene.add.graphics();roof.add(armor);
  path(armor,HULL,0x151517,0xefefef,3.5);
  path(armor,INNER,0x232325,0x79797c,1.3);
  // The side hangar shoulder visually expands when new parking rows are built.
  const shellTop=floorTop-16;
  armor.fillStyle(0x1b1b1e,1);
  armor.lineStyle(2.5,0xc7c7c8,.85);
  armor.fillRoundedRect(-292,shellTop,586,58,11);
  armor.strokeRoundedRect(-292,shellTop,586,58,11);
  armor.lineStyle(1.5,0xa3a3a5,.76);
  for(let i=0;i<capacity;i++){
    const p=berthLocalPosition(i);
    armor.lineBetween(p.x-52,p.y-53,p.x+52,p.y-53);
  }
  // Cockpit and central structure remain strongly tied to the mark's nose.
  armor.fillStyle(0x080809,1);
  armor.lineStyle(2,0xd0d0d0,.88);
  armor.fillTriangle(245,-42,493,0,245,42);
  armor.strokeTriangle(245,-42,493,0,245,42);
  armor.lineStyle(1,0xdadadb,.42);
  armor.lineBetween(-297,-251,245,-45);
  armor.lineBetween(-297,251,245,45);
  armor.lineBetween(-190,-118,191,0);
  armor.lineBetween(-190,118,191,0);
  for(const side of [-1,1]){
    const y=side*292;
    armor.fillStyle(0x303034,1);
    armor.lineStyle(1.5,0xe1e1e1,.8);
    armor.fillRoundedRect(-603,y-37,95,74,8);
    armor.strokeRoundedRect(-603,y-37,95,74,8);
    armor.fillStyle(0xd0d0d2,.75);
    armor.fillRoundedRect(-611,y-25,8,50,4);
  }
  armor.fillStyle(0x111113,1);
  armor.lineStyle(2,0xe0e0e0,.9);
  armor.fillRoundedRect(-176,doorY-19,123,52,7);
  armor.strokeRoundedRect(-176,doorY-19,123,52,7);
  label(scene,roof,-118,doorY-41,'HANGAR A',12,'#f1f1f1');
  label(scene,roof,-155,3,'A R R O W',25,'#ededed');
  label(scene,roof,0,468,'MOTHERSHIP 01',12,'#b3b3b5');

  // A true two-leaf airlock sits ABOVE the opaque roof. Each armored half
  // retracts sideways before the vessel enters. Both halves stay visible
  // throughout the transition rather than teleporting out of existence.
  const doors=scene.add.container(homeX,homeY).setDepth(29);
  const doorCenterX=-115;
  const createLeaf=(side:-1|1):Phaser.GameObjects.Container=>{
    const leaf=scene.add.container(doorCenterX+side*29,doorY);
    const panel=scene.add.graphics();
    panel.fillStyle(0x333337,1);
    panel.lineStyle(1.8,0xe0e0e2,.95);
    panel.fillRoundedRect(-28,-17,56,34,3);
    panel.strokeRoundedRect(-28,-17,56,34,3);
    panel.lineStyle(1,0xb1b1b5,.5);
    for(let j=0;j<3;j++){
      const x=-17+j*13;
      panel.lineBetween(x,-11,x,11);
    }
    // Closing seam and safety markings.
    panel.lineStyle(2,0xffffff,.7);
    panel.lineBetween(-side*28,-14,-side*28,14);
    leaf.add(panel);
    doors.add(leaf);
    return leaf;
  };
  const doorLeft=createLeaf(-1);
  const doorRight=createLeaf(1);
  const docked=state.ships.some(ship=>ship.id===state.activeShipId&&ship.docked);
  if(docked){doorLeft.x-=45;doorRight.x+=45;}
  return {roof,interior,doors,doorLeft,doorRight,doorCenterX};
}
