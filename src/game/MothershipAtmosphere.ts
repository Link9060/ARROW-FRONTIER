import Phaser from 'phaser';
import { HOME } from '../sim/model';
import type { GameState } from '../sim/model';
import { hangarCapacity } from '../sim/hangar';

/**
 * Quiet hardware motion, not floating neon UI: exhaust exhausts, runway
 * guidance lights and a subtle active-ship parking locator. All effects
 * share two reusable Graphics objects and advance with actual frame time.
 */
export class MothershipAtmosphere {
  private readonly hangar:Phaser.GameObjects.Graphics;
  private readonly engines:Phaser.GameObjects.Graphics;
  private elapsed=0;

  constructor(scene:Phaser.Scene) {
    // Cutaway details above the floor and below the docked ship sprites.
    this.hangar=scene.add.graphics().setDepth(17);
    // Thrusters remain visible when the opaque exterior is restored.
    this.engines=scene.add.graphics().setDepth(28);
  }

  update(deltaSeconds:number,state:GameState,roofAlpha:number):void {
    this.elapsed+=Math.min(.08,Math.max(0,deltaSeconds));
    this.engines.clear();
    const enginePulse=.84+.16*Math.sin(this.elapsed*4.7);
    for(const y of [-293,293]){
      const px=HOME.x-619,py=HOME.y+y;
      for(let i=-1;i<=1;i++){
        const yy=py+i*19;
        const flicker=.8+.2*Math.sin(this.elapsed*7.4+i*2.3);
        this.engines.fillStyle(0xededf0,.13*enginePulse*flicker);
        this.engines.fillEllipse(px-20,yy,47+7*Math.sin(this.elapsed*4+i),8);
        this.engines.lineStyle(1.15,0xf2f2f4,.2*enginePulse);
        this.engines.lineBetween(px-8,yy,px-40-flicker*5,yy);
      }
    }
    this.hangar.clear();
    if(roofAlpha>.94)return;
    const rows=Math.max(1,Math.ceil(hangarCapacity(state)/4));
    const floorTop=-183-(rows-1)*138;
    const floorBottom=-45;
    const pulseBase=this.elapsed*1.6;
    for(let y=floorTop+19,k=0;y<floorBottom-15;y+=25,k++){
      const phase=(pulseBase-k*.13)*Math.PI*2;
      const brightness=.15+.34*(.5+.5*Math.sin(phase));
      for(const x of [-47,47]){
        this.hangar.fillStyle(0xf6f6f7,brightness);
        this.hangar.fillRoundedRect(HOME.x+x-1.5,HOME.y+y-3,3,6,1);
      }
    }
    // Active parked vessel gets a restrained white locator on its bay floor.
    const active=state.ships.find(ship=>ship.id===state.activeShipId);
    if(active?.docked){
      const halo=.16+.1*(.5+.5*Math.sin(this.elapsed*2.7));
      this.hangar.lineStyle(1.4,0xffffff,halo);
      this.hangar.strokeEllipse(active.x,active.y,95,76);
    }
  }
}
