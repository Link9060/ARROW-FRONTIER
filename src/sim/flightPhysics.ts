import type { Point } from './model';

/** Pure manual-flight dynamics; no Phaser, browser state, or fleet AI involved. */
export interface FlightControls {
  /** -1 is counterclockwise, +1 clockwise, 0 keeps the current heading. */
  turn: number;
  thrust: boolean;
  brake: boolean;
}
export interface FlightMotion {
  angle: number;
  velocity: Point;
  displacement: Point;
  thrusting: boolean;
}

/**
 * Asteroids-inspired vector flight: orientation and travel direction can differ.
 * Ships drift when idle, accelerate along their nose under thrust, and can brake
 * without having their facing snapped to a cursor or their motion reset.
 * Caller substeps at <=50ms and resolves collisions in the shared hull system.
 */
export function integrateFlightMotion(
  heading: number, current: Point, controls: FlightControls,
  maximumSpeed: number, deltaSeconds: number
): FlightMotion {
  const dt=Number.isFinite(deltaSeconds)?Math.max(0,Math.min(.05,deltaSeconds)):0;
  const maxSpeed=Number.isFinite(maximumSpeed)?Math.max(0,maximumSpeed):0;
  const turn=Number.isFinite(controls.turn)?Math.max(-1,Math.min(1,controls.turn)):0;
  // Scouts turn a little faster than heavy miners; existing ship.speed is still
  // the maximum travel speed, preserving class balance and saved progression.
  const turnRate=3.8*Math.max(.67,Math.min(1,maxSpeed/285));
  const rawAngle=heading+turn*turnRate*dt;
  const angle=Math.atan2(Math.sin(rawAngle),Math.cos(rawAngle));
  let vx=Number.isFinite(current.x)?current.x:0;
  let vy=Number.isFinite(current.y)?current.y:0;
  const thrusting=!!controls.thrust&&!controls.brake&&maxSpeed>0;
  if(thrusting){
    const acceleration=maxSpeed*2.55;
    vx+=Math.cos(angle)*acceleration*dt;
    vy+=Math.sin(angle)*acceleration*dt;
  }
  // Very low ambient damping makes coasting meaningful. Brake is deliberately
  // much stronger so docking approaches remain manageable.
  const damping=Math.exp(-(controls.brake?6.3:.17)*dt);
  vx*=damping;
  vy*=damping;
  const magnitude=Math.hypot(vx,vy);
  if(magnitude>maxSpeed&&magnitude>0){
    const scale=maxSpeed/magnitude;
    vx*=scale;vy*=scale;
  }
  return {
    angle,
    velocity:{x:vx,y:vy},
    displacement:{x:vx*dt,y:vy*dt},
    thrusting,
  };
}
