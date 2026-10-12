import Phaser from 'phaser';
import type { GameState, Room } from '../sim/model';
import { HOME, ROOM_GRID } from '../sim/model';
import { berthLocalPosition, hangarCapacity, MAX_BERTHS } from '../sim/hangar';
import { MODULES, powerReport } from '../sim/mothership';
import { CELL_SIZE, deckCellPoint } from './deckLayout';

export interface MothershipArtwork {
  roof:Phaser.GameObjects.Container;
  interior:Phaser.GameObjects.Container;
}
type XY=[number,number];
const HULL:XY[]=[
  [-554,-184],[-458,-193],[-311,-350],[-58,-339],
  [283,-178],[568,0],[283,178],[-58,339],[-311,350],
  [-458,193],[-554,184],[-444,0],
];
const INNER:XY[]=[
  [-490,-157],[-409,-163],[-280,-299],[-76,-293],
  [259,-145],[478,0],[259,145],[-76,293],
  [-280,299],[-409,163],[-490,157],[-387,0],
];
function path(g:Phaser.GameObjects.Graphics,pts:XY[],color:number,stroke:number,w=2):void{
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
  homeX=HOME.x,homeY=HOME.y):MothershipArtwork{
  const interior=scene.add.container(homeX,homeY).setDepth(7);
  const deck=scene.add.graphics();interior.add(deck);
  path(deck,HULL,0x0b0b0d,0xc5c5c6,3);
  path(deck,INNER,0x171719,0x5e5e60,1.5);

  // The central hangar is a usable deck with open space, equipment and real bays.
  deck.fillStyle(0x0a0a0c,1);
  deck.lineStyle(2.8,0xb5b5b8,.92);
  deck.fillRoundedRect(-283,-187,567,375,12);
  deck.strokeRoundedRect(-283,-187,567,375,12);
  deck.lineStyle(1,0x77777a,.14);
  for(let x=-273;x<278;x+=35)deck.lineBetween(x,-179,x,181);
  for(let y=-178;y<186;y+=35)deck.lineBetween(-275,y,276,y);

  // Loading gantry and hangar entrance, deliberately readable at overview zoom.
  deck.lineStyle(3,0xe0e0e0,.8);
  deck.lineBetween(-275,-182,277,-182);
  deck.lineBetween(-275,183,277,183);
  deck.fillStyle(0x404044,.65);
  deck.fillRoundedRect(-275,-171,12,345,3);
  deck.fillRoundedRect(266,-171,12,345,3);
  deck.lineStyle(2,0xa2a2a5,.75);
  deck.lineBetween(73,-187,185,-187);
  deck.lineBetween(73,-170,73,-149);
  deck.lineBetween(185,-170,185,-149);

  const capacity=Math.min(MAX_BERTHS,hangarCapacity(state));
  for(let i=0;i<capacity;i++){
    const p=berthLocalPosition(i);
    deck.lineStyle(1.6,0xb6b6b8,.65);
    deck.strokeRoundedRect(p.x-60,p.y-34,120,69,7);
    deck.lineStyle(3,0xb8b8bb,.38);
    deck.lineBetween(p.x-51,p.y-27,p.x-51,p.y+27);
    deck.lineBetween(p.x+51,p.y-27,p.x+51,p.y+27);
    label(scene,interior,p.x,p.y+46,'0'+(i+1),10,'#b8b8ba');
  }
  label(scene,interior,125,-211,'ARRIVAL',11,'#d5d5d7');
  label(scene,interior,-5,208,'HANGAR / DECK 01',12,'#cecece');

  // The deck plan uses the SAME exact coordinates as construction's 6x4 map.
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
        g.lineStyle(1,0xaaaaad,.34);
        g.strokeRoundedRect(p.x-CELL_SIZE.width/2,p.y-CELL_SIZE.height/2,
          CELL_SIZE.width,CELL_SIZE.height,6);
        label(scene,interior,p.x,p.y,'+',16,'#77777a');
      }
    }
  }
  for(const room of state.rooms)moduleTile(scene,interior,room,online.has(room.id));

  // Central aisle and service markings above room panels.
  deck.lineStyle(1,0x8f8f92,.42);
  deck.lineBetween(-268,0,265,0);
  deck.lineStyle(1,0xa5a5a5,.22);
  deck.lineBetween(-534,0,-286,0);
  deck.lineBetween(286,0,496,0);

  const roof=scene.add.container(homeX,homeY).setDepth(26);
  const plating=scene.add.graphics();roof.add(plating);
  path(plating,HULL,0x111113,0xe5e5e6,3.2);
  path(plating,INNER,0x202023,0x78787b,1.4);
  // A quiet arrow-shaped armor motif instead of neon sci-fi decoration.
  path(plating,[[50,-60],[232,-80],[461,0],[232,80],[50,60],[159,0]],
    0x0b0b0c,0xa9a9ac,2);
  plating.lineStyle(1.5,0xa9a9ab,.62);
  plating.lineBetween(-302,-305,239,-116);
  plating.lineBetween(-302,305,239,116);
  plating.lineBetween(-448,-169,-112,-83);
  plating.lineBetween(-448,169,-112,83);
  for(const y of [-169,169]){
    plating.fillStyle(0x29292c,1);
    plating.lineStyle(2,0xd3d3d4,.75);
    plating.fillRoundedRect(-572,y-31,101,62,9);
    plating.strokeRoundedRect(-572,y-31,101,62,9);
    plating.fillStyle(0xd7d7d7,.66);
    plating.fillRoundedRect(-578,y-20,8,40,4);
  }
  const count=Math.max(0,state.rooms.length-4);
  for(let i=0;i<Math.min(count,8);i++){
    plating.lineStyle(1.4,0xb1b1b3,.7);
    const px=-307+i*62;
    plating.lineBetween(px,-284,px+30,-277);
    plating.lineBetween(px,284,px+30,277);
  }
  label(scene,roof,-205,-11,'A R R O W',24,'#f1f1f1');
  label(scene,roof,-200,19,'MOTHERSHIP 01',11,'#adadaf');
  label(scene,roof,133,-359,'HANGAR ENTRY',11,'#e2e2e2');
  label(scene,roof,0,390,'FRONTIER',12,'#a3a3a5');
  return {roof,interior};
}
