import Phaser from 'phaser';
import { HOME } from '../sim/model';
import type { GameState } from '../sim/model';
import { hangarCapacity } from '../sim/hangar';
import {
  HANGAR_SIDES, SIDE_SIGN, hangarFloor, SIDE_SERVICE_X,
  SIDE_BERTH_Y,
} from '../sim/flagshipLayout';

/** Thin, physical lights in both hangars, and restrained split-tail exhaust. */
export class MothershipAtmosphere {
  private readonly hangar:Phaser.GameObjects.Graphics;
  private readonly engines:Phaser.GameObjects.Graphics;
  private elapsed=0;
  constructor(scene:Phaser.Scene){
    this.hangar=scene.add.graphics().setDepth(17);
    this.engines=scene.add.graphics().setDepth(28);
  }
  update(seconds:number,state:GameState,roofAlpha:number):void {
    this.elapsed+=Math.min(.08,Math.max(0,seconds));
    this.engines.clear();
    const pulse=.78+.22*Math.sin(this.elapsed*4.2);
    for(const side of HANGAR_SIDES){
      const sign=SIDE_SIGN[side];
      // No exhaust crosses the boundaries of the ARROW tail fins.
      const startX=HOME.x-507,centerY=HOME.y+sign*358;
      for(let j=-1;j<=1;j++){
        const y=centerY+j*11,shimmer=.7+.3*Math.sin(this.elapsed*7.1+j);
        this.engines.fillStyle(0xf2f2f3,.12*pulse*shimmer);
        this.engines.fillEllipse(startX-9,y,22+5*shimmer,5.5);
        this.engines.lineStyle(1,0xf3f3f4,.22*pulse);
        this.engines.lineBetween(startX-3,y,startX-19,y);
      }
    }
    this.hangar.clear();
    if(roofAlpha>.94)return;
    const tiers=Math.max(1,Math.ceil(hangarCapacity(state)/4));
    for(const side of HANGAR_SIDES){
      const sign=SIDE_SIGN[side],floor=hangarFloor(side,tiers);
      const x=HOME.x+SIDE_SERVICE_X;
      for(let y=floor.y+14,k=0;y<floor.y+floor.height-10;y+=19,k++){
        const glow=.14+.3*(.5+.5*Math.sin(this.elapsed*5+k*.6));
        this.hangar.fillStyle(0xffffff,glow);
        this.hangar.fillRoundedRect(x-2,HOME.y+y-2,4,4,1);
      }
      // Newly unlocked bay rows get matching guide strobes, not just stats.
      for(let t=0;t<tiers;t++){
        const y=HOME.y+sign*SIDE_BERTH_Y[t];
        this.hangar.fillStyle(0xf7f7f7,.2+.1*Math.sin(this.elapsed*4+t));
        this.hangar.fillCircle(HOME.x-65,y,2.6);
      }
    }
    const ship=state.ships.find(s=>s.id===state.activeShipId);
    if(ship?.docked){
      this.hangar.lineStyle(1,0xffffff,
        .16+.09*(.5+.5*Math.sin(this.elapsed*2.4)));
      this.hangar.strokeEllipse(ship.x,ship.y,70,48);
    }
  }
}
