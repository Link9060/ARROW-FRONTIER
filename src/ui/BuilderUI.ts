import { activeShip, roundCargo } from '../sim/engine';
import {
  BUILDABLE, MODULES, buildRoom, canBuild, canEnterInterior, canUpgrade,
  canUpgradeShip, powerReport, roomOnline, shipUpgradeCost, toggleRoom,
  upgradeCost, upgradeRoom, upgradeShip,
} from '../sim/mothership';
import { ROOM_GRID } from '../sim/model';
import type { GameState, Resources, Room, RoomType } from '../sim/model';
import type { ShipUpgrade } from '../sim/mothership';
import { roomEconomics } from './roomEconomics';

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{
  const found=document.getElementById(id);
  if(!found)throw new Error('FRONTIER UI missing: '+id);
  return found as T;
};
const node=<K extends keyof HTMLElementTagNameMap>(
  tag:K,cls:string,value='',
):HTMLElementTagNameMap[K]=>{
  const element=document.createElement(tag);
  element.className=cls;
  element.textContent=value;
  return element;
};
type DeckSlot={x:number;y:number};
const oreTypes=['iron','copper','alloy'] as const;
function shortCost(cost:Resources):string {
  return oreTypes.filter(ore=>cost[ore]>0)
    .map(ore=>cost[ore]+' '+ore).join(' · ')||'No materials';
}
function makeClose(onClose:()=>void):HTMLButtonElement {
  const button=node('button','detail-dismiss','×');
  button.type='button';
  button.setAttribute('aria-label','Close room details');
  button.addEventListener('click',onClose);
  return button;
}

export class BuilderUI {
  private readonly state:GameState;
  private readonly changed:()=>void;
  private readonly onVisibility:(visible:boolean)=>void;
  private readonly notice:(text:string)=>void;
  private visible=false;
  /** No room palette, option or detail is visible until a grid cell is chosen. */
  private slot:DeckSlot|null=null;
  private expandedType:RoomType|null=null;
  private selectedRoomId:string|null=null;
  private selectedShipId:string|null=null;
  private refreshElapsed=0;

  constructor(state:GameState,changed:()=>void,onVisibility:(visible:boolean)=>void,
      notice:(text:string)=>void){
    this.state=state;
    this.changed=changed;
    this.onVisibility=onVisibility;
    this.notice=notice;
    $('builder-close').addEventListener('click',()=>this.close());
  }
  get isOpen():boolean {return this.visible;}
  open():void {
    if(this.visible)return;
    if(document.body.dataset.frontierView==='transition'||!canEnterInterior(this.state)){
      this.notice('Dock your ship to manage mothership rooms.');
      return;
    }
    // Opening Build always shows JUST the 6×4 deck, not a preselected module.
    this.slot=null;
    this.expandedType=null;
    this.selectedRoomId=null;
    this.visible=true;
    $('builder-panel').classList.add('open');
    $('builder-panel').setAttribute('aria-hidden','false');
    $('build-toggle').setAttribute('aria-expanded','true');
    this.onVisibility(true);
    this.render();
  }
  close():void {
    if(!this.visible)return;
    this.visible=false;
    $('builder-panel').classList.remove('open');
    $('builder-panel').setAttribute('aria-hidden','true');
    $('build-toggle').setAttribute('aria-expanded','false');
    this.onVisibility(false);
  }
  toggle():void {if(this.visible)this.close();else this.open();}
  private commit(message:string):void {
    this.changed();
    this.render();
    this.renderFabricator();
    this.notice(message);
  }
  private clearSelection():void {
    this.slot=null;this.selectedRoomId=null;this.expandedType=null;
    this.render();
  }

  /** Selection from both on-ship + markers and the actual Build grid. */
  selectCell(x:number,y:number):void {
    if(!this.visible)return;
    if(!Number.isInteger(x)||!Number.isInteger(y)||
        x<0||x>=ROOM_GRID.columns||y<0||y>=ROOM_GRID.rows)return;
    const occupied=this.state.rooms.find(room=>room.x===x&&room.y===y);
    if(occupied){
      this.slot=null;this.expandedType=null;
      this.selectedRoomId=occupied.id;
    }else{
      const connected=this.state.rooms.some(room=>
        Math.abs(room.x-x)+Math.abs(room.y-y)===1);
      if(!connected){
        this.notice('Choose a + next to an existing room.');
        return;
      }
      this.slot={x,y};
      this.selectedRoomId=null;
      this.expandedType=null;
    }
    this.render();
    $('room-details').scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  private renderGrid():void {
    const grid=$('room-grid');
    grid.replaceChildren();
    const powered=powerReport(this.state).onlineIds;
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        const room=this.state.rooms.find(item=>item.x===x&&item.y===y);
        const connected=!room&&this.state.rooms.some(item=>
          Math.abs(item.x-x)+Math.abs(item.y-y)===1);
        const focused=room?room.id===this.selectedRoomId:
          this.slot?.x===x&&this.slot?.y===y;
        const cls='module-cell '+
          (room?'occupied '+(powered.has(room.id)?'online':'offline'):
            connected?'connected':'empty')+
          (focused?' focused':'');
        const button=node('button',cls) as HTMLButtonElement;
        button.type='button';
        button.dataset.gridX=String(x);
        button.dataset.gridY=String(y);
        button.setAttribute('aria-pressed',String(!!focused));
        button.setAttribute('aria-label',room?
          MODULES[room.type].title+', level '+room.level+', inspect room':
          connected?'Add room at deck '+(x+1)+','+(y+1):
          'Deck '+(x+1)+','+(y+1)+' disconnected');
        if(room){
          button.append(node('strong','module-symbol',MODULES[room.type].code),
            node('span','module-level','L'+room.level));
        }else{
          button.append(node('span','module-plus',connected?'+':'·'));
          button.disabled=!connected;
        }
        button.addEventListener('click',()=>this.selectCell(x,y));
        grid.append(button);
      }
    }
    $('builder-count').textContent=this.state.rooms.length+' / '+
      (ROOM_GRID.rows*ROOM_GRID.columns);
  }

  /** Shared expandable specification, with real construction and running costs. */
  private renderEconomics(dest:HTMLElement,type:RoomType,level:number,
      cost:Resources):void {
    const info=roomEconomics(type,level);
    dest.append(node('p','detail-copy',info.purpose));

    const financial=node('div','room-materials');
    financial.append(node('h4','detail-subtitle','MATERIALS REQUIRED'));
    for(const ore of oreTypes){
      if(cost[ore]===0)continue;
      const row=node('div','material-row');
      row.append(node('span','material-name',ore.toUpperCase()));
      const quantity=node('span','material-count');
      quantity.dataset.ore=ore;
      quantity.dataset.needed=String(cost[ore]);
      quantity.textContent=cost[ore]+' needed · '+
        roundCargo(this.state.stored[ore])+' stored';
      quantity.classList.toggle('shortage',this.state.stored[ore]<cost[ore]);
      row.append(quantity);
      financial.append(row);
    }
    if(!oreTypes.some(ore=>cost[ore]>0))
      financial.append(node('p','detail-copy','No construction materials required.'));
    dest.append(financial);

    const sections=[
      ['BENEFITS',info.benefits],
      ['DRAWBACKS',info.drawbacks],
    ] as const;
    for(const [heading,items] of sections){
      const section=node('section','room-economy-section');
      section.append(node('h4','detail-subtitle',heading));
      const list=node('ul','room-economy-list');
      for(const item of items)list.append(node('li','',item));
      section.append(list);
      dest.append(section);
    }
    const flow=node('section','room-economy-section');
    flow.append(node('h4','detail-subtitle','RUNNING INPUTS / CONSUMPTION'),
      node('p','detail-copy',info.inputs),
      node('h4','detail-subtitle','OUTPUT / WHAT YOU GAIN'),
      node('p','detail-copy',info.outputs));
    dest.append(flow);
  }

  private renderRoomChoices(dest:HTMLElement,slot:DeckSlot):void {
    const heading=node('div','room-selection-header');
    const meta=node('div','');
    meta.append(
      node('div','detail-kicker','AVAILABLE DECK SLOT · '+(slot.x+1)+','+(slot.y+1)),
      node('h3','detail-title','Choose a room'),
    );
    heading.append(meta,makeClose(()=>this.clearSelection()));
    dest.append(heading);
    dest.append(node('p','detail-copy','Select a module to expand its costs, benefits, drawbacks and output. Nothing is spent until you build.'));
    const list=node('div','room-choice-list');
    for(const type of BUILDABLE){
      const spec=MODULES[type];
      const expanded=type===this.expandedType;
      const wrapper=node('div','room-choice'+(expanded?' expanded':''));
      wrapper.dataset.moduleType=type;
      const toggle=node('button','room-choice-toggle') as HTMLButtonElement;
      toggle.type='button';
      toggle.setAttribute('aria-expanded',String(expanded));
      toggle.setAttribute('aria-label',spec.title+' room details');
      const leading=node('span','room-choice-leading');
      leading.append(node('strong','room-choice-code',spec.code),
        node('span','room-choice-name',spec.title));
      toggle.append(leading,node('span','room-choice-chevron',expanded?'⌃':'⌄'));
      toggle.addEventListener('click',()=>{
        this.expandedType=expanded?null:type;
        this.renderDetails();
      });
      wrapper.append(toggle);
      if(expanded){
        const breakdown=node('div','room-choice-details');
        this.renderEconomics(breakdown,type,1,spec.cost);
        const build=node('button','builder-action','Build '+spec.title);
        build.type='button';
        build.dataset.action='build-room';
        build.dataset.moduleType=type;
        const issue=canBuild(this.state,type,slot.x,slot.y);
        build.disabled=!!issue;
        if(issue)build.title=issue;
        build.addEventListener('click',()=>{
          const error=buildRoom(this.state,type,slot.x,slot.y);
          if(error){this.notice(error);return;}
          this.selectedRoomId=this.state.rooms.find(room=>
            room.x===slot.x&&room.y===slot.y)?.id??null;
          this.slot=null;this.expandedType=null;
          this.commit(spec.title+' built.');
        });
        breakdown.append(build);
        const explanation=node('p','room-action-hint',issue??'Deduct materials and install this room.');
        explanation.dataset.actionHint='build';
        wrapper.append(breakdown);
      }
      list.append(wrapper);
    }
    dest.append(list);
  }

  private renderExistingRoom(dest:HTMLElement,room:Room):void {
    const spec=MODULES[room.type];
    const online=powerReport(this.state).onlineIds.has(room.id);
    const heading=node('div','room-selection-header');
    const meta=node('div','');
    meta.append(node('div','detail-kicker','DECK '+(room.x+1)+','+(room.y+1)),
      node('h3','detail-title',spec.title));
    heading.append(meta,makeClose(()=>this.clearSelection()));
    dest.append(heading,node('div','detail-info',
      'LEVEL '+room.level+' / 3 · '+(online?'ONLINE':room.enabled?'NO POWER':'OFFLINE')));
    const summary=document.createElement('details');
    summary.className='room-installed-details';
    const toggle=node('summary','room-installed-summary','Room information · materials, benefits and output');
    summary.append(toggle);
    const breakdown=node('div','room-installed-breakdown');
    // No materials are consumed simply by inspecting a built room.
    this.renderEconomics(breakdown,room.type,room.level,
      {iron:0,copper:0,alloy:0});
    summary.append(breakdown);
    dest.append(summary);
    if(BUILDABLE.includes(room.type)){
      const cost=upgradeCost(room);
      const upgrade=document.createElement('details');
      upgrade.className='room-installed-details';
      const summaryBtn=node('summary','room-installed-summary',
        room.level>=3?'Maximum level reached':'Upgrade room · Level '+(room.level+1));
      upgrade.append(summaryBtn);
      const body=node('div','room-installed-breakdown');
      if(room.level<3){
        body.append(node('p','detail-copy','Improvement at next level: '+
          roomEconomics(room.type,room.level+1).outputs));
        const materials=node('div','room-materials');
        materials.append(node('h4','detail-subtitle','UPGRADE MATERIALS'));
        for(const ore of oreTypes){
          if(!cost[ore])continue;
          const row=node('div','material-row');
          row.append(node('span','material-name',ore.toUpperCase()));
          const have=node('span','material-count',
            cost[ore]+' needed · '+roundCargo(this.state.stored[ore])+' stored');
          have.dataset.ore=ore;have.dataset.needed=String(cost[ore]);
          have.classList.toggle('shortage',this.state.stored[ore]<cost[ore]);
          row.append(have);materials.append(row);
        }
        body.append(materials);
        const button=node('button','builder-action','Upgrade · '+shortCost(cost));
        button.type='button';button.dataset.action='upgrade-room';
        const issue=canUpgrade(this.state,room);
        button.disabled=!!issue;
        if(issue)button.title=issue;
        button.addEventListener('click',()=>{
          const error=upgradeRoom(this.state,room.id);
          if(error){this.notice(error);return;}
          this.commit(spec.title+' upgraded.');
        });
        body.append(button);
        body.append(node('p','room-action-hint',issue??'Install the upgrade.'));
      }
      upgrade.append(body);
      dest.append(upgrade);
    }
    if(['reactor','refinery','fabricator'].includes(room.type)){
      const button=node('button','builder-action',room.enabled?'Disable room':'Enable room');
      button.type='button';button.dataset.action='toggle-room';
      button.addEventListener('click',()=>{
        const wasEnabled=room.enabled;
        const error=toggleRoom(this.state,room.id);
        if(error){this.notice(error);return;}
        this.commit(wasEnabled?'Room disabled.':'Room enabled.');
      });
      dest.append(button);
    }
    if(room.type==='fabricator')dest.append(node('p','room-action-hint',
      'Install ship upgrades from Fleet when the Fabricator is powered.'));
  }

  private renderDetails():void {
    const dest=$('room-details');
    dest.replaceChildren();
    const room=this.state.rooms.find(item=>item.id===this.selectedRoomId);
    if(room){
      dest.hidden=false;
      this.renderExistingRoom(dest,room);
    }else if(this.slot){
      dest.hidden=false;
      this.renderRoomChoices(dest,this.slot);
    }else{
      dest.hidden=true;
    }
    this.refreshAffordability();
  }

  /** Fabricator ship upgrades belong to Fleet, not the construction tab. */
  renderFabricator():void {
    const dest=$('fleet-upgrades');
    dest.replaceChildren();
    if(!roomOnline(this.state,'fabricator')){
      dest.append(node('p','detail-copy',
        'A powered Fabricator is required to install ship upgrades.'));
      return;
    }
    const chosen=this.state.ships.find(ship=>ship.id===this.selectedShipId) ??
      this.state.ships.find(ship=>ship.docked)??activeShip(this.state);
    this.selectedShipId=chosen.id;
    const select=node('select','fabricator-ship') as HTMLSelectElement;
    select.setAttribute('aria-label','Ship to upgrade');
    for(const ship of this.state.ships){
      const option=document.createElement('option');
      option.value=ship.id;
      option.textContent=ship.name+(ship.docked?' · docked':' · flying');
      option.selected=ship.id===chosen.id;
      select.append(option);
    }
    select.addEventListener('change',()=>{
      this.selectedShipId=select.value;
      this.renderFabricator();
    });
    dest.append(select);
    for(const kind of ['mining','cargo'] as ShipUpgrade[]){
      const cost=shipUpgradeCost(chosen,kind);
      const group=node('div','fabricator-upgrade');
      group.append(node('strong','fabricator-label',
        kind==='mining'?'Mining efficiency':'Cargo capacity'),
        node('span','fabricator-cost',
          'Level '+chosen.upgrades[kind]+' / 3 · '+shortCost(cost)));
      const button=node('button','builder-action','Install upgrade');
      button.type='button';
      const issue=canUpgradeShip(this.state,chosen,kind);
      button.disabled=!!issue;
      if(issue)button.title=issue;
      button.addEventListener('click',()=>{
        const error=upgradeShip(this.state,chosen.id,kind);
        if(error){this.notice(error);return;}
        this.commit('Upgrade installed on '+chosen.name+'.');
      });
      group.append(button);
      dest.append(group);
    }
  }

  private refreshAffordability():void {
    const dest=$('room-details');
    if(dest.hidden)return;
    for(const item of dest.querySelectorAll<HTMLElement>('.material-count')){
      const ore=item.dataset.ore as keyof Resources|undefined;
      const need=Number(item.dataset.needed??0);
      if(!ore||!Number.isFinite(need))continue;
      const have=this.state.stored[ore];
      item.textContent=need+' needed · '+roundCargo(have)+' stored';
      item.classList.toggle('shortage',have+1e-6<need);
    }
    if(this.slot&&this.expandedType){
      const build=dest.querySelector<HTMLButtonElement>('[data-action="build-room"]');
      if(build){
        const issue=canBuild(this.state,this.expandedType,this.slot.x,this.slot.y);
        build.disabled=!!issue;
        build.title=issue??'';
        const hint=dest.querySelector<HTMLElement>('[data-action-hint="build"]');
        if(hint)hint.textContent=issue??'Deduct materials and install this room.';
      }
    }
    const room=this.state.rooms.find(item=>item.id===this.selectedRoomId);
    if(room){
      const upgrade=dest.querySelector<HTMLButtonElement>('[data-action="upgrade-room"]');
      if(upgrade){
        const issue=canUpgrade(this.state,room);
        upgrade.disabled=!!issue;
        upgrade.title=issue??'';
      }
    }
  }
  render():void {
    if(!this.visible)return;
    this.renderGrid();
    this.renderDetails();
    this.refreshElapsed=0;
  }
  tick(seconds=.15):void {
    if(!this.visible)return;
    this.refreshElapsed+=seconds;
    if(this.refreshElapsed>=1){
      this.refreshAffordability();
      this.refreshElapsed=0;
    }
  }
}
