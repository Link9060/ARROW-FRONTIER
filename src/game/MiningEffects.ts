import Phaser from 'phaser';
import type { Asteroid, Point } from '../sim/model';

interface Spark {
  x:number;y:number;vx:number;vy:number;
  age:number;life:number;size:number;spin:number;angular:number;
  kind:'spark'|'chunk';
}
interface Beam {
  from:Point;to:Point;targetId:string;
  ignition:number;release:number;pulse:number;
}
const clamp=(n:number,min:number,max:number):number=>Math.min(max,Math.max(min,n));
const mix=(a:number,b:number,t:number):number=>a+(b-a)*t;
export interface BeamExtent { start:number;end:number;strength:number; }
/**
 * Starts with a traveling tapered tip. Once the trigger is released, the final
 * pulse continues toward the asteroid instead of the line blinking away.
 */
export function beamExtent(ignition:number,release:number):BeamExtent {
  const head=clamp(ignition*7,0,1);
  const tail=clamp(release*4.8,0,1);
  return {start:tail,end:head,strength:Math.max(0,1-tail)};
}

export class MiningEffects {
  private graphics:Phaser.GameObjects.Graphics;
  private beam?:Beam;
  private sparks:Spark[]=[];
  private fired=false;
  private impactClock=0;
  private fragmentClock=0;
  private maxParticles=180;

  constructor(scene:Phaser.Scene){
    this.graphics=scene.add.graphics().setDepth(25);
  }

  fire(from:Point,target:Asteroid,extracted:number):void{
    if(extracted<=0)return;
    if(!this.beam||this.beam.targetId!==target.id||this.beam.release>0){
      this.beam={
        from:{x:from.x,y:from.y},to:{x:target.x,y:target.y},targetId:target.id,
        ignition:0,release:0,pulse:0,
      };
      this.sparks.push({
        x:from.x,y:from.y,vx:0,vy:0,
        age:0,life:.22,size:8,spin:0,angular:0,kind:'spark',
      });
    }
    this.beam.from={x:from.x,y:from.y};
    this.beam.to={x:target.x,y:target.y};
    this.fired=true;
    this.impactClock+=extracted;
    if(this.impactClock>=.27){
      this.impactClock=0;
      this.spawnImpact(target,3);
    }
    if(target.remaining<=0)this.shatter(target);
  }

  private spawnImpact(target:Asteroid,count:number):void{
    for(let i=0;i<count;i++){
      const theta=Math.random()*Math.PI*2;
      const speed=15+Math.random()*65;
      this.sparks.push({
        x:target.x+(Math.random()-.5)*target.size*.45,
        y:target.y+(Math.random()-.5)*target.size*.45,
        vx:Math.cos(theta)*speed,
        vy:Math.sin(theta)*speed,
        age:0,life:.24+Math.random()*.52,
        size:1+Math.random()*2.5,
        spin:theta,angular:(Math.random()-.5)*3,kind:'spark',
      });
    }
    this.trim();
  }

  private shatter(target:Asteroid):void{
    const count=20;
    for(let i=0;i<count;i++){
      const theta=Math.random()*Math.PI*2;
      const chunk=i<5;
      const speed=chunk?21+Math.random()*34:46+Math.random()*105;
      this.sparks.push({
        x:target.x,y:target.y,
        vx:Math.cos(theta)*speed,
        vy:Math.sin(theta)*speed,
        age:0,life:chunk?.75+Math.random()*.75:.35+Math.random()*.65,
        size:chunk?5+Math.random()*target.size*.34:1+Math.random()*3.4,
        spin:theta,angular:(Math.random()-.5)*6,
        kind:chunk?'chunk':'spark',
      });
    }
    this.fragmentClock=.38;
    this.trim();
  }

  private trim():void{
    if(this.sparks.length>this.maxParticles){
      this.sparks.splice(0,this.sparks.length-this.maxParticles);
    }
  }

  /** Call once per frame after mining state has updated. */
  update(seconds:number):void{
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.08);
    this.graphics.clear();
    if(this.beam){
      const beam=this.beam;
      beam.ignition+=dt;
      beam.pulse+=dt;
      if(!this.fired)beam.release+=dt;
      const extent=beamExtent(beam.ignition,beam.release);
      if(extent.start>=.999 || extent.end<=extent.start){
        if(!this.fired)this.spawnAfterglow(beam.to);
        this.beam=undefined;
      }else{
        const dx=beam.to.x-beam.from.x,dy=beam.to.y-beam.from.y;
        const length=Math.max(.001,Math.hypot(dx,dy));
        const nx=-dy/length,ny=dx/length;
        const ax=mix(beam.from.x,beam.to.x,extent.start);
        const ay=mix(beam.from.y,beam.to.y,extent.start);
        const bx=mix(beam.from.x,beam.to.x,extent.end);
        const by=mix(beam.from.y,beam.to.y,extent.end);
        // Faint outer bloom, firm extraction core, sharp leading tip.
        this.graphics.lineStyle(9,0xffffff,.055*extent.strength);
        this.graphics.lineBetween(ax,ay,bx,by);
        this.graphics.lineStyle(3,0xffffff,.35*extent.strength);
        this.graphics.lineBetween(ax,ay,bx,by);
        this.graphics.lineStyle(1,0xf8f8f8,.91*extent.strength);
        this.graphics.lineBetween(ax,ay,bx,by);
        const tip=clamp((extent.end-extent.start)*length*.19,6,17);
        this.graphics.fillStyle(0xffffff,.89*extent.strength);
        this.graphics.fillTriangle(
          bx,by,
          bx-dx/length*tip+nx*3.8,by-dy/length*tip+ny*3.8,
          bx-dx/length*tip-nx*3.8,by-dy/length*tip-ny*3.8,
        );
        // A white wave travels down the stable beam after first impact.
        if(extent.end>=.99){
          const p=(beam.pulse*3.6)%1;
          if(p>extent.start){
            this.graphics.fillStyle(0xffffff,.8*extent.strength);
            this.graphics.fillCircle(mix(beam.from.x,beam.to.x,p),
              mix(beam.from.y,beam.to.y,p),2.8);
          }
          const ring=6+Math.sin(beam.pulse*22)*2.4;
          this.graphics.lineStyle(1.3,0xffffff,.54*extent.strength);
          this.graphics.strokeCircle(beam.to.x,beam.to.y,ring);
        }
      }
    }
    for(let i=this.sparks.length-1;i>=0;i--){
      const p=this.sparks[i];
      p.age+=dt;
      if(p.age>=p.life){this.sparks.splice(i,1);continue;}
      const t=p.age/p.life,alpha=(1-t)*(p.kind==='chunk'?.72:.92);
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=Math.exp(-.85*dt);p.vy*=Math.exp(-.85*dt);
      p.spin+=p.angular*dt;
      this.graphics.fillStyle(p.kind==='chunk'?0x969698:0xf5f5f5,alpha);
      if(p.kind==='chunk'){
        const s=p.size*(1-.33*t),cs=Math.cos(p.spin),sn=Math.sin(p.spin);
        this.graphics.fillTriangle(
          p.x+cs*s,p.y+sn*s,
          p.x-sn*s*.74,p.y+cs*s*.74,
          p.x+sn*s*.68,p.y-cs*s*.68,
        );
      }else{
        this.graphics.fillCircle(p.x,p.y,Math.max(.3,p.size*(1-t*.55)));
      }
    }
    this.fired=false;
    this.fragmentClock=Math.max(0,this.fragmentClock-dt);
  }

  private spawnAfterglow(point:Point):void{
    const dummy:Asteroid={id:'afterglow',ore:'iron',x:point.x,y:point.y,
      remaining:1,size:5};
    this.spawnImpact(dummy,4);
  }

  clear():void {
    this.fired=false;
    this.beam=undefined;
    this.graphics.clear();
  }
}
