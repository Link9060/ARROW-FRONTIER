import type { GameState } from '../sim/model';
import {
  START_DESTINATION, SOLAR_SYSTEM, destinationById, orbitalPosition,
} from '../sim/solarSystem';
import type { Destination, TravelResult } from '../sim/solarSystem';

/** Accessible, animated DOM/SVG system chart. Phaser remains local flight. */
export class SystemMapUI {
  private root:HTMLElement;
  private state:GameState;
  private onTravel:(id:string)=>TravelResult;
  private onVisibility:(visible:boolean)=>void;
  private selectedId:string;
  private visible=false;
  private animation=0;
  private lastFrame=0;

  constructor(root:HTMLElement,state:GameState,onTravel:(id:string)=>TravelResult,
    onVisibility:(visible:boolean)=>void) {
    this.root=root;this.state=state;this.onTravel=onTravel;
    this.onVisibility=onVisibility;
    this.selectedId=state.currentDestinationId??START_DESTINATION;
    this.build();
    this.root.addEventListener('click',event=>{
      const target=event.target as Element;
      if(target.closest('#system-close')){this.close();return;}
      if(target.closest('#system-travel')){this.travel();return;}
      const element=target.closest('[data-destination]');
      const id=element?.getAttribute('data-destination');
      if(id&&destinationById(id))this.select(id);
    });
    this.root.addEventListener('keydown',event=>{
      const target=event.target as Element;
      const id=target.closest('[data-destination]')?.getAttribute('data-destination');
      if(id&&(event.key==='Enter'||event.key===' ')){
        event.preventDefault();this.select(id);
      }
    });
  }

  get isOpen():boolean{return this.visible;}
  open():void {
    if(this.visible)return;
    this.visible=true;
    this.selectedId=this.state.currentDestinationId??START_DESTINATION;
    this.root.hidden=false;
    this.root.setAttribute('aria-hidden','false');
    this.onVisibility(true);
    this.drawDetails();
    this.renderFrame(performance.now()/1000);
    this.animation=requestAnimationFrame(this.animate);
    this.root.querySelector<HTMLButtonElement>('#system-close')?.focus();
  }
  close():void {
    if(!this.visible)return;
    this.visible=false;
    cancelAnimationFrame(this.animation);
    this.root.hidden=true;
    this.root.setAttribute('aria-hidden','true');
    this.onVisibility(false);
  }
  toggle():void {if(this.visible)this.close();else this.open();}
  refresh():void {this.drawDetails();}
  private select(id:string):void {
    this.selectedId=id;
    this.drawDetails();
  }
  private travel():void {
    const outcome=this.onTravel(this.selectedId);
    if(outcome==='arrived'){this.close();return;}
    const note=this.root.querySelector<HTMLElement>('#system-travel-note')!;
    note.textContent=outcome==='must-dock'?'Dock the ship you are piloting before moving the mothership.':
      outcome==='same-destination'?'Your fleet is already in this orbit.':'That destination is unavailable.';
    this.drawDetails(note.textContent);
  }

  private build():void {
    // All labels are fixed game data, never HTML supplied by another user.
    const planets=SOLAR_SYSTEM.filter(item=>item.kind==='planet');
    const orbits=planets.map(p=>
      `<circle class="system-orbit" cx="0" cy="0" r="${p.orbitRadius}"></circle>`).join('');
    const belts=[227,457].map(r=>
      `<circle class="system-belt-ring" cx="0" cy="0" r="${r}"></circle>`).join('');
    let dust='';
    for(const [r,count] of [[227,136],[457,180]] as const){
      for(let i=0;i<count;i++){
        const angle=i*2.3999632297+(r===227?.4:1.7);
        const band=r+(Math.sin(i*12.9898)*.5)*17;
        dust+=`<circle class="system-dust" cx="${(Math.cos(angle)*band).toFixed(2)}" cy="${(Math.sin(angle)*band).toFixed(2)}" r="${i%11===0?1.35:.55}" />`;
      }
    }
    const moons=SOLAR_SYSTEM.filter(item=>item.kind==='moon').map(m=>
      `<circle class="system-moon-orbit" data-moon-parent="${m.parentId}" data-orbit="${m.orbitRadius}" cx="0" cy="0" r="${m.orbitRadius}" />`).join('');
    const nodes=SOLAR_SYSTEM.map(item=>{
      const isStar=item.kind==='star',isBelt=item.kind==='belt';
      const body=isStar?
        '<circle class="system-star-glow" r="40"/><circle class="system-star" r="23"/><circle class="system-star-core" r="10"/>':
        `<circle class="system-body-halo" r="${item.size+7}"/><circle class="system-body-core" r="${item.size}" fill="${item.hue}"/>`+
        (item.id==='caelum'?'<path class="system-gas-band" d="M-19 -5 Q0 4 19 -5 M-20 4 Q0 12 20 4"/>':'');
      return `<g class="system-body ${item.kind}" data-destination="${item.id}" role="button" tabindex="0" aria-label="Select ${item.name}" data-body="${item.id}">
        <circle class="system-hit" r="${Math.max(19,item.size+9)}"></circle>${body}
        ${item.kind==='planet'||isStar||isBelt?`<text class="system-label" x="${item.size+13}" y="-12">${item.name.toUpperCase()}</text>`:''}
      </g>`;
    }).join('');
    const options=SOLAR_SYSTEM.filter(d=>d.kind!=='star').map(d=>
      `<button type="button" class="system-destination" data-destination="${d.id}">
       <span class="system-dot" style="--orb-color:${d.hue}"></span>
       <span><strong>${d.name}</strong><small>${d.kind==='belt'?'RESOURCE FIELD':d.kind.toUpperCase()}</small></span>
       <span class="system-present" aria-label="Current location">●</span>
      </button>`).join('');
    this.root.innerHTML=`
      <header class="system-topbar">
        <span class="system-eyebrow">ARROW / NAVIGATION</span>
        <span class="system-top-title">HELIOS <span>STAR SYSTEM</span></span>
        <button type="button" class="system-close" id="system-close" aria-label="Close system map">ESC <span>×</span></button>
      </header>
      <div class="system-main">
        <aside class="system-sidebar">
          <div class="system-sidebar-header"><span class="system-eyebrow">DESTINATIONS</span><span>12 SIGNALS</span></div>
          <div class="system-region-list" id="system-destinations">
            <p class="system-group-label">STAR</p>
            <button type="button" class="system-destination" data-destination="helios"><span class="system-dot" style="--orb-color:#f4d9a0"></span><span><strong>Helios</strong><small>CENTRAL STAR</small></span><span class="system-present">●</span></button>
            <p class="system-group-label">WORLDS / SATELLITES / FIELDS</p>
            ${options}
          </div>
          <div class="system-sidebar-footer">ORBITAL POSITIONS / SIMULATED<br/>MOTHERSHIP JUMP NETWORK · v0.7</div>
        </aside>
        <div class="system-stage">
          <div class="system-stage-top"><span>HELIOS / ORBITAL CHART</span><span><span class="system-pulse"></span> LIVE ORBITS</span></div>
          <svg id="system-plot" class="system-plot" viewBox="-500 -500 1000 1000" role="group" aria-label="Interactive solar system with orbiting planets, moons and asteroid belts">
            <defs>
              <radialGradient id="helios-glow"><stop offset="0%" stop-color="#f7e4b7" stop-opacity=".33"/><stop offset="100%" stop-color="#b58e59" stop-opacity="0"/></radialGradient>
            </defs>
            <circle cx="0" cy="0" r="490" class="system-chart-ring"/>
            <path class="system-crosshair" d="M -500 0 H 500 M 0 -500 V 500"/>
            ${orbits}${belts}${dust}${moons}${nodes}
          </svg>
          <div class="system-stage-bottom"><span>SELECT A BODY OR CHOOSE FROM THE INDEX</span><span>NOT TO PHYSICAL SCALE</span></div>
        </div>
        <aside class="system-inspector">
          <span class="system-eyebrow">SELECTED LOCATION</span>
          <div class="system-inspector-hero"><span id="system-category">PLANET</span><span class="system-inspector-mark">↗</span></div>
          <h2 id="system-destination-name">Vesta</h2>
          <p id="system-destination-subtitle" class="system-inspector-type"></p>
          <p id="system-destination-description" class="system-inspector-description"></p>
          <div class="system-stats">
            <div><span>MINERAL FIELD</span><strong id="system-density"></strong></div>
            <div><span>PRIMARY ORE</span><strong id="system-ore"></strong></div>
            <div><span>ORBIT TYPE</span><strong id="system-orbit-type"></strong></div>
          </div>
          <div class="system-travel-status" id="system-travel-note" role="status"></div>
          <button type="button" class="system-travel-btn" id="system-travel">TRAVEL TO DESTINATION <span>↗</span></button>
          <span class="system-inspector-footnote">Jumps relocate your mothership and fleet. Dock the active ship first; all cargo, rooms and visited deposits are retained.</span>
        </aside>
      </div>`;
  }

  private drawDetails(message=''):void {
    const d=destinationById(this.selectedId);
    if(!d)return;
    const current=this.state.currentDestinationId??START_DESTINATION;
    this.root.querySelector('#system-destination-name')!.textContent=d.name;
    this.root.querySelector('#system-destination-subtitle')!.textContent=d.subtitle;
    this.root.querySelector('#system-destination-description')!.textContent=d.description;
    this.root.querySelector('#system-category')!.textContent=d.kind==='belt'?'RESOURCE FIELD':d.kind.toUpperCase();
    this.root.querySelector('#system-density')!.textContent=String(d.density)+' DEPOSITS';
    this.root.querySelector('#system-ore')!.textContent=d.copperFraction>.5?'COPPER':'IRON';
    this.root.querySelector('#system-orbit-type')!.textContent=d.parentId?'SATELLITE':d.kind==='star'?'STELLAR':d.kind==='belt'?'DEBRIS':'SOLAR';
    const button=this.root.querySelector<HTMLButtonElement>('#system-travel')!;
    const already=d.id===current;
    const undocked=!this.state.ships.find(s=>s.id===this.state.activeShipId)?.docked;
    button.disabled=already||undocked;
    button.innerHTML=already?'CURRENT LOCATION <span>✓</span>':'TRAVEL TO DESTINATION <span>↗</span>';
    const note=this.root.querySelector('#system-travel-note')!;
    note.textContent=message|| (already?'● Your mothership is currently here.':
      undocked?'Dock your active ship before traveling.':'JUMP AVAILABLE / NO FUEL REQUIRED');
    for(const el of this.root.querySelectorAll<HTMLElement>('[data-destination]')){
      const id=el.dataset.destination;
      el.classList.toggle('selected',id===d.id);
      el.classList.toggle('current',id===current);
      el.setAttribute('aria-pressed',String(id===d.id));
    }
  }
  private animate=(time:number):void=>{
    if(!this.visible)return;
    if(time-this.lastFrame>32){
      this.renderFrame(time/1000);this.lastFrame=time;
    }
    this.animation=requestAnimationFrame(this.animate);
  };
  private renderFrame(time:number):void {
    for(const d of SOLAR_SYSTEM){
      const pos=orbitalPosition(d,time);
      const node=this.root.querySelector<SVGGElement>(`[data-body="${d.id}"]`);
      node?.setAttribute('transform',`translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`);
    }
    for(const ring of this.root.querySelectorAll<SVGCircleElement>('[data-moon-parent]')){
      const d=destinationById(ring.dataset.moonParent??'');
      if(!d)continue;
      const pos=orbitalPosition(d,time);
      ring.setAttribute('cx',pos.x.toFixed(2));
      ring.setAttribute('cy',pos.y.toFixed(2));
    }
  }
}
