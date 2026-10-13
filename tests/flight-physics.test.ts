import { describe, expect, it } from 'vitest';
import { integrateFlightMotion } from '../src/sim/flightPhysics';

const idle={turn:0,thrust:false,brake:false};

describe('Asteroids-inspired manual ship flight',()=>{
  it('thrusts along the ship nose, not the WASD screen direction',()=>{
    const up=integrateFlightMotion(-Math.PI/2,{x:0,y:0},{...idle,thrust:true},285,.05);
    expect(up.velocity.y).toBeLessThan(0);
    expect(Math.abs(up.velocity.x)).toBeLessThan(.0001);
    expect(up.thrusting).toBe(true);
  });
  it('lets the ship rotate while coasting along its old velocity vector',()=>{
    const before={x:120,y:0};
    const out=integrateFlightMotion(0,before,{...idle,turn:1},285,.05);
    expect(out.angle).toBeGreaterThan(0);
    expect(out.velocity.x).toBeGreaterThan(118);
    expect(out.velocity.y).toBe(0);
    expect(out.thrusting).toBe(false);
  });
  it('accepts simultaneous turning and forward thrust',()=>{
    const out=integrateFlightMotion(0,{x:0,y:0},{turn:-1,thrust:true,brake:false},285,.05);
    expect(out.angle).toBeLessThan(0);
    expect(out.velocity.x).toBeGreaterThan(0);
    expect(out.velocity.y).toBeLessThan(0);
  });
  it('brakes far faster than ambient damping and overrides thrust',()=>{
    const coast=integrateFlightMotion(0,{x:200,y:0},idle,285,.05);
    const brake=integrateFlightMotion(0,{x:200,y:0},{turn:0,thrust:true,brake:true},285,.05);
    expect(brake.velocity.x).toBeLessThan(coast.velocity.x*.8);
    expect(brake.thrusting).toBe(false);
  });
  it('retains each ship top speed regardless of sustained thrust',()=>{
    let velocity={x:0,y:0};
    for(let n=0;n<100;n++)
      velocity=integrateFlightMotion(0,velocity,{...idle,thrust:true},155,.05).velocity;
    expect(Math.hypot(velocity.x,velocity.y)).toBeLessThanOrEqual(155.00001);
    expect(Math.hypot(velocity.x,velocity.y)).toBeGreaterThan(140);
  });
  it('is similar at 20fps and 40fps for a straight burn',()=>{
    const run=(dt:number,count:number)=>{
      let v={x:0,y:0},x=0;
      for(let n=0;n<count;n++){
        const frame=integrateFlightMotion(0,v,{...idle,thrust:true},285,dt);
        v=frame.velocity;x+=frame.displacement.x;
      }
      return {v,x};
    };
    const slow=run(.05,20),fast=run(.025,40);
    expect(Math.abs(slow.v.x-fast.v.x)).toBeLessThan(4);
    expect(Math.abs(slow.x-fast.x)).toBeLessThan(6);
  });
  it('clamps invalid timesteps instead of introducing NaN movement',()=>{
    const out=integrateFlightMotion(0,{x:0,y:0},idle,285,NaN);
    expect(out.angle).toBe(0);
    expect(out.displacement).toEqual({x:0,y:0});
  });
});
