import { activeShip, roundCargo } from '../sim/engine';
import {
  BUILDABLE, MODULES, buildRoom, canBuild, canEnterInterior, canUpgrade,
  canUpgradeShip, powerReport, roomOnline, shipUpgradeCost, toggleRoom,
  upgradeCost, upgradeRoom, upgradeShip,
} from '../sim/mothership';
import { ROOM_GRID } from '../sim/model';
import type { GameState, RoomType, Resources } from '../sim/model';
import type { ShipUpgrade } from '../sim/mothership';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error('FRONTIER UI missing: '+id);
  return found as T;
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value=''): HTMLElementTagNameMap[K] => {
  const item=document.createElement(tag);
  item.className=cls;
  item.textContent=value;
  return item;
};
function costText(resources: Resources): string {
  const costs=[resources.iron ? resources.iron+' iron':'',resources.copper ? resources.copper+' copper':'',resources.alloy ? resources.alloy+' alloy':''];
  return costs.filter(Boolean).join(' · ') || 'Included';
}

export class BuilderUI {
  private readonly state: GameState;
  private readonly changed: () => void;
  private readonly onVisibility: (visible:boolean)=>void;
  private readonly notice:(text:string)=>void;
  private visible=false;
  private selectedType: RoomType='storage';
  private selectedRoomId: string|null=null;
  private selectedShipId: string|null=null;
  private refreshElapsed=0;

  constructor(state:GameState, changed:()=>void, onVisibility:(visible:boolean)=>void,
    notice:(text:string)=>void) {
    this.state=state; this.changed=changed; this.onVisibility=onVisibility; this.notice=notice;
    $('builder-close').addEventListener('click',()=>this.close());
  }
  get isOpen():boolean { return this.visible; }
  open():void {
    if(this.visible)return;
    if(document.body.dataset.frontierView==='transition' || !canEnterInterior(this.state)){
      this.notice('Dock your ship to manage mothership rooms.');
      return;
    }
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
  toggle():void { if(this.visible)this.close();else this.open(); }
  private commit(successMessage:string):void {
    this.changed();
    this.render();
    this.notice(successMessage);
  }
  /** Same grid coordinates can be chosen from the 2D deck or the deck map. */
  selectCell(x:number,y:number):void {
    if(!this.visible)return;
    const current=this.state.rooms.find(room=>room.x===x&&room.y===y);
    if(current){
      this.selectedRoomId=current.id;
      this.render();
      return;
    }
    const issue=canBuild(this.state,this.selectedType,x,y);
    if(issue){this.notice(issue);return;}
    const error=buildRoom(this.state,this.selectedType,x,y);
    if(error){this.notice(error);return;}
    this.selectedRoomId=this.state.rooms.find(room=>room.x===x&&room.y===y)?.id??null;
    this.commit(MODULES[this.selectedType].title+' built.');
  }
  private renderPalette():void {
    const palette=$('room-palette');
    palette.replaceChildren();
    for(const type of BUILDABLE){
      const spec=MODULES[type];
      const button=node('button','blueprint'+(this.selectedType===type&&!this.selectedRoomId?' active':'')) as HTMLButtonElement;
      button.type='button';
      button.setAttribute('aria-pressed',String(this.selectedType===type&&!this.selectedRoomId));
      button.append(
        node('span','blueprint-code',spec.code),
        node('strong','blueprint-title',spec.title.replace('Fusion ','').replace('Ore ','').replace('Cargo ','')),
        node('span','blueprint-cost',costText(spec.cost)),
      );
      button.addEventListener('click',()=>{
        this.selectedType=type;
        this.selectedRoomId=null;
        this.render();
      });
      palette.appendChild(button);
    }
  }
  private renderGrid():void {
    const grid=$('room-grid');
    grid.replaceChildren();
    const powered=powerReport(this.state).onlineIds;
    for(let y=0;y<ROOM_GRID.rows;y++){
      for(let x=0;x<ROOM_GRID.columns;x++){
        const room=this.state.rooms.find(item=>item.x===x&&item.y===y);
        const near=this.state.rooms.some(item=>Math.abs(item.x-x)+Math.abs(item.y-y)===1);
        const cls='module-cell '+(room?'occupied '+(powered.has(room.id)?'online':'offline'):(near?'connected':'empty'))+(room&&room.id===this.selectedRoomId?' focused':'');
        const button=node('button',cls) as HTMLButtonElement;
        button.type='button';
        button.setAttribute('aria-label',room?MODULES[room.type].title+', level '+room.level:
          'Deck '+(x+1)+','+(y+1)+(near?' available':' unconnected'));
        if(room){
          button.append(node('strong','module-symbol',MODULES[room.type].code),
            node('span','module-level',String(room.level)));
        }else button.append(node('span','module-plus',near?'+':'·'));
        button.addEventListener('click',()=>this.selectCell(x,y));
        grid.appendChild(button);
      }
    }
    $('builder-count').textContent=this.state.rooms.length+' / '+(ROOM_GRID.rows*ROOM_GRID.columns);
  }
  private renderDetails():void {
    const dest=$('room-details');
    dest.replaceChildren();
    const room=this.state.rooms.find(item=>item.id===this.selectedRoomId);
    if(!room){
      const spec=MODULES[this.selectedType];
      dest.append(node('div','detail-kicker','SELECTED MODULE'),
        node('h3','detail-title',spec.title),
        node('p','detail-copy',spec.description),
        node('div','detail-info',costText(spec.cost)+'  ·  '+spec.draw+' power'));
      return;
    }
    const spec=MODULES[room.type];
    const isOnline=powerReport(this.state).onlineIds.has(room.id);
    dest.append(node('div','detail-kicker','ROOM '+(room.x+1)+','+(room.y+1)),
      node('h3','detail-title',spec.title),
      node('p','detail-copy',spec.description),
      node('div','detail-info','LEVEL '+room.level+' / 3 · '+(isOnline?'ONLINE':room.enabled?'NO POWER':'OFF')));
    if(BUILDABLE.includes(room.type)){
      const cost=upgradeCost(room);
      const button=node('button','builder-action','Upgrade · '+costText(cost));
      button.type='button';
      const issue=canUpgrade(this.state,room);
      button.disabled=!!issue;
      if(issue)button.title=issue;
      button.addEventListener('click',()=>{
        const error=upgradeRoom(this.state,room.id);
        if(error){this.notice(error);return;}
        this.commit(spec.title+' upgraded.');
      });
      dest.appendChild(button);
    }
    if(['reactor','refinery','fabricator'].includes(room.type)){
      const button=node('button','builder-action',room.enabled?'Disable room':'Enable room');
      button.type='button';
      button.addEventListener('click',()=>{
        const error=toggleRoom(this.state,room.id);
        if(error){this.notice(error);return;}
        this.commit(room.enabled?'Room enabled.':'Room disabled.');
      });
      dest.appendChild(button);
    }
    const back=node('button','builder-back','← Back to modules');
    back.type='button';
    back.addEventListener('click',()=>{this.selectedRoomId=null;this.render();});
    dest.appendChild(back);
  }
  private renderFabricator():void {
    const dest=$('fabricator-panel');
    dest.replaceChildren();
    if(!roomOnline(this.state,'fabricator')){
      dest.append(node('p','detail-copy','Build and power a fabricator to upgrade docked ships.'));
      return;
    }
    const chosen=this.state.ships.find(ship=>ship.id===this.selectedShipId) ??
      this.state.ships.find(ship=>ship.docked) ?? activeShip(this.state);
    this.selectedShipId=chosen.id;
    const select=node('select','fabricator-ship') as HTMLSelectElement;
    select.setAttribute('aria-label','Ship to upgrade');
    for(const ship of this.state.ships){
      const option=document.createElement('option');
      option.value=ship.id;
      option.textContent=ship.name+(ship.docked?' · docked':' · flying');
      option.selected=ship.id===chosen.id;
      select.appendChild(option);
    }
    select.addEventListener('change',()=>{this.selectedShipId=select.value;this.render();});
    dest.appendChild(select);
    for(const kind of ['mining','cargo'] as ShipUpgrade[]){
      const cost=shipUpgradeCost(chosen,kind);
      const section=node('div','fabricator-upgrade');
      section.append(node('strong','fabricator-label',kind==='mining'?'Mining efficiency':'Cargo capacity'),
        node('span','fabricator-cost','Level '+chosen.upgrades[kind]+' / 3 · '+costText(cost)));
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
      section.appendChild(button);
      dest.appendChild(section);
    }
  }
  refreshCounters():void {
    if(!this.visible)return;
    const power=powerReport(this.state);
    $('builder-output').textContent=String(power.output);
    $('builder-load').textContent=String(power.load);
    $('builder-demand').textContent=String(power.demand);
    $('builder-iron').textContent=roundCargo(this.state.stored.iron);
    $('builder-copper').textContent=roundCargo(this.state.stored.copper);
    $('builder-alloy').textContent=roundCargo(this.state.stored.alloy);
    $('refinery-produced').textContent=roundCargo(this.state.lifetimeAlloy);
    $('refinery-status').textContent=roomOnline(this.state,'refinery')?'Running':'Not running';
  }
  render():void {
    if(!this.visible)return;
    this.renderPalette();
    this.renderGrid();
    this.renderDetails();
    this.renderFabricator();
    this.refreshCounters();
    this.refreshElapsed=0;
  }
  tick(deltaSeconds=.15):void {
    if(!this.visible)return;
    this.refreshElapsed+=deltaSeconds;
    if(this.refreshElapsed>=1){
      this.refreshCounters();
      this.refreshElapsed=0;
    }
  }
}
