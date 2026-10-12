import Phaser from 'phaser';
import { HOME, ROOM_GRID } from '../sim/model';
import type { GameState, Room } from '../sim/model';
import { berthLocalPosition, hangarCapacity, dockingPort, shipBerthSpan } from '../sim/hangar';
import { MODULES, powerReport } from '../sim/mothership';
import { arrowOutline, FLAGSHIP_LENGTH } from '../sim/arrowGeometry';
import { CELL_SIZE, CORE_DECK, deckCellPoint } from './deckLayout';
import {
  HANGAR_SIDES, hangarFloor, SIDE_SIGN, PARKING_BAY, SIDE_PORT_X,
  SIDE_SERVICE_X,
} from '../sim/flagshipLayout';
import type { HangarSide } from '../sim/flagshipLayout';

type XY=readonly [number,number];
export interface AirlockArt {
  left:Phaser.GameObjects.Container;
  right:Phaser.GameObjects.Container;
  centerX:number;
}
export interface MothershipArtwork {
  roof:Phaser.GameObjects.Container;
  interior:Phaser.GameObjects.Container;
  doors:Phaser.GameObjects.Container;
  airlocks:Record<HangarSide,AirlockArt>;
}
function polygon(g:Phaser.GameObjects.Graphics,points:readonly XY[],
    fill:number,outline:number,lineWidth=1.5):void {
  g.fillStyle(fill,1);g.lineStyle(lineWidth,outline,.85);
  g.beginPath();
  points.forEach(([x,y],i)=>i===0?g.moveTo(x,y):g.lineTo(x,y));
  g.closePath();g.fillPath();g.strokePath();
}
function label(scene:Phaser.Scene,container:Phaser.GameObjects.Container,
  x:number,y:number,text:string,size=10,color='#9b9b9f'):void {
  container.add(scene.add.text(x,y,text,{
    fontFamily:'Inter, Arial, sans-serif',
    fontSize:size+'px',color,
    align:'center',letterSpacing:1,
  }).setOrigin(.5));
}
function drawRoom(scene:Phaser.Scene,container:Phaser.GameObjects.Container,
    room:Room,online:boolean):void {
  const p=deckCellPoint(room.x,room.y),g=scene.add.graphics();
  container.add(g);
  const w=CELL_SIZE.width-3,h=CELL_SIZE.height-2;
  const base=online?0x28282b:0x171719;
  g.fillStyle(base,1);
  g.lineStyle(1,online?0x79797f:0x3c3c42,.8);
  g.fillRoundedRect(p.x-w/2,p.y-h/2,w,h,3);
  g.strokeRoundedRect(p.x-w/2,p.y-h/2,w,h,3);
  const x=p.x-w/2+9,y=p.y;
  g.lineStyle(1,0xd1d1d5,online?.55:.24);
  if(room.type==='storage'){
    for(let i=0;i<3;i++)g.strokeRect(x+i*8,y-5,6,10);
  }else if(room.type==='refinery'){
    g.lineBetween(x,y-5,x+21,y-5);
    g.lineBetween(x+5,y,x+26,y);
    g.fillCircle(x+11,y+5,2);
  }else if(room.type==='reactor'){
    g.strokeCircle(x+9,y,6);g.fillCircle(x+9,y,2);
  }else if(room.type==='fabricator'){
    g.lineBetween(x,y+6,x+11,y-5);g.lineBetween(x+11,y-5,x+22,y+3);
  }else if(room.type==='command'){
    g.lineBetween(x,y-4,x+18,y-4);g.lineBetween(x,y+4,x+18,y+4);
  }else{
    // Legacy hangar anchor remains selectable in the 6x4 Build grid,
    // while the actual bays are now physically split to both sides.
    g.lineBetween(x,y,x+20,y);
    g.lineBetween(x+12,y-4,x+20,y);
    g.lineBetween(x+12,y+4,x+20,y);
  }
  label(scene,container,p.x+22,p.y,MODULES[room.type].code,8,
    online?'#d2d2d4':'#6d6d73');
}
function drawEngine(scene:Phaser.Scene,interior:Phaser.GameObjects.Container,
    g:Phaser.GameObjects.Graphics,sign:-1|1):void {
  const shape:XY[]=[
    [-507,-380],[-448,-374],[-333,-289],[-325,-216],
    [-406,-240],[-480,-323],
  ].map(([x,y])=>[x,y*sign]);
  const inset:XY[]=[
    [-487,-365],[-444,-352],[-355,-280],[-349,-243],
    [-410,-261],[-471,-330],
  ].map(([x,y])=>[x,y*sign]);
  polygon(g,shape,0x27272b,0x8f8f97,1.5);
  polygon(g,inset,0x131316,0x505058,1);
  for(let i=0;i<5;i++){
    const x=-466+i*24;
    const y=(-337+i*19)*sign;
    g.lineStyle(1.25,0xa7a7ae,.47);
    g.lineBetween(x,y-12,x+16,y+12);
  }
  // Exhaust ports remain fully inside the original ARROW tail fins.
  for(let i=-1;i<=1;i++){
    const y=(-359+i*11)*sign;
    g.fillStyle(0x09090b,1);g.lineStyle(1.4,0xc6c6ca,.76);
    g.fillEllipse(-506,y,14,8);g.strokeEllipse(-506,y,14,8);
  }
  label(scene,interior,-413,-307*sign,'ENGINE '+(sign<0?'A':'B'),10,'#9b9ba3');
}
function drawFixedSystems(scene:Phaser.Scene,
    interior:Phaser.GameObjects.Container,g:Phaser.GameObjects.Graphics):void {
  // The reactor is a real selectable room on the central modular deck.
  // Bridge wedge is an actual nose compartment.
  polygon(g,[[282,-47],[369,-31],[485,0],[369,31],[282,47],[307,0]],
    0x2a2a2e,0xa1a1a8,1.7);
  polygon(g,[[323,-24],[374,-17],[432,0],[374,17],[323,24],[337,0]],
    0x121215,0x626269,1.2);
  label(scene,interior,364,0,'COMMAND',10,'#dedee0');
}

export function buildMothershipArtwork(scene:Phaser.Scene,state:GameState,
    homeX=HOME.x,homeY=HOME.y):MothershipArtwork {
  const interior=scene.add.container(homeX,homeY).setDepth(7);
  const g=scene.add.graphics();interior.add(g);
  // Official ARROW mark is the exterior silhouette at EVERY stage.
  polygon(g,arrowOutline(FLAGSHIP_LENGTH),0x0d0d10,0xd4d4d7,2.3);
  polygon(g,arrowOutline(1020,.88),0x18181b,0x494950,1);

  // Compact, physically attached engines within the two rear tail fins.
  drawEngine(scene,interior,g,-1);
  drawEngine(scene,interior,g,1);

  // Everything buildable lives in the central fuselage.
  g.fillStyle(0x121215,1);
  g.lineStyle(2,0x8c8c93,.79);
  g.fillRoundedRect(CORE_DECK.x,CORE_DECK.y,CORE_DECK.width,CORE_DECK.height,9);
  g.strokeRoundedRect(CORE_DECK.x,CORE_DECK.y,CORE_DECK.width,CORE_DECK.height,9);
  g.lineStyle(1.2,0xd6d6dd,.24);
  g.lineBetween(-252,-2,269,-2);
  for(let j=0;j<7;j++){
    const x=-225+j*73;
    g.lineStyle(1,0x94949c,.16);
    g.lineBetween(x,CORE_DECK.y+5,x,CORE_DECK.y+CORE_DECK.height-5);
  }
  label(scene,interior,312,-72,'MODULAR CORE',9,'#99999f');
  drawFixedSystems(scene,interior,g);

  const capacity=hangarCapacity(state);
  const tiers=Math.max(1,Math.ceil(capacity/4));
  const online=powerReport(state).onlineIds;
  for(const side of HANGAR_SIDES){
    const sign=SIDE_SIGN[side];
    const floor=hangarFloor(side,tiers);
    g.fillStyle(0x0a0a0d,1);
    g.lineStyle(2.2,0xc0c0c5,.75);
    g.fillRoundedRect(floor.x,floor.y,floor.width,floor.height,10);
    g.strokeRoundedRect(floor.x,floor.y,floor.width,floor.height,10);
    // A real clearance spine on the RIGHT of the parked craft.
    const aisleX=SIDE_SERVICE_X;
    g.fillStyle(0x242428,.8);
    g.fillRect(aisleX-14,floor.y+5,29,floor.height-10);
    g.lineStyle(1,0xa5a5ab,.4);
    g.lineBetween(aisleX-15,floor.y+6,aisleX-15,floor.y+floor.height-6);
    g.lineBetween(aisleX+15,floor.y+6,aisleX+15,floor.y+floor.height-6);
    const yMin=floor.y+12,yMax=floor.y+floor.height-9;
    for(let y=yMin;y<yMax;y+=22){
      g.lineStyle(1,0xbdbdc3,.26);
      g.lineBetween(aisleX-4,y,aisleX+4,y+sign*5);
    }
    const consumed=new Set<number>();
    for(let berth=0;berth<capacity;berth++){
      if(consumed.has(berth))continue;
      const p=berthLocalPosition(berth);
      if(Math.sign(p.y)!==sign)continue;
      // Wide ships OWN a physically combined double berth. Draw one merged
      // parking cradle whose center is EXACTLY berthWorldPosition(ship).
      const wide=state.ships.some(ship=>ship.docked &&
        ship.berth===berth && shipBerthSpan(ship)===2);
      const paired=wide&&berth+1<capacity&&berth%2===0;
      if(paired)consumed.add(berth+1);
      const cx=paired?berthLocalPosition(berth,2).x:p.x;
      const w=PARKING_BAY.width+(paired?95:0),h=PARKING_BAY.height;
      g.fillStyle(0x161619,1);
      g.lineStyle(1.3,0x898991,.78);
      g.fillRoundedRect(cx-w/2,p.y-h/2,w,h,5);
      g.strokeRoundedRect(cx-w/2,p.y-h/2,w,h,5);
      g.lineStyle(2,0xc7c7cf,.45);
      for(const xx of [cx-w/2+8,cx+w/2-8]){
        g.lineBetween(xx,p.y-h/2+9,xx,p.y+h/2-9);
        g.fillStyle(0xc7c7cf,.5);
        g.fillCircle(xx,p.y+sign*(h/2-9),2);
      }
      const title=paired
        ?String(berth+1).padStart(2,'0')+' / '+String(berth+2).padStart(2,'0')
        :String(berth+1).padStart(2,'0');
      label(scene,interior,cx,p.y-sign*19,title,8,'#888890');
    }
    // Narrow entrance follows the actual side of the ship.
    const port=dockingPort(state,side);
    const doorY=port.entrance.y-homeY;
    const x=SIDE_PORT_X;
    const floorOuter=side==='north'?floor.y:floor.y+floor.height;
    const low=Math.min(doorY,floorOuter),high=Math.max(doorY,floorOuter);
    g.fillStyle(0x252529,1);
    g.lineStyle(1.5,0x94949a,.83);
    g.fillRoundedRect(x-21,low,42,Math.max(11,high-low),5);
    g.strokeRoundedRect(x-21,low,42,Math.max(11,high-low),5);
    g.fillStyle(0x313136,1);
    g.lineStyle(1.8,0xd8d8dd,.88);
    g.fillRoundedRect(x-40,doorY-12,80,24,4);
    g.strokeRoundedRect(x-40,doorY-12,80,24,4);
    g.fillStyle(0xdedee1,.75);
    g.fillCircle(port.tractor.x-homeX,port.tractor.y-homeY,4);
    label(scene,interior,-231,sign*70,
      side==='north'?'HANGAR A':'HANGAR B',10,'#c4c4c8');
  }

  const buildMode=document.body.dataset.uiPanel==='build';
  if(buildMode){
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        if(state.rooms.some(r=>r.x===x&&r.y===y))continue;
        if(!state.rooms.some(r=>Math.abs(r.x-x)+Math.abs(r.y-y)===1))continue;
        const p=deckCellPoint(x,y);
        g.lineStyle(1,0x919199,.42);
        g.strokeRoundedRect(p.x-CELL_SIZE.width/2,p.y-CELL_SIZE.height/2,
          CELL_SIZE.width,CELL_SIZE.height,4);
        label(scene,interior,p.x,p.y,'+',13,'#76767d');
      }
    }
  }
  for(const room of state.rooms)drawRoom(scene,interior,room,online.has(room.id));

  // Opaque armor covers the interior while in flight. Refinement stays
  // faithful to the ARROW mark instead of expanding rectangular pods.
  const roof=scene.add.container(homeX,homeY).setDepth(26);
  const armor=scene.add.graphics();roof.add(armor);
  polygon(armor,arrowOutline(FLAGSHIP_LENGTH),0x131316,0xe6e6e9,2.6);
  polygon(armor,arrowOutline(1020,.87),0x202024,0x61616a,1.1);
  armor.lineStyle(1.3,0x9b9ba2,.53);
  armor.lineBetween(-425,-332,227,-52);
  armor.lineBetween(-425,332,227,52);
  armor.lineBetween(-220,-107,233,-16);
  armor.lineBetween(-220,107,233,16);
  // Both bay-door stations exist in the broad shoulders.
  for(const side of HANGAR_SIDES){
    const sign=SIDE_SIGN[side],port=dockingPort(state,side);
    const y=port.entrance.y-homeY;
    armor.fillStyle(0x27272a,1);armor.lineStyle(1.6,0xc4c4ca,.8);
    armor.fillRoundedRect(SIDE_PORT_X-44,y-15,88,30,5);
    armor.strokeRoundedRect(SIDE_PORT_X-44,y-15,88,30,5);
    label(scene,roof,-188,sign*207,side==='north'?'A / DOCK':'B / DOCK',
      10,'#b5b5bb');
  }
  polygon(armor,[[290,-41],[420,-23],[499,0],[420,23],[290,41],[330,0]],
    0x0b0b0d,0xbfbfc7,1.5);
  label(scene,roof,-45,0,'A R R O W',23,'#cfcfd4');

  const doors=scene.add.container(homeX,homeY).setDepth(29);
  const makeAirlock=(side:HangarSide):AirlockArt=>{
    const centerX=SIDE_PORT_X,centerY=dockingPort(state,side).entrance.y-homeY;
    const createLeaf=(dir:-1|1)=>{
      const leaf=scene.add.container(centerX+dir*20,centerY);
      const panel=scene.add.graphics();
      panel.fillStyle(0x34343a,1);
      panel.lineStyle(1.2,0xdedee4,.9);
      panel.fillRoundedRect(-19,-12,38,24,3);
      panel.strokeRoundedRect(-19,-12,38,24,3);
      panel.lineStyle(1,0xaaaab2,.5);
      panel.lineBetween(-8,-7,-8,7);
      panel.lineBetween(4,-7,4,7);
      leaf.add(panel);doors.add(leaf);
      return leaf;
    };
    return {
      centerX,
      left:createLeaf(-1),
      right:createLeaf(1),
    };
  };
  const airlocks:Record<HangarSide,AirlockArt>={
    north:makeAirlock('north'),south:makeAirlock('south'),
  };
  return {roof,interior,doors,airlocks};
}
